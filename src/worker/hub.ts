import { DurableObject } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import type { RealtimeEvent, ServerMessage } from "../shared/events";
import { createDb, schema } from "./db/client";
import { sha256Hex } from "./lib/ids";
import { runSweep } from "./services/sweep";

export type PublishInput = Omit<RealtimeEvent, "seq" | "at">;

export interface AuditInput {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  siteId?: string | null;
  summary: string;
  payload?: unknown;
}

export const GENESIS_HASH = "0".repeat(64);

/** Canonical string that a ledger row's hash commits to. */
export function auditDigestInput(row: {
  seq: number;
  at: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  siteId: string | null;
  summary: string;
  payload: string;
  prevHash: string;
}): string {
  return [row.prevHash, row.seq, row.at, row.actor, row.action, row.entityType, row.entityId, row.siteId ?? "", row.summary, row.payload].join("␟");
}

/**
 * CityHub — one Durable Object per city.
 *  1. Fans realtime events out to every connected view (WebSocket hibernation API,
 *     so idle sockets cost nothing).
 *  2. Serialises audit-ledger appends so the hash chain can never fork.
 *  3. Owns an alarm that sweeps timed-out confirmations and expired holds,
 *     so "no confirmation in 90s → next-best option" happens without polling.
 */
export class CityHub extends DurableObject<Env> {
  private ledgerQueue: Promise<unknown> = Promise.resolve();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.send(server, { type: "hello", seq: await this.currentSeq() });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === "string" && message.includes('"ping"')) this.send(ws, { type: "pong" });
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code, "closing");
    } catch {
      // Socket already closed.
    }
  }

  /** RPC: broadcast an event to all connected clients. */
  async publish(input: PublishInput): Promise<void> {
    const seq = (await this.currentSeq()) + 1;
    await this.ctx.storage.put("seq", seq);
    const event: RealtimeEvent = { ...input, seq, at: Date.now() };
    for (const ws of this.ctx.getWebSockets()) this.send(ws, { type: "event", event });
  }

  /** RPC: append entries to the hash-chained ledger, strictly in order. */
  async audit(entries: AuditInput[]): Promise<void> {
    const run = this.ledgerQueue.then(() => this.appendAudit(entries));
    // Keep the chain alive even if one append fails.
    this.ledgerQueue = run.catch(() => undefined);
    await run;
  }

  /** RPC: make sure the sweep alarm fires no later than `at`. */
  async scheduleSweep(at: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || at < current) await this.ctx.storage.setAlarm(at);
  }

  async alarm(): Promise<void> {
    const next = await runSweep({
      db: createDb(this.env.DB),
      env: this.env,
      hub: { publish: (e) => this.publish(e), audit: (e) => this.audit(e), scheduleSweep: (at) => this.scheduleSweep(at) },
      now: Date.now(),
    });
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }

  private async appendAudit(entries: AuditInput[]): Promise<void> {
    if (entries.length === 0) return;
    const db = createDb(this.env.DB);
    const [last] = await db
      .select({ seq: schema.auditLog.seq, hash: schema.auditLog.hash })
      .from(schema.auditLog)
      .orderBy(desc(schema.auditLog.seq))
      .limit(1);
    let seq = last?.seq ?? 0;
    let prevHash = last?.hash ?? GENESIS_HASH;
    const rows: (typeof schema.auditLog.$inferInsert)[] = [];
    for (const e of entries) {
      seq++;
      const row = {
        seq,
        at: Date.now(),
        actor: e.actor,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        siteId: e.siteId ?? null,
        summary: e.summary,
        payload: JSON.stringify(e.payload ?? {}),
        prevHash,
      };
      const hash = await sha256Hex(auditDigestInput(row));
      rows.push({ ...row, hash });
      prevHash = hash;
    }
    for (const row of rows) await db.insert(schema.auditLog).values(row);
  }

  private async currentSeq(): Promise<number> {
    return (await this.ctx.storage.get<number>("seq")) ?? 0;
  }

  private send(ws: WebSocket, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Client went away; hibernation API will clean up.
    }
  }
}

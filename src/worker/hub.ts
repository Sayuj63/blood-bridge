import { DurableObject } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import type { ForecastDTO, SiteDTO, SiteStockDTO, TransferBoardDTO } from "../shared/api";
import type { RealtimeEvent, ServerMessage, Topic } from "../shared/events";
import { createDb, schema } from "./db/client";
import { sha256Hex } from "./lib/ids";
import type { Deps } from "./deps";
import { forecast, transferBoard } from "./services/forecast";
import { listSites, siteStock } from "./services/sites";
import { runSweep } from "./services/sweep";

/** Events on these topics change stock-derived read models, so cached results are dropped. */
const DATA_TOPICS = new Set<Topic>(["stock", "sites", "transfers", "surge", "reservations"]);

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
  /**
   * Read-model cache. Heavy reads (forecast, transfer plan, site list, a bank's stock) scan
   * thousands of units, so they are computed once per data version and shared by every open
   * screen, instead of once per screen per realtime event. `version` moves on every data event.
   */
  private version = 0;
  private readonly cache = new Map<string, { version: number; at: number; value: Promise<unknown> }>();

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
    if (input.topics.some((t) => DATA_TOPICS.has(t))) this.version++;
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

  /* ── Cached read models (RPC) ── */

  /** Site list: freshness is shown in minutes, so a 60 s ceiling keeps it honest. */
  cachedSites(): Promise<SiteDTO[]> {
    return this.memo("sites", 60_000, () => listSites(this.localDeps()));
  }

  /** Forecast drifts with the clock (expiry), so it is recomputed at least every 5 min. */
  cachedForecast(): Promise<ForecastDTO> {
    return this.memo("forecast", 5 * 60_000, () => forecast(this.localDeps()));
  }

  cachedTransferBoard(siteId?: string): Promise<TransferBoardDTO> {
    return this.memo(`transfers:${siteId ?? "city"}`, 5 * 60_000, () => transferBoard(this.localDeps(), siteId));
  }

  cachedSiteStock(siteId: string): Promise<SiteStockDTO> {
    return this.memo(`stock:${siteId}`, 60_000, () => siteStock(this.localDeps(), siteId));
  }

  /** One computation per (key, data version), shared by concurrent callers; failures are not cached. */
  private memo<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.version === this.version && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
    const value = compute();
    this.cache.set(key, { version: this.version, at: Date.now(), value });
    value.catch(() => this.cache.delete(key));
    return value;
  }

  private localDeps(): Deps {
    return {
      db: createDb(this.env.DB),
      env: this.env,
      hub: { publish: (e) => this.publish(e), audit: (e) => this.audit(e), scheduleSweep: (at) => this.scheduleSweep(at) },
      now: Date.now(),
    };
  }

  async alarm(): Promise<void> {
    const next = await runSweep(this.localDeps());
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

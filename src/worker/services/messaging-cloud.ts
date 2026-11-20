/**
 * WhatsApp delivery inside the Worker via Meta's Cloud API — the same outbox, the same
 * claim / lease / ack as the laptop gateway, just a different hand on the other end.
 *
 *   enqueue ─▶ outbox(pending) ─ claim("cloud-api") ─▶ window? ─ text ─▶ ack(sent | retry | failed)
 *                                                          └ no ─ template ─▶ hold (pending, nextAttemptAt +24 h)
 *   inbound from that number ─▶ releaseHeld() ─▶ drain sends the held text inside the new window
 *
 * Triggered by ctx.waitUntil right after a request that queued WhatsApp rows, after every
 * webhook, and by the 1-minute cron as a backstop (retry backoff, lost waitUntil).
 * Safety gates (opt-in, STOP, rate limits) already ran at enqueue and run again inside claim().
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { createDb, schema } from "../db/client";
import { remoteHub, type Deps } from "../deps";
import { AppError } from "../lib/http";
import { isWhatsAppGroup, maskAddress } from "../messaging/phone";
import { MESSAGING_POLICY as P } from "../messaging/policy";
import {
  chooseDelivery,
  CLOUD_GATEWAY_ID,
  cloudConfig,
  CloudSendError,
  sendTemplate,
  sendText,
  type FetchLike,
  type ParsedWebhook,
  type WaConfig,
  type WebhookStatus,
} from "../messaging/whatsapp-cloud";
import { ack, auditDelivery, claim, maybeFallbackToSms } from "./messaging";
import { handleInbound } from "./messaging-bot";

type OutboxRow = typeof schema.outbox.$inferSelect;

/** Drain in the background (ctx.waitUntil) with fresh deps; no-op unless the Cloud API is the provider. */
export function kickWhatsAppCloud(env: Env, waitUntil: (p: Promise<unknown>) => void): void {
  if (!cloudConfig(env)) return;
  const deps: Deps = { db: createDb(env.DB), env, hub: remoteHub(env), now: Date.now() };
  waitUntil(drainWhatsAppCloud(deps).catch((err) => console.error("whatsapp cloud drain failed", err)));
}

export interface DrainResult {
  sent: number;
  templated: number;
  failed: number;
  retrying: number;
}

/** Max claim rounds per drain, so one invocation stays well inside the Worker's limits. */
const MAX_ROUNDS = 5;

/** Drain claimable WhatsApp rows through the Cloud API. No-op when the Cloud API isn't the provider. */
export async function drainWhatsAppCloud(deps: Deps, opts: { fetch?: FetchLike } = {}): Promise<DrainResult> {
  const result: DrainResult = { sent: 0, templated: 0, failed: 0, retrying: 0 };
  const cfg = cloudConfig(deps.env);
  if (!cfg) return result;
  const fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const batch = await claim(deps, { gatewayId: CLOUD_GATEWAY_ID, channels: ["whatsapp"], limit: P.claimBatchMax });
    if (batch.messages.length === 0) break;

    const ids = batch.messages.map((m) => m.id);
    const rows = new Map((await deps.db.select().from(schema.outbox).where(inArray(schema.outbox.id, ids))).map((r) => [r.id, r]));
    const addresses = [...new Set(batch.messages.map((m) => m.to))];
    const convs = await deps.db
      .select({ address: schema.conversations.address, lastInboundAt: schema.conversations.lastInboundAt })
      .from(schema.conversations)
      .where(and(eq(schema.conversations.channel, "whatsapp"), inArray(schema.conversations.address, addresses)));
    const lastInbound = new Map(convs.map((c) => [c.address, c.lastInboundAt]));

    for (const m of batch.messages) {
      const row = rows.get(m.id);
      if (!row) continue;
      const outcome = await deliverOne(deps, cfg, fetchImpl, row, m.leaseToken, lastInbound.get(m.to) ?? null);
      result[outcome]++;
    }
    if (batch.messages.length < P.claimBatchMax) break;
  }
  return result;
}

async function deliverOne(
  deps: Deps,
  cfg: WaConfig,
  fetchImpl: FetchLike,
  row: OutboxRow,
  leaseToken: string,
  lastInboundAt: number | null,
): Promise<keyof DrainResult> {
  // Group ids exist only on open-wa; the Cloud API can't post into groups.
  if (isWhatsAppGroup(row.to)) return fail(deps, row, leaseToken, "groups_not_supported_on_cloud_api", false);

  const mode = chooseDelivery({ lastInboundAt, templateSentAt: row.templateSentAt, now: deps.now, windowMs: P.replyWindowMs });
  if (mode === "await_reply") return hold(deps, row, leaseToken, row.templateSentAt! + P.replyWindowMs);
  if (mode === "expired") return fail(deps, row, leaseToken, "no_reply_to_template", false);
  if (mode === "template") {
    // A reply can only follow an inbound, so it is never business-initiated; enqueue() already enforced that.
    if (row.kind === "reply") return fail(deps, row, leaseToken, "outside_reply_window", false);
    return template(deps, cfg, fetchImpl, row, leaseToken);
  }

  try {
    const { providerMessageId } = await sendText(cfg, row.to, row.body, fetchImpl);
    const r = await safeAck(deps, row.id, { leaseToken, status: "sent", providerMessageId, retryable: true });
    return r === "sent" ? "sent" : "failed";
  } catch (err) {
    // Our clock said "inside the window" but Meta disagrees: fall back to the template opener once.
    if (err instanceof CloudSendError && err.outsideWindow && row.templateSentAt === null && row.kind !== "reply") {
      return template(deps, cfg, fetchImpl, row, leaseToken);
    }
    return failFromError(deps, row, leaseToken, err);
  }
}

/** Business-initiated opener, then park the row until the person replies. */
async function template(deps: Deps, cfg: WaConfig, fetchImpl: FetchLike, row: OutboxRow, leaseToken: string): Promise<keyof DrainResult> {
  try {
    const { providerMessageId } = await sendTemplate(cfg, row.to, fetchImpl);
    const o = schema.outbox;
    const [held] = await deps.db
      .update(o)
      .set({
        status: "pending",
        leaseToken: null,
        // The template doesn't use up a delivery attempt for the real message.
        attempts: Math.max(0, row.attempts - 1),
        templateSentAt: deps.now,
        providerMessageId,
        deliveryStatus: "sent",
        lastError: null,
        nextAttemptAt: deps.now + P.replyWindowMs,
        updatedAt: deps.now,
      })
      .where(and(eq(o.id, row.id), eq(o.status, "claimed"), eq(o.leaseToken, leaseToken)))
      .returning();
    if (!held) return "failed";
    await deps.hub.audit([
      {
        actor: `gateway:${CLOUD_GATEWAY_ID}`,
        action: "messaging.template_sent",
        entityType: "message",
        entityId: row.id,
        summary: `WhatsApp ${row.kind === "alert" ? "donor alert" : "notice"} to ${maskAddress(row.to)}: outside the 24 h window, sent template "${cfg.template.name}"; full text follows when they reply`,
        payload: { kind: row.kind, alertId: row.alertId, template: cfg.template.name },
      },
    ]);
    await deps.hub.publish({ topics: ["messaging"], donorIds: row.donorId ? [row.donorId] : undefined });
    return "templated";
  } catch (err) {
    return failFromError(deps, row, leaseToken, err);
  }
}

/** Put the row back without consuming an attempt (still waiting for the person to reply). */
async function hold(deps: Deps, row: OutboxRow, leaseToken: string, until: number): Promise<keyof DrainResult> {
  const o = schema.outbox;
  await deps.db
    .update(o)
    .set({ status: "pending", leaseToken: null, attempts: Math.max(0, row.attempts - 1), nextAttemptAt: until, updatedAt: deps.now })
    .where(and(eq(o.id, row.id), eq(o.status, "claimed"), eq(o.leaseToken, leaseToken)));
  return "retrying";
}

async function failFromError(deps: Deps, row: OutboxRow, leaseToken: string, err: unknown): Promise<keyof DrainResult> {
  const retryable = err instanceof CloudSendError ? err.retryable : true;
  const message = err instanceof Error ? err.message : String(err);
  if (!(err instanceof CloudSendError)) console.error("whatsapp cloud send failed", err);
  return fail(deps, row, leaseToken, message, retryable);
}

async function fail(deps: Deps, row: OutboxRow, leaseToken: string, error: string, retryable: boolean): Promise<keyof DrainResult> {
  const r = await safeAck(deps, row.id, { leaseToken, status: "failed", error, retryable });
  return r === "pending" ? "retrying" : "failed";
}

/** ack(), but a lease lost mid-send (STOP, a late status webhook) just counts as not delivered here. */
async function safeAck(deps: Deps, id: string, input: Parameters<typeof ack>[2]): Promise<OutboxRow["status"] | "lost"> {
  try {
    return (await ack(deps, id, input)).status;
  } catch (err) {
    if (err instanceof AppError && err.code === "conflict") return "lost";
    throw err;
  }
}

/**
 * The person just messaged us: everything parked behind a template for that number becomes
 * claimable now. Returns how many rows were released.
 */
export async function releaseHeld(deps: Deps, address: string): Promise<number> {
  const o = schema.outbox;
  const released = await deps.db
    .update(o)
    .set({ nextAttemptAt: deps.now, updatedAt: deps.now })
    .where(and(eq(o.channel, "whatsapp"), eq(o.to, address), eq(o.status, "pending"), isNotNull(o.templateSentAt)))
    .returning({ id: o.id });
  return released.length;
}

/**
 * Delivery receipts from the webhook. Matches the outbox row by provider message id (indexed).
 * A late `failed` on a row we had marked sent is turned into a failure (with the usual SMS
 * fallback for alerts), or — for 131047 "outside the window" — re-queued behind a template.
 */
export async function applyStatuses(deps: Deps, statuses: WebhookStatus[]): Promise<number> {
  if (statuses.length === 0) return 0;
  const o = schema.outbox;
  const RANK = { sent: 1, delivered: 2, read: 3, failed: 4 } as const;
  let updated = 0;
  for (const s of statuses) {
    const [row] = await deps.db.select().from(o).where(and(eq(o.channel, "whatsapp"), eq(o.providerMessageId, s.providerMessageId)));
    if (!row) continue;
    // Statuses can arrive out of order; never move backwards (read → delivered).
    if (row.deliveryStatus && RANK[row.deliveryStatus] >= RANK[s.status]) continue;

    if (s.status !== "failed") {
      await deps.db.update(o).set({ deliveryStatus: s.status, updatedAt: deps.now }).where(eq(o.id, row.id));
      updated++;
      continue;
    }

    // The template itself failed while the row was held: fail the row outright.
    // A sent text failed with 131047: retry behind a template (once).
    const outsideWindow = s.errorCode === 131047 && row.templateSentAt === null && row.kind !== "reply" && row.status === "sent";
    const [after] = await deps.db
      .update(o)
      .set(
        outsideWindow
          ? { status: "pending", deliveryStatus: null, providerMessageId: null, nextAttemptAt: deps.now, lastError: s.error, updatedAt: deps.now }
          : { status: "failed", deliveryStatus: "failed", leaseToken: null, lastError: s.error, updatedAt: deps.now },
      )
      .where(eq(o.id, row.id))
      .returning();
    updated++;
    if (!outsideWindow && after) {
      await auditDelivery(deps, after, "messaging.failed");
      await maybeFallbackToSms(deps, after);
    }
  }
  if (updated > 0) await deps.hub.publish({ topics: ["messaging"] });
  return updated;
}

/**
 * Everything a verified webhook delivery asks for, run after the 200 has gone back to Meta:
 * inbound messages → the existing bot (deduped by wamid in inbound_messages), release anything
 * held behind a template for those numbers, apply delivery receipts, then drain.
 */
export async function processWebhook(env: Env, parsed: ParsedWebhook, opts: { publicUrl: string; fetch?: FetchLike }): Promise<void> {
  const fresh = (): Deps => ({ db: createDb(env.DB), env, hub: remoteHub(env), now: Date.now() });
  for (const m of parsed.messages) {
    try {
      const deps = fresh();
      await handleInbound(deps, { channel: "whatsapp", from: m.from, text: m.text, messageId: m.messageId, at: m.at }, { publicUrl: opts.publicUrl });
      await releaseHeld(deps, m.from);
    } catch (err) {
      console.error("whatsapp webhook: inbound failed", err);
    }
  }
  try {
    await applyStatuses(fresh(), parsed.statuses);
  } catch (err) {
    console.error("whatsapp webhook: statuses failed", err);
  }
  if (parsed.messages.length > 0 || parsed.statuses.some((s) => s.status === "failed")) {
    await drainWhatsAppCloud(fresh(), { fetch: opts.fetch });
  }
}

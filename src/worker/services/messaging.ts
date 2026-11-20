/**
 * WhatsApp / SMS delivery: a transactional outbox drained by the off-Worker gateway.
 *
 *   enqueue ─▶ outbox(pending) ─claim (30 s lease)─▶ gateway sends ─ack─▶ sent | retry | failed
 *                                     ▲ lease expires: back in the pool       └▶ WhatsApp ×2 failed → SMS copy
 *
 * Safety (checked at enqueue AND again at claim, so a STOP between the two still wins):
 *  - alerts go only to donors with contactChannel ≠ none, contactOptInAt set, not opted out;
 *  - replies only within 24 h of the person messaging us;
 *  - STOP suppresses an address entirely (except the STOP confirmation itself);
 *  - every recipient is rate-limited per hour.
 * The audit ledger records counts and masked addresses, never message bodies.
 */
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import type {
  GatewayAckInput,
  GatewayClaimDTO,
  GatewayClaimInput,
  GatewayHeartbeatInput,
  MessagingChannelStatusDTO,
  MessagingStatusDTO,
} from "../../shared/api";
import { MESSAGE_CHANNELS, type MessageChannel, type Urgency } from "../../shared/domain";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { conflict, notFound } from "../lib/http";
import { newId } from "../lib/ids";
import { formatForChannel, say } from "../messaging/copy";
import { isE164, isWhatsAppGroup, maskAddress, smsCapable } from "../messaging/phone";
import { MESSAGING_POLICY as P } from "../messaging/policy";
import { CLOUD_GATEWAY_ID, whatsappProvider } from "../messaging/whatsapp-cloud";

type OutboxRow = typeof schema.outbox.$inferSelect;
type DonorRow = typeof schema.donors.$inferSelect;
type AlertRow = typeof schema.donorAlerts.$inferSelect;
export type OutboxKind = OutboxRow["kind"];

const CHANNEL_LABEL: Record<MessageChannel, string> = { whatsapp: "WhatsApp", sms: "SMS" };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The one rule for alerts: explicit channel, explicit opt-in timestamp, not opted out. */
export function canAlert(d: Pick<DonorRow, "contactChannel" | "contactAddress" | "contactOptInAt" | "optedOutAt">): boolean {
  return d.contactChannel !== "none" && d.contactAddress !== null && d.contactOptInAt !== null && d.optedOutAt === null;
}

/* ───────────────────────────── Rate limits & suppression ───────────────────────────── */

/** Increment an hourly bucket and return the new count. Shares the `rate_limits` table with critical alerts. */
export async function bumpHourly(deps: Deps, key: string): Promise<number> {
  const windowStart = Math.floor(deps.now / HOUR) * HOUR;
  const [row] = await deps.db
    .insert(schema.rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [schema.rateLimits.key, schema.rateLimits.windowStart], set: { count: sql`${schema.rateLimits.count} + 1` } })
    .returning({ count: schema.rateLimits.count });
  return row.count;
}

async function suppressedAddresses(deps: Deps, addresses: string[]): Promise<Set<string>> {
  if (addresses.length === 0) return new Set();
  const rows = await deps.db
    .select({ address: schema.conversations.address })
    .from(schema.conversations)
    .where(and(inArray(schema.conversations.address, addresses), isNotNull(schema.conversations.suppressedAt)));
  return new Set(rows.map((r) => r.address));
}

/* ───────────────────────────── Enqueue ───────────────────────────── */

export interface EnqueueInput {
  channel: MessageChannel;
  to: string;
  body: string;
  kind: OutboxKind;
  alertId?: string;
  donorId?: string;
  expiresAt?: number;
  fallbackOf?: string;
  /** Only for the STOP confirmation: the one message allowed to a suppressed address. */
  bypassSuppression?: boolean;
}

export type EnqueueResult = { queued: true; id: string } | { queued: false; reason: string };

export async function enqueue(deps: Deps, input: EnqueueInput): Promise<EnqueueResult> {
  const { channel, to, kind } = input;
  const group = isWhatsAppGroup(to);
  if (!(isE164(to) || (group && channel === "whatsapp"))) return { queued: false, reason: "invalid_address" };
  if (group && kind !== "reply") return { queued: false, reason: "groups_reply_only" };
  if (channel === "sms" && !smsCapable(to)) return { queued: false, reason: "not_sms_capable" };

  if (!input.bypassSuppression && (await suppressedAddresses(deps, [to])).has(to)) return { queued: false, reason: "suppressed" };

  if (kind === "alert") {
    if (!input.donorId) return { queued: false, reason: "alert_without_donor" };
    const [donor] = await deps.db.select().from(schema.donors).where(eq(schema.donors.id, input.donorId));
    if (!donor || !canAlert(donor) || donor.contactAddress !== to) return { queued: false, reason: "not_opted_in" };
  }
  if (kind === "reply") {
    const [conv] = await deps.db
      .select({ lastInboundAt: schema.conversations.lastInboundAt })
      .from(schema.conversations)
      .where(and(eq(schema.conversations.channel, channel), eq(schema.conversations.address, to)));
    if (!conv?.lastInboundAt || deps.now - conv.lastInboundAt > P.replyWindowMs) return { queued: false, reason: "outside_reply_window" };
  }

  if ((await bumpHourly(deps, `msg:${to}`)) > P.perRecipientPerHour) return { queued: false, reason: "rate_limited" };

  const id = newId("MSG", 8);
  await deps.db.insert(schema.outbox).values({
    id,
    channel,
    to,
    body: formatForChannel(input.body, channel).slice(0, P.maxBodyChars[channel]),
    kind,
    status: "pending",
    attempts: 0,
    alertId: input.alertId ?? null,
    donorId: input.donorId ?? null,
    fallbackOf: input.fallbackOf ?? null,
    nextAttemptAt: deps.now,
    expiresAt: input.expiresAt ?? null,
    createdAt: deps.now,
    updatedAt: deps.now,
  });
  deps.onQueued?.(channel);
  return { queued: true, id };
}

/**
 * Hook called by sendDrive: queue an alert for every opted-in donor in the drive.
 * Synthetic seeded donors have contactChannel = none, so they are filtered out here.
 */
export async function enqueueAlertMessages(
  deps: Deps,
  alerts: AlertRow[],
  bank: { id: string; name: string },
  urgency: Urgency,
): Promise<number> {
  if (alerts.length === 0) return 0;
  const donors = await deps.db
    .select()
    .from(schema.donors)
    .where(and(inArray(schema.donors.id, alerts.map((a) => a.donorId)), sql`${schema.donors.contactChannel} != 'none'`));
  const byId = new Map(donors.filter(canAlert).map((d) => [d.id, d]));
  const results: { channel: MessageChannel; result: EnqueueResult }[] = [];
  for (const alert of alerts) {
    const donor = byId.get(alert.donorId);
    if (!donor || donor.contactChannel === "none" || !donor.contactAddress) continue;
    const body = [
      alert.messageLocalized ?? alert.message,
      `${bank.name} · about ${alert.distanceKm.toFixed(1)} km from you.`,
      say("alertSuffix", donor.language),
    ].join("\n");
    const result = await enqueue(deps, {
      channel: donor.contactChannel,
      to: donor.contactAddress,
      body,
      kind: "alert",
      alertId: alert.id,
      donorId: donor.id,
      expiresAt: deps.now + P.alertTtlMs[urgency],
    });
    results.push({ channel: donor.contactChannel, result });
  }
  const queued = results.filter((r) => r.result.queued);
  if (results.length > 0) {
    const skipped = results.length - queued.length;
    await deps.hub.audit([
      {
        actor: "system:messaging",
        action: "messaging.alerts_queued",
        entityType: "drive",
        entityId: alerts[0].driveId,
        siteId: bank.id,
        summary: `Queued ${queued.length} donor alert${queued.length === 1 ? "" : "s"} (${summarize(countBy(queued.map((q) => CHANNEL_LABEL[q.channel])))})${skipped ? `; ${skipped} skipped by safety rules` : ""}`,
        payload: { queued: queued.length, skipped, reasons: countBy(results.filter((r) => !r.result.queued).map((r) => (r.result as { reason: string }).reason)) },
      },
    ]);
    await deps.hub.publish({ topics: ["messaging"], siteIds: [bank.id] });
  }
  return queued.length;
}

/** Hook called by web signup: confirm the opt-in on the channel itself (and give STOP up front). */
export async function sendOptInWelcome(deps: Deps, donor: Pick<DonorRow, "id" | "bloodGroup" | "language" | "contactChannel" | "contactAddress" | "contactOptInAt" | "optedOutAt">): Promise<void> {
  if (!canAlert(donor) || donor.contactChannel === "none" || !donor.contactAddress) return;
  const result = await enqueue(deps, {
    channel: donor.contactChannel,
    to: donor.contactAddress,
    body: say("webWelcome", donor.language, { group: donor.bloodGroup }),
    kind: "notice",
    donorId: donor.id,
  });
  await deps.hub.audit([
    {
      actor: `donor:${donor.id}`,
      action: "messaging.opted_in",
      entityType: "donor",
      entityId: donor.id,
      summary: `Donor opted in to ${CHANNEL_LABEL[donor.contactChannel]} alerts at ${maskAddress(donor.contactAddress)}${result.queued ? "; confirmation queued" : ""}`,
      payload: { channel: donor.contactChannel, source: "web" },
    },
  ]);
  await deps.hub.publish({ topics: ["messaging"], donorIds: [donor.id] });
}

/* ───────────────────────────── Claim ───────────────────────────── */

/**
 * Hand up to `limit` deliverable rows to a gateway. One conditional UPDATE … RETURNING
 * claims them atomically, so two gateways can never get the same row; a row whose lease
 * lapsed (gateway crashed mid-send) is claimable again.
 */
export async function claim(deps: Deps, input: GatewayClaimInput): Promise<GatewayClaimDTO> {
  const { now } = deps;
  const o = schema.outbox;
  // Exactly one WhatsApp sender: when the Cloud API is the provider, gateways never get WhatsApp rows.
  const channels = input.gatewayId !== CLOUD_GATEWAY_ID && whatsappProvider(deps.env) === "cloud" ? input.channels.filter((c) => c !== "whatsapp") : input.channels;
  if (channels.length === 0) return { messages: [], leaseMs: P.leaseMs };
  await expireStale(deps);

  const leaseCutoff = now - P.leaseMs;
  const claimable = and(
    inArray(o.channel, channels),
    lt(o.attempts, P.maxAttempts),
    or(isNull(o.expiresAt), gt(o.expiresAt, now)),
    or(and(eq(o.status, "pending"), lte(o.nextAttemptAt, now)), and(eq(o.status, "claimed"), lt(o.claimedAt, leaseCutoff))),
  );
  const candidates = deps.db
    .select({ id: o.id })
    .from(o)
    .where(claimable)
    .orderBy(asc(o.createdAt))
    .limit(Math.min(input.limit, P.claimBatchMax));
  const leaseToken = crypto.randomUUID();
  const claimed = await deps.db
    .update(o)
    .set({ status: "claimed", leaseToken, claimedAt: now, claimedBy: input.gatewayId, attempts: sql`${o.attempts} + 1`, updatedAt: now })
    .where(and(inArray(o.id, candidates), claimable))
    .returning();

  const deliverable = await recheckSafety(deps, claimed);
  return {
    messages: deliverable.map((m) => ({ id: m.id, channel: m.channel, to: m.to, body: m.body, leaseToken, attempt: m.attempts })),
    leaseMs: P.leaseMs,
  };
}

/** Second safety gate at send time: a STOP or opt-out that landed after enqueue still wins. */
async function recheckSafety(deps: Deps, rows: OutboxRow[]): Promise<OutboxRow[]> {
  if (rows.length === 0) return rows;
  const suppressed = await suppressedAddresses(deps, rows.filter((r) => r.kind !== "notice").map((r) => r.to));
  const donorIds = [...new Set(rows.filter((r) => r.kind === "alert" && r.donorId).map((r) => r.donorId!))];
  const donors = donorIds.length ? await deps.db.select().from(schema.donors).where(inArray(schema.donors.id, donorIds)) : [];
  const allowed = new Set(donors.filter(canAlert).map((d) => d.id));

  const ok: OutboxRow[] = [];
  const cancelled: string[] = [];
  for (const r of rows) {
    const blocked = suppressed.has(r.to) || (r.kind === "alert" && !(r.donorId && allowed.has(r.donorId)));
    if (blocked) cancelled.push(r.id);
    else ok.push(r);
  }
  if (cancelled.length > 0) {
    await deps.db
      .update(schema.outbox)
      .set({ status: "failed", lastError: "opted_out_before_send", leaseToken: null, updatedAt: deps.now })
      .where(inArray(schema.outbox.id, cancelled));
  }
  return ok;
}

/** Retire rows that can no longer be delivered: past their TTL, or out of attempts with a lapsed lease. */
async function expireStale(deps: Deps): Promise<void> {
  const o = schema.outbox;
  await deps.db
    .update(o)
    .set({ status: "failed", lastError: "expired", leaseToken: null, updatedAt: deps.now })
    .where(and(inArray(o.status, ["pending", "claimed"]), isNotNull(o.expiresAt), lte(o.expiresAt, deps.now)));
  const exhausted = await deps.db
    .update(o)
    .set({ status: "failed", lastError: "lease_expired", leaseToken: null, updatedAt: deps.now })
    .where(and(eq(o.status, "claimed"), lt(o.claimedAt, deps.now - P.leaseMs), sql`${o.attempts} >= ${P.maxAttempts}`))
    .returning();
  for (const row of exhausted) await maybeFallbackToSms(deps, row);
}

/* ───────────────────────────── Ack ───────────────────────────── */

/** Strip anything that looks like a phone number and cap length, before an error is stored. */
const scrubError = (e: string | undefined) => (e ?? "unknown error").replace(/\+?\d[\d\s-]{6,}\d/g, "[number]").slice(0, 300);

export async function ack(deps: Deps, id: string, input: GatewayAckInput): Promise<{ status: OutboxRow["status"]; fallbackId?: string }> {
  const o = schema.outbox;
  const [row] = await deps.db.select().from(o).where(eq(o.id, id));
  if (!row) throw notFound("Outbox message");
  if (row.status !== "claimed" || row.leaseToken !== input.leaseToken) {
    throw conflict("Lease is no longer held (expired or already acknowledged)", { status: row.status });
  }
  const owned = and(eq(o.id, id), eq(o.status, "claimed"), eq(o.leaseToken, input.leaseToken));

  if (input.status === "sent") {
    const [done] = await deps.db
      .update(o)
      .set({ status: "sent", sentAt: deps.now, leaseToken: null, lastError: null, providerMessageId: input.providerMessageId ?? null, deliveryStatus: "sent", updatedAt: deps.now })
      .where(owned)
      .returning();
    if (!done) throw conflict("Lease is no longer held");
    await auditDelivery(deps, done, "messaging.sent");
    return { status: "sent" };
  }

  const error = scrubError(input.error);
  const whatsappGaveUp = row.channel === "whatsapp" && row.kind === "alert" && row.attempts >= P.whatsappFailuresBeforeSms;
  const retry = input.retryable && row.attempts < P.maxAttempts && !whatsappGaveUp;
  const [updated] = await deps.db
    .update(o)
    .set(
      retry
        ? { status: "pending", leaseToken: null, lastError: error, nextAttemptAt: deps.now + P.retryBackoffMs[Math.min(row.attempts - 1, P.retryBackoffMs.length - 1)], updatedAt: deps.now }
        : { status: "failed", leaseToken: null, lastError: error, updatedAt: deps.now },
    )
    .where(owned)
    .returning();
  if (!updated) throw conflict("Lease is no longer held");
  if (retry) {
    await deps.hub.publish({ topics: ["messaging"] });
    return { status: "pending" };
  }
  await auditDelivery(deps, updated, "messaging.failed");
  const fallbackId = await maybeFallbackToSms(deps, updated);
  return { status: "failed", fallbackId };
}

/** Prefer WhatsApp; if it failed, re-queue an alert as SMS when the donor's number can take one. */
export async function maybeFallbackToSms(deps: Deps, row: OutboxRow): Promise<string | undefined> {
  if (row.channel !== "whatsapp" || row.kind !== "alert" || !smsCapable(row.to)) return undefined;
  const [existing] = await deps.db.select({ id: schema.outbox.id }).from(schema.outbox).where(eq(schema.outbox.fallbackOf, row.id));
  if (existing) return undefined;
  const result = await enqueue(deps, {
    channel: "sms",
    to: row.to,
    body: row.body,
    kind: "alert",
    alertId: row.alertId ?? undefined,
    donorId: row.donorId ?? undefined,
    expiresAt: row.expiresAt ?? undefined,
    fallbackOf: row.id,
  });
  if (!result.queued) return undefined;
  await deps.hub.audit([
    {
      actor: "system:messaging",
      action: "messaging.fallback_sms",
      entityType: "message",
      entityId: row.id,
      summary: `WhatsApp alert to ${maskAddress(row.to)} failed ${row.attempts}×; re-queued as SMS`,
      payload: { fallbackId: result.id },
    },
  ]);
  return result.id;
}

export async function auditDelivery(deps: Deps, row: OutboxRow, action: "messaging.sent" | "messaging.failed") {
  const what = row.kind === "alert" ? "donor alert" : row.kind === "reply" ? "reply" : "notice";
  await deps.hub.audit([
    {
      actor: `gateway:${row.claimedBy ?? "unknown"}`,
      action,
      entityType: "message",
      entityId: row.id,
      summary:
        action === "messaging.sent"
          ? `${CHANNEL_LABEL[row.channel]} ${what} delivered to ${maskAddress(row.to)}`
          : `${CHANNEL_LABEL[row.channel]} ${what} to ${maskAddress(row.to)} failed after ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}`,
      payload: { kind: row.kind, alertId: row.alertId, attempts: row.attempts, error: action === "messaging.failed" ? row.lastError : undefined },
    },
  ]);
  await deps.hub.publish({ topics: ["messaging"], donorIds: row.donorId ? [row.donorId] : undefined });
}

/* ───────────────────────────── Heartbeat & status ───────────────────────────── */

export async function heartbeat(deps: Deps, input: GatewayHeartbeatInput): Promise<{ ok: true }> {
  const g = schema.gatewayChannels;
  const previous = await deps.db.select().from(g).where(eq(g.gatewayId, input.gatewayId));
  const changes: string[] = [];
  for (const c of input.channels) {
    const prev = previous.find((p) => p.channel === c.channel);
    const wasOnline = prev?.state === "online" && deps.now - prev.lastSeenAt <= P.onlineWithinMs;
    if ((c.state === "online") !== wasOnline || prev?.state !== c.state) changes.push(`${CHANNEL_LABEL[c.channel]} ${c.state.replace("_", " ")} (${c.adapter})`);
    await deps.db
      .insert(g)
      .values({ gatewayId: input.gatewayId, channel: c.channel, adapter: c.adapter, state: c.state, detail: c.detail ?? null, version: input.version ?? null, lastSeenAt: deps.now })
      .onConflictDoUpdate({
        target: [g.gatewayId, g.channel],
        set: { adapter: c.adapter, state: c.state, detail: c.detail ?? null, version: input.version ?? null, lastSeenAt: deps.now },
      });
  }
  if (changes.length > 0) {
    const online = input.channels.filter((c) => c.state === "online");
    await deps.hub.audit([
      { actor: `gateway:${input.gatewayId}`, action: "gateway.status", entityType: "gateway", entityId: input.gatewayId, summary: `Messaging gateway: ${changes.join(", ")}` },
    ]);
    await deps.hub.publish({
      topics: ["messaging"],
      headline: online.length ? `${online.map((c) => CHANNEL_LABEL[c.channel]).join(" + ")} online` : undefined,
      tone: online.length ? "success" : undefined,
    });
  }
  return { ok: true };
}

const STATE_RANK: Record<MessagingChannelStatusDTO["state"], number> = { online: 3, needs_qr: 2, starting: 1, offline: 0 };

export async function messagingStatus(deps: Deps): Promise<MessagingStatusDTO> {
  const rows = await deps.db.select().from(schema.gatewayChannels);
  const cloud = whatsappProvider(deps.env) === "cloud";
  const channels = MESSAGE_CHANNELS.map((channel): MessagingChannelStatusDTO => {
    // Cloud API runs inside the Worker: always reachable, no heartbeat needed.
    if (channel === "whatsapp" && cloud) return { channel, online: true, state: "online", adapter: "cloud-api", lastSeenAt: deps.now };
    const live = rows.filter((r) => r.channel === channel && deps.now - r.lastSeenAt <= P.onlineWithinMs);
    const best = live.sort((a, b) => STATE_RANK[b.state] - STATE_RANK[a.state])[0];
    const last = rows.filter((r) => r.channel === channel).sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0];
    return {
      channel,
      online: best?.state === "online",
      state: best?.state ?? "offline",
      adapter: (best ?? last)?.adapter ?? null,
      lastSeenAt: last?.lastSeenAt ?? null,
    };
  });
  const o = schema.outbox;
  const counts = await deps.db
    .select({ status: o.status, n: sql<number>`count(*)` })
    .from(o)
    .where(or(inArray(o.status, ["pending", "claimed"]), gt(o.updatedAt, deps.now - DAY)))
    .groupBy(o.status);
  const n = (s: OutboxRow["status"]) => Number(counts.find((c) => c.status === s)?.n ?? 0);
  const lastSeen = rows.reduce<number | null>((m, r) => (m === null || r.lastSeenAt > m ? r.lastSeenAt : m), null);
  return {
    gatewayLastSeenAt: cloud ? deps.now : lastSeen,
    whatsappProvider: cloud ? "cloud" : "gateway",
    channels,
    queue: { pending: n("pending"), claimed: n("claimed"), sent24h: n("sent"), failed24h: n("failed") },
    checkedAt: deps.now,
  };
}

/* ───────────────────────────── Helpers ───────────────────────────── */

const summarize = (counts: Record<string, number>) =>
  Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ") || "none";

function countBy(xs: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

export const channelLabel = (c: MessageChannel) => CHANNEL_LABEL[c];

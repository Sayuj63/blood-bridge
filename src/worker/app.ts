import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  addUnitsSchema,
  advanceSchema,
  alertResponseSchema,
  approveTransferSchema,
  confirmSchema,
  createRequestSchema,
  declineSchema,
  dismissTransferSchema,
  donorDriveSchema,
  donorPreferencesSchema,
  donorSignupSchema,
  gatewayAckSchema,
  gatewayClaimSchema,
  gatewayHeartbeatSchema,
  gatewayInboundSchema,
  offerUnitsSchema,
  reserveSchema,
  searchSchema,
  startSurgeSchema,
  unitActionSchema,
  type MessagingContactDTO,
  type MetaDTO,
} from "../shared/api";
import { BLOOD_GROUPS, POLICY } from "../shared/domain";
import { DEMO_ELIGIBILITY_RULES } from "../shared/eligibility";
import { createDb } from "./db/client";
import { hubStub, remoteHub, type Deps } from "./deps";
import { AppError, body } from "./lib/http";
import { AREAS, CITY, SNAPSHOT_FETCHED_AT, SURGE_ZONES } from "./seed";
import * as audit from "./services/audit";
import { resetDemo } from "./services/demo";
import * as donors from "./services/donors";
import * as fc from "./services/forecast";
import * as messaging from "./services/messaging";
import { handleInbound } from "./services/messaging-bot";
import { kickWhatsAppCloud, processWebhook } from "./services/messaging-cloud";
import { CLOUD_GATEWAY_ID, contactInfo, parseWebhook, readWaEnv, verifyChallenge, verifySignature } from "./messaging/whatsapp-cloud";
import * as req from "./services/requests";
import * as sites from "./services/sites";
import * as stock from "./services/stock";
import { eraktkoshStatus, syncEraktkosh } from "./services/eraktkosh";
import { parseResults, type EraktkoshResult } from "./eraktkosh/parse";
import { listIntegrations, syncRakt } from "./services/integrations";

type AppEnv = { Bindings: Env; Variables: { deps: Deps; actor: string } };

const deps = (c: Context<AppEnv>) => c.get("deps");
const actor = (c: Context<AppEnv>) => c.get("actor");

export const app = new Hono<AppEnv>().basePath("/api");

// Any origin may call the API (a separately hosted frontend, local dev). No cookies are used,
// so there are no credentials to protect; gateway routes stay protected by their bearer token.
app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "X-Actor", "Authorization"], allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], maxAge: 86_400 }));

app.use("*", async (c, next) => {
  let whatsappQueued = false;
  c.set("deps", {
    db: createDb(c.env),
    env: c.env,
    hub: remoteHub(c.env),
    now: Date.now(),
    onQueued: (channel) => {
      if (channel === "whatsapp") whatsappQueued = true;
    },
  });
  // Demo identity: views declare who they act as. Real deployments would use verified accounts.
  c.set("actor", (c.req.header("X-Actor") ?? "anonymous").slice(0, 64));
  await next();
  c.header("Cache-Control", "no-store");
  // Anything this request queued for WhatsApp goes out via the Cloud API right after the response.
  if (whatsappQueued) kickWhatsAppCloud(c.env, (p) => waitUntil(c, p));
});

/** ctx.waitUntil when there is an execution context (always in workerd; not in some test harnesses). */
function waitUntil(c: Context<AppEnv>, p: Promise<unknown>) {
  try {
    c.executionCtx.waitUntil(p);
  } catch {
    void p;
  }
}

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: "internal", message: "Something went wrong" } }, 500);
});

app.notFound((c) => c.json({ error: { code: "not_found", message: "No such endpoint" } }, 404));

/* ── Meta & realtime ── */

app.get("/health", (c) => c.json({ ok: true }));

app.get("/meta", (c) =>
  c.json<MetaDTO>({
    city: CITY,
    policy: { ...POLICY },
    areas: AREAS,
    surgeZones: SURGE_ZONES,
    stockSnapshotAt: SNAPSHOT_FETCHED_AT,
    eligibilityRules: DEMO_ELIGIBILITY_RULES,
    simulated: true,
  }),
);

app.get("/realtime", (c) => {
  if (c.req.header("Upgrade") !== "websocket") throw new AppError(426, "upgrade_required", "Expected WebSocket");
  return hubStub(c.env).fetch(c.req.raw);
});

/* ── Sites & stock ── */

// Heavy read models are served from the CityHub cache (recomputed only when data changes).
app.get("/sites", async (c) => c.json(await hubStub(c.env).cachedSites()));
app.get("/sites/:id/stock", async (c) => c.json(await hubStub(c.env).cachedSiteStock(c.req.param("id"))));
app.post("/sites/:id/sync", async (c) => {
  await sites.syncSite(deps(c), c.req.param("id"), actor(c));
  return c.json({ ok: true });
});
app.post("/sites/:id/units", async (c) =>
  c.json(await stock.addUnits(deps(c), c.req.param("id"), await body(c, addUnitsSchema), actor(c)), 201),
);
app.post("/sites/:id/offer", async (c) =>
  c.json({ offered: await fc.offerUnits(deps(c), c.req.param("id"), await body(c, offerUnitsSchema), actor(c)) }),
);
app.post("/units/:id/action", async (c) =>
  c.json(await stock.unitAction(deps(c), c.req.param("id"), await body(c, unitActionSchema), actor(c))),
);
app.post("/sites/:id/sync-eraktkosh", async (c) => c.json(await syncEraktkosh(deps(c), actor(c), c.req.param("id"))));
app.get("/sites/:id/integrations", async (c) => c.json(await listIntegrations(deps(c), c.req.param("id"))));
app.post("/sites/:id/sync-rakt", async (c) => c.json(await syncRakt(deps(c), c.req.param("id"), actor(c))));
app.post("/eraktkosh/sync", async (c) => c.json(await syncEraktkosh(deps(c), actor(c))));
app.get("/eraktkosh/status", async (c) => c.json(await eraktkoshStatus(deps(c))));
app.get("/sites/:id/queue", async (c) => c.json(await req.bankQueue(deps(c), c.req.param("id"))));
app.get("/sites/:id/incoming-donors", async (c) => c.json(await donors.incomingDonors(deps(c), c.req.param("id"))));

/* ── Search, requests, reservations ── */

app.post("/search", async (c) => c.json(await req.search(deps(c), await body(c, searchSchema))));
app.post("/requests", async (c) => c.json(await req.createRequest(deps(c), await body(c, createRequestSchema), actor(c)), 201));
app.get("/requests", async (c) => {
  const hospitalId = c.req.query("hospitalId");
  if (!hospitalId) throw new AppError(400, "bad_request", "hospitalId is required");
  return c.json(await req.listRequests(deps(c), hospitalId));
});
app.get("/requests/:id", async (c) => c.json(await req.getRequest(deps(c), c.req.param("id"))));
app.post("/requests/:id/reserve", async (c) => {
  const { bankSiteId } = await body(c, reserveSchema);
  return c.json(await req.reserve(deps(c), c.req.param("id"), bankSiteId, actor(c)));
});
/** Cover every uncovered unit across as few banks as possible, in one action. */
app.post("/requests/:id/reserve-split", async (c) => c.json(await req.reserveSplit(deps(c), c.req.param("id"), actor(c))));
app.get("/requests/:id/split-plan", async (c) => c.json(await req.planRequestSplit(deps(c), c.req.param("id"))));
app.post("/requests/:id/critical", async (c) => c.json(await donors.criticalBroadcast(deps(c), c.req.param("id"), actor(c))));

app.post("/reservations/:id/confirm", async (c) => {
  const { units } = await body(c, confirmSchema);
  return c.json(await req.confirmReservation(deps(c), c.req.param("id"), units, actor(c)));
});
app.post("/reservations/:id/decline", async (c) => {
  const { reason } = await body(c, declineSchema);
  return c.json(await req.declineReservation(deps(c), c.req.param("id"), reason, actor(c)));
});
app.post("/reservations/:id/advance", async (c) => {
  const { to } = await body(c, advanceSchema);
  return c.json(await req.advanceReservation(deps(c), c.req.param("id"), to, actor(c)));
});
app.post("/reservations/:id/phone-confirm", async (c) => c.json(await req.phoneConfirm(deps(c), c.req.param("id"), actor(c))));

/* ── Forecast, transfers, surge ── */

app.get("/forecast", async (c) => c.json(await hubStub(c.env).cachedForecast()));
app.get("/transfers", async (c) => c.json(await hubStub(c.env).cachedTransferBoard(c.req.query("siteId"))));
app.post("/transfers", async (c) => c.json(await fc.approveTransfer(deps(c), await body(c, approveTransferSchema), actor(c)), 201));
app.post("/transfers/dismiss", async (c) => {
  await fc.dismissTransfer(deps(c), await body(c, dismissTransferSchema), actor(c));
  return c.json({ ok: true });
});
app.post("/transfers/:id/complete", async (c) => c.json(await fc.completeTransfer(deps(c), c.req.param("id"), actor(c))));

app.post("/surge", async (c) => c.json(await fc.startSurge(deps(c), await body(c, startSurgeSchema), actor(c)), 201));
app.delete("/surge", async (c) => {
  await fc.endSurge(deps(c), actor(c));
  return c.json({ ok: true });
});
app.get("/surge/brief", async (c) => c.json(await fc.surgeBrief(deps(c), c.req.query("refresh") === "1")));

/* ── Donors & alerts ── */

app.get("/donors/personas", async (c) => c.json(await donors.listPersonas(deps(c))));
app.post("/donors", async (c) => c.json(await donors.signup(deps(c), await body(c, donorSignupSchema)), 201));
app.get("/donors/:id", async (c) => c.json(await donors.getDonor(deps(c), c.req.param("id"))));
app.patch("/donors/:id", async (c) =>
  c.json(await donors.updatePreferences(deps(c), c.req.param("id"), await body(c, donorPreferencesSchema))),
);
app.post("/donors/:id/opt-out", async (c) => {
  const { optOut } = await body(c, z.object({ optOut: z.boolean() }));
  return c.json(await donors.setOptOut(deps(c), c.req.param("id"), optOut));
});
app.get("/donors/:id/alerts", async (c) => c.json(await donors.donorAlerts(deps(c), c.req.param("id"))));
app.post("/alerts/:id/respond", async (c) => {
  const { response } = await body(c, alertResponseSchema);
  return c.json(await donors.respond(deps(c), c.req.param("id"), response));
});
app.post("/alerts/:id/complete", async (c) => {
  await donors.completeDonation(deps(c), c.req.param("id"), actor(c));
  return c.json({ ok: true });
});
app.post("/drives/preview", async (c) => {
  const { bankSiteId, bloodGroup } = await body(c, z.object({ bankSiteId: z.string(), bloodGroup: z.enum(BLOOD_GROUPS) }));
  return c.json(await donors.previewDrive(deps(c), bankSiteId, bloodGroup));
});
app.post("/drives", async (c) => c.json(await donors.sendDrive(deps(c), await body(c, donorDriveSchema), actor(c)), 201));

/* ── Messaging gateway (WhatsApp / SMS) ── */

/** Constant-time token check: hash both sides so lengths match, then timingSafeEqual. */
async function tokenMatches(presented: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(presented)), crypto.subtle.digest("SHA-256", enc.encode(expected))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

app.use("/gateway/*", async (c, next) => {
  const expected = c.env.GATEWAY_TOKEN;
  if (!expected || expected.length < 24) throw new AppError(503, "gateway_not_configured", "Messaging gateway is not configured");
  const header = c.req.header("Authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented || !(await tokenMatches(presented, expected))) throw new AppError(401, "unauthorized", "Invalid gateway token");
  c.set("actor", "gateway");
  await next();
});

/** India-based relay: the gateway fetches e-RaktKosh (which blocks cloud servers) and pushes the raw rows here. */
app.post("/gateway/eraktkosh", async (c) => {
  const { results } = await body(
    c,
    z.object({ results: z.array(z.object({ componentCode: z.string().max(4), rows: z.array(z.array(z.string()).max(8)).max(500) })).max(40) }),
  );
  return c.json(await syncEraktkosh(deps(c), "gateway:eraktkosh-relay", undefined, parseResults(results as EraktkoshResult[])));
});
app.post("/gateway/heartbeat", async (c) => c.json(await messaging.heartbeat(deps(c), await body(c, gatewayHeartbeatSchema))));
app.post("/gateway/outbox/claim", async (c) => {
  const input = await body(c, gatewayClaimSchema);
  if (input.gatewayId === CLOUD_GATEWAY_ID) throw new AppError(400, "bad_request", `gatewayId "${CLOUD_GATEWAY_ID}" is reserved for the in-Worker Cloud API sender`);
  return c.json(await messaging.claim(deps(c), input));
});
app.post("/gateway/outbox/:id/ack", async (c) => c.json(await messaging.ack(deps(c), c.req.param("id"), await body(c, gatewayAckSchema))));
app.post("/gateway/inbound", async (c) =>
  c.json(await handleInbound(deps(c), await body(c, gatewayInboundSchema), { publicUrl: new URL(c.req.url).origin })),
);

/** Public, read-only: gateway liveness and queue depth for the "WhatsApp online" indicator. */
app.get("/messaging/status", async (c) => c.json(await messaging.messagingStatus(deps(c))));

/** Public: the official Blood Bridge WhatsApp number for click-to-chat (nulls when not configured). */
app.get("/messaging/contact", (c) => c.json<MessagingContactDTO>(contactInfo(c.env, "JOIN")));

/* ── WhatsApp Business Cloud API webhook (Meta → Worker) ── */

/** Meta's subscription check: echo hub.challenge when hub.verify_token matches WA_VERIFY_TOKEN. */
app.get("/whatsapp/webhook", (c) => {
  const challenge = verifyChallenge(new URL(c.req.url).searchParams, readWaEnv(c.env).WA_VERIFY_TOKEN);
  if (challenge === null) return c.text("Forbidden", 403);
  return c.text(challenge, 200);
});

const isLocalHost = (url: string) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname);

/**
 * Inbound messages and delivery receipts. Signature first (HMAC-SHA256 of the raw body with
 * WA_APP_SECRET); then 200 at once and do the work in waitUntil, so Meta never times out and retries.
 */
app.post("/whatsapp/webhook", async (c) => {
  const raw = await c.req.arrayBuffer();
  const secret = readWaEnv(c.env).WA_APP_SECRET;
  if (secret) {
    if (!(await verifySignature(raw, c.req.header("X-Hub-Signature-256"), secret))) {
      throw new AppError(401, "bad_signature", "Invalid X-Hub-Signature-256");
    }
  } else if (!isLocalHost(c.req.url)) {
    // Unsigned webhooks could forge YES/STOP for any number: only allowed on localhost (dev).
    throw new AppError(503, "whatsapp_not_configured", "WA_APP_SECRET is not set");
  } else {
    console.warn("whatsapp webhook: WA_APP_SECRET unset, accepting unsigned payload on localhost");
  }
  let payload: unknown = null;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return c.text("EVENT_RECEIVED", 200);
  }
  const parsed = parseWebhook(payload);
  if (parsed.messages.length > 0 || parsed.statuses.length > 0) {
    waitUntil(c, processWebhook(c.env, parsed, { publicUrl: new URL(c.req.url).origin }).catch((err) => console.error("whatsapp webhook failed", err)));
  }
  return c.text("EVENT_RECEIVED", 200);
});

/* ── Audit ledger & demo controls ── */

app.get("/audit", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
  const before = Number(c.req.query("before")) || undefined;
  return c.json(await audit.listAudit(deps(c), { siteId: c.req.query("siteId"), before, limit }));
});
app.get("/audit/verify", async (c) => c.json(await audit.verifyAudit(deps(c))));
app.post("/demo/tamper", async (c) => c.json(await audit.tamperAudit(deps(c))));
app.post("/demo/reset", async (c) => c.json(await resetDemo(deps(c), actor(c))));

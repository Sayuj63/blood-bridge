/**
 * Meta's official WhatsApp Business Cloud API, called straight from the Worker.
 * Pure functions + an injectable fetch, so everything here is unit-tested without a network.
 *
 *   send:     POST https://graph.facebook.com/{GRAPH_VERSION}/{WA_PHONE_NUMBER_ID}/messages
 *   webhook:  GET  /api/whatsapp/webhook  (hub.challenge echo)
 *             POST /api/whatsapp/webhook  (X-Hub-Signature-256 = HMAC-SHA256(raw body, WA_APP_SECRET))
 *
 * WhatsApp rule that shapes delivery: free-form text is allowed only inside the 24 h
 * customer-service window that opens when the person messages us. Outside it, a business
 * may only send an approved template. See chooseDelivery().
 */
import { normalizePhone } from "./phone";

/** Graph API version (latest listed at developers.facebook.com/docs/graph-api/changelog/versions, Nov 2026). */
export const GRAPH_VERSION = "v26.0";
export const GRAPH_BASE = "https://graph.facebook.com";

/** gatewayId the in-Worker sender claims outbox rows under (shows as "gateway:cloud-api" in the ledger). */
export const CLOUD_GATEWAY_ID = "cloud-api";

/** Every new Cloud API test number ships with this approved template. */
export const DEFAULT_TEMPLATE = { name: "hello_world", language: "en_US" } as const;

/** WhatsApp's customer-service window. */
export const SERVICE_WINDOW_MS = 24 * 3_600_000;

/* ───────────────────────────── Config ───────────────────────────── */

/** The WA_* bindings, all optional: the app runs fine with none of them set. */
export interface WaEnv {
  WA_ACCESS_TOKEN?: string;
  WA_APP_SECRET?: string;
  WA_VERIFY_TOKEN?: string;
  WA_PHONE_NUMBER_ID?: string;
  WA_DISPLAY_NUMBER?: string;
  WA_TEMPLATE_ALERT?: string;
  WA_PROVIDER?: string;
}

export interface WaConfig {
  phoneNumberId: string;
  accessToken: string;
  template: { name: string; language: string };
}

const clean = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Read the WA_* bindings without trusting the generated Env type to mark them optional. */
export function readWaEnv(env: unknown): WaEnv {
  const e = (env ?? {}) as Record<string, unknown>;
  return {
    WA_ACCESS_TOKEN: clean(e.WA_ACCESS_TOKEN),
    WA_APP_SECRET: clean(e.WA_APP_SECRET),
    WA_VERIFY_TOKEN: clean(e.WA_VERIFY_TOKEN),
    WA_PHONE_NUMBER_ID: clean(e.WA_PHONE_NUMBER_ID),
    WA_DISPLAY_NUMBER: clean(e.WA_DISPLAY_NUMBER),
    WA_TEMPLATE_ALERT: clean(e.WA_TEMPLATE_ALERT),
    WA_PROVIDER: clean(e.WA_PROVIDER)?.toLowerCase(),
  };
}

/** "hello_world" → en_US; "blood_alert:en" or "blood_alert|en_GB" → that language. */
export function parseTemplate(raw: string | undefined): { name: string; language: string } {
  if (!raw) return { ...DEFAULT_TEMPLATE };
  const [name, language] = raw.split(/[:|]/, 2).map((s) => s.trim());
  if (!name) return { ...DEFAULT_TEMPLATE };
  return { name, language: language || (name === DEFAULT_TEMPLATE.name ? DEFAULT_TEMPLATE.language : "en") };
}

/**
 * Who delivers WhatsApp: `cloud` when the Cloud API is configured (unless WA_PROVIDER=gateway),
 * otherwise the laptop open-wa `gateway`. Exactly one of them ever sends, so nothing double-sends.
 */
export function whatsappProvider(env: unknown): "cloud" | "gateway" {
  const w = readWaEnv(env);
  const configured = Boolean(w.WA_PHONE_NUMBER_ID && w.WA_ACCESS_TOKEN);
  if (!configured) return "gateway";
  return w.WA_PROVIDER === "gateway" ? "gateway" : "cloud";
}

/** Config for sending, or null when the Cloud API is not the active WhatsApp provider. */
export function cloudConfig(env: unknown): WaConfig | null {
  if (whatsappProvider(env) !== "cloud") return null;
  const w = readWaEnv(env);
  return { phoneNumberId: w.WA_PHONE_NUMBER_ID!, accessToken: w.WA_ACCESS_TOKEN!, template: parseTemplate(w.WA_TEMPLATE_ALERT) };
}

/** Public click-to-chat details from WA_DISPLAY_NUMBER, or nulls when unset/invalid. */
export function contactInfo(env: unknown, text = "JOIN"): { whatsappNumber: string | null; waLink: string | null } {
  const raw = readWaEnv(env).WA_DISPLAY_NUMBER;
  const e164 = raw ? displayNumberToE164(raw) : null;
  if (!e164) return { whatsappNumber: null, waLink: null };
  return { whatsappNumber: e164, waLink: waLink(e164, text) };
}

/** "+1 555 010 2030", "15550102030" (country code, no +) or a 10-digit Indian mobile → E.164. */
export function displayNumberToE164(raw: string): string | null {
  const t = raw.trim();
  if (t.startsWith("+") || t.startsWith("00")) return normalizePhone(t);
  const digits = t.replace(/\D/g, "");
  return digits.length === 10 ? normalizePhone(digits) : normalizePhone(`+${digits}`);
}

/** https://wa.me/<digits>?text=… (digits only, no +, per WhatsApp's click-to-chat spec). */
export const waLink = (e164: string, text: string): string => `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

/* ───────────────────────────── Window vs template ───────────────────────────── */

export type DeliveryMode = "text" | "template" | "await_reply" | "expired";

/**
 * The one decision the 24 h rule forces on every outbound WhatsApp message.
 *  - person messaged us within 24 h           → free-form `text`
 *  - outside the window, no template sent yet → `template` (business-initiated opener), hold the text
 *  - template already sent, still no reply    → `await_reply` until the hold lapses, then `expired`
 */
export function chooseDelivery(args: {
  lastInboundAt: number | null | undefined;
  templateSentAt: number | null | undefined;
  now: number;
  windowMs?: number;
  /** How long a held message waits for a reply after its template. */
  holdMs?: number;
}): DeliveryMode {
  const windowMs = args.windowMs ?? SERVICE_WINDOW_MS;
  const holdMs = args.holdMs ?? SERVICE_WINDOW_MS;
  const { lastInboundAt, templateSentAt, now } = args;
  if (lastInboundAt != null && now - lastInboundAt < windowMs) return "text";
  if (templateSentAt == null) return "template";
  return now - templateSentAt < holdMs ? "await_reply" : "expired";
}

/* ───────────────────────────── Sending ───────────────────────────── */

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** A failed Graph call. `retryable: false` = don't try this message again. */
export class CloudSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code: number | null,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "CloudSendError";
  }
  /** 131047: more than 24 h since the user last replied; only a template will go through. */
  get outsideWindow(): boolean {
    return this.code === 131047;
  }
}

/** Throttling, transient and unknown codes: worth retrying with backoff. */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 341, 80007, 130429, 131000, 131016, 131049, 131056, 133004]);
/** Request, permission, token, recipient and template problems: retrying won't help. */
const PERMANENT_CODES = new Set([
  0, 3, 10, 100, 190, 200, 368, 131005, 131008, 131009, 131021, 131026, 131030, 131031, 131042, 131045, 131047, 131048, 131051, 131052, 132000,
  132001, 132005, 132007, 132012, 132015, 132016, 133010,
]);

/** Map a Graph error to retryable/permanent. Code wins; HTTP status decides unknown codes. */
export function isRetryableGraphError(httpStatus: number, code: number | null): boolean {
  if (code !== null && RETRYABLE_CODES.has(code)) return true;
  if (code !== null && PERMANENT_CODES.has(code)) return false;
  if (httpStatus === 429 || httpStatus >= 500 || httpStatus === 0) return true;
  return false;
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string }; fbtrace_id?: string };
}

/** Graph wants the recipient as digits; E.164 "+91…" → "91…". */
const toGraphRecipient = (e164: string) => e164.replace(/\D/g, "");

async function postMessage(cfg: WaConfig, payload: Record<string, unknown>, fetchImpl: FetchLike, timeoutMs: number): Promise<{ providerMessageId: string }> {
  const url = `${GRAPH_BASE}/${GRAPH_VERSION}/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Network error or timeout: the message may or may not have left; at-least-once, so retry.
    throw new CloudSendError(`network: ${err instanceof Error ? err.message : String(err)}`, true, null, 0);
  }
  const data = (await res.json().catch(() => ({}))) as GraphErrorBody & { messages?: { id?: string }[] };
  if (!res.ok || data.error) {
    const code = typeof data.error?.code === "number" ? data.error.code : null;
    const detail = data.error?.error_data?.details ?? data.error?.message ?? `HTTP ${res.status}`;
    throw new CloudSendError(`graph ${code ?? res.status}: ${detail}`, isRetryableGraphError(res.status, code), code, res.status);
  }
  const id = data.messages?.[0]?.id;
  if (!id) throw new CloudSendError("graph: response had no message id", true, null, res.status);
  return { providerMessageId: id };
}

export function sendText(cfg: WaConfig, to: string, body: string, fetchImpl: FetchLike = fetch, timeoutMs = 8_000) {
  return postMessage(cfg, { to: toGraphRecipient(to), type: "text", text: { preview_url: false, body } }, fetchImpl, timeoutMs);
}

export function sendTemplate(cfg: WaConfig, to: string, fetchImpl: FetchLike = fetch, timeoutMs = 8_000) {
  return postMessage(
    cfg,
    { to: toGraphRecipient(to), type: "template", template: { name: cfg.template.name, language: { code: cfg.template.language } } },
    fetchImpl,
    timeoutMs,
  );
}

/* ───────────────────────────── Webhook ───────────────────────────── */

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Verify X-Hub-Signature-256 ("sha256=<hex>") over the exact raw body bytes.
 * The hex digests are compared in constant time.
 */
export async function verifySignature(rawBody: string | ArrayBuffer, header: string | null | undefined, appSecret: string): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const presented = header.slice(7).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(presented)) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = typeof rawBody === "string" ? enc.encode(rawBody) : new Uint8Array(rawBody);
  const expected = hex(await crypto.subtle.sign("HMAC", key, bytes));
  return constantTimeEqual(presented, expected);
}

/** Length-independent constant-time string compare (no early exit on the first difference). */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** GET verification: echo hub.challenge only for a subscribe with the right token. */
export function verifyChallenge(params: URLSearchParams, verifyToken: string | undefined): string | null {
  if (!verifyToken) return null;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || challenge === null) return null;
  return constantTimeEqual(token, verifyToken) ? challenge : null;
}

export interface WebhookInbound {
  /** E.164, from wa_id / from. */
  from: string;
  messageId: string;
  text: string;
  at: number;
  kind: "text" | "button" | "interactive" | "other";
}

export interface WebhookStatus {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  at: number;
  error: string | null;
  errorCode: number | null;
}

export interface ParsedWebhook {
  messages: WebhookInbound[];
  statuses: WebhookStatus[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const tsMs = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n * 1000 : fallback;
};

/**
 * Pull inbound messages and delivery statuses out of a Cloud API webhook.
 * Shape: { object: "whatsapp_business_account", entry[].changes[].value.{messages[], statuses[], contacts[]} }.
 * Text and button replies become bot text; other types (image, location…) are skipped.
 */
export function parseWebhook(payload: unknown, now = Date.now()): ParsedWebhook {
  const out: ParsedWebhook = { messages: [], statuses: [] };
  const root = obj(payload);
  if (!root || root.object !== "whatsapp_business_account") return out;
  for (const entry of arr(root.entry)) {
    for (const change of arr(obj(entry)?.changes)) {
      const value = obj(obj(change)?.value);
      if (!value) continue;
      const contacts = arr(value.contacts).map(obj).filter((c): c is Json => c !== null);
      for (const m of arr(value.messages).map(obj)) {
        if (!m) continue;
        const id = str(m.id);
        const fromRaw = str(m.from) ?? str(contacts[0]?.wa_id);
        const from = fromRaw ? normalizePhone(`+${fromRaw.replace(/^\+/, "")}`) : null;
        if (!id || !from) continue;
        const type = str(m.type);
        let text: string | null = null;
        let kind: WebhookInbound["kind"] = "other";
        if (type === "text") {
          text = str(obj(m.text)?.body);
          kind = "text";
        } else if (type === "button") {
          // Quick-reply button on a template: payload defaults to the label.
          const b = obj(m.button);
          text = str(b?.text)?.trim() || str(b?.payload);
          kind = "button";
        } else if (type === "interactive") {
          const i = obj(m.interactive);
          const reply = obj(i?.button_reply) ?? obj(i?.list_reply);
          // Prefer the visible title ("YES"); fall back to the id we set when sending.
          text = str(reply?.title)?.trim() || str(reply?.id);
          kind = "interactive";
        }
        if (text === null || !text.trim()) continue;
        out.messages.push({ from, messageId: id, text: text.slice(0, 2000), at: tsMs(m.timestamp, now), kind });
      }
      for (const s of arr(value.statuses).map(obj)) {
        if (!s) continue;
        const id = str(s.id);
        const status = str(s.status);
        if (!id || (status !== "sent" && status !== "delivered" && status !== "read" && status !== "failed")) continue;
        const err = obj(arr(s.errors)[0]);
        const code = typeof err?.code === "number" ? err.code : null;
        const detail = str(obj(err?.error_data)?.details) ?? str(err?.title) ?? str(err?.message);
        out.statuses.push({
          providerMessageId: id,
          status,
          at: tsMs(s.timestamp, now),
          error: status === "failed" ? `graph ${code ?? "?"}: ${detail ?? "delivery failed"}` : null,
          errorCode: code,
        });
      }
    }
  }
  return out;
}

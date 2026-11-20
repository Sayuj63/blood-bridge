import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseJoinCode } from "../src/worker/messaging/parse";
import {
  chooseDelivery,
  cloudConfig,
  CloudSendError,
  constantTimeEqual,
  contactInfo,
  GRAPH_VERSION,
  isRetryableGraphError,
  parseTemplate,
  parseWebhook,
  sendTemplate,
  sendText,
  verifyChallenge,
  verifySignature,
  whatsappProvider,
  type FetchLike,
  type WaConfig,
} from "../src/worker/messaging/whatsapp-cloud";

const SECRET = "test-app-secret-0123456789";
const sign = (body: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;

/* ───────────────────────────── Signature ───────────────────────────── */

describe("X-Hub-Signature-256 verification", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [] }], note: "नमस्ते ✓" });

  it("accepts the HMAC-SHA256 of the raw body with the app secret", async () => {
    expect(await verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("accepts the raw ArrayBuffer (what the Worker actually reads)", async () => {
    const buf = new TextEncoder().encode(body).buffer as ArrayBuffer;
    expect(await verifySignature(buf, sign(body), SECRET)).toBe(true);
  });

  it("accepts an upper-case hex digest", async () => {
    expect(await verifySignature(body, `sha256=${sign(body).slice(7).toUpperCase()}`, SECRET)).toBe(true);
  });

  it("rejects a tampered body, the wrong secret, and malformed or missing headers", async () => {
    expect(await verifySignature(body.replace("1", "2"), sign(body), SECRET)).toBe(false);
    expect(await verifySignature(body, sign(body, "another-secret"), SECRET)).toBe(false);
    expect(await verifySignature(body, sign(body).replace("sha256=", "sha1="), SECRET)).toBe(false);
    expect(await verifySignature(body, "sha256=deadbeef", SECRET)).toBe(false);
    expect(await verifySignature(body, null, SECRET)).toBe(false);
    expect(await verifySignature(body, undefined, SECRET)).toBe(false);
  });

  it("compares in constant time regardless of length", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("GET verification (hub.challenge)", () => {
  const q = (o: Record<string, string>) => new URLSearchParams(o);
  it("echoes the challenge for subscribe + matching token", () => {
    expect(verifyChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "1158201444" }), "tok")).toBe("1158201444");
  });
  it("refuses a wrong token, wrong mode, missing challenge, or no token configured", () => {
    expect(verifyChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1" }), "tok")).toBeNull();
    expect(verifyChallenge(q({ "hub.mode": "unsubscribe", "hub.verify_token": "tok", "hub.challenge": "1" }), "tok")).toBeNull();
    expect(verifyChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "tok" }), "tok")).toBeNull();
    expect(verifyChallenge(q({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), undefined)).toBeNull();
  });
});

/* ───────────────────────────── Webhook parsing ───────────────────────────── */

const envelope = (value: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "102290129340398",
      changes: [
        {
          field: "messages",
          value: { messaging_product: "whatsapp", metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" }, ...value },
        },
      ],
    },
  ],
});

describe("webhook payload parsing", () => {
  it("parses an inbound text message into the bot's shape (E.164 from wa_id)", () => {
    const p = parseWebhook(
      envelope({
        contacts: [{ profile: { name: "Sheena" }, wa_id: "919820012345" }],
        messages: [{ from: "919820012345", id: "wamid.TEXT1", timestamp: "1749416383", type: "text", text: { body: "need 2 O- platelets near Sion" } }],
      }),
    );
    expect(p.messages).toEqual([{ from: "+919820012345", messageId: "wamid.TEXT1", text: "need 2 O- platelets near Sion", at: 1749416383000, kind: "text" }]);
    expect(p.statuses).toEqual([]);
  });

  it("parses interactive button and list replies (title first, id as fallback)", () => {
    const p = parseWebhook(
      envelope({
        messages: [
          { from: "16505551234", id: "wamid.BTN", timestamp: "1750025136", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "alert-yes", title: "YES" } } },
          { from: "16505551234", id: "wamid.LIST", timestamp: "1750025137", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "lang-hi", title: "", description: "Hindi" } } },
        ],
      }),
    );
    expect(p.messages.map((m) => [m.messageId, m.text, m.kind, m.from])).toEqual([
      ["wamid.BTN", "YES", "interactive", "+16505551234"],
      ["wamid.LIST", "lang-hi", "interactive", "+16505551234"],
    ]);
  });

  it("parses a template quick-reply button (type: button)", () => {
    const p = parseWebhook(envelope({ messages: [{ from: "919820012345", id: "wamid.QR", timestamp: "1", type: "button", button: { text: "Yes, I can come", payload: "Yes, I can come" } }] }));
    expect(p.messages[0]).toMatchObject({ text: "Yes, I can come", kind: "button" });
  });

  it("falls back to contacts[].wa_id when from is missing, and skips media and malformed messages", () => {
    const p = parseWebhook(
      envelope({
        contacts: [{ wa_id: "919820012345" }],
        messages: [
          { id: "wamid.NOFROM", timestamp: "1", type: "text", text: { body: "STOP" } },
          { from: "919820012345", id: "wamid.IMG", timestamp: "1", type: "image", image: { id: "123" } },
          { from: "919820012345", timestamp: "1", type: "text", text: { body: "no id" } },
          { from: "919820012345", id: "wamid.EMPTY", timestamp: "1", type: "text", text: { body: "   " } },
        ],
      }),
      NOW,
    );
    expect(p.messages.map((m) => [m.messageId, m.from, m.text])).toEqual([["wamid.NOFROM", "+919820012345", "STOP"]]);
  });

  it("parses delivery statuses, including a failed one with its error code", () => {
    const p = parseWebhook(
      envelope({
        statuses: [
          { id: "wamid.OUT1", status: "sent", timestamp: "1750263770", recipient_id: "919820012345" },
          { id: "wamid.OUT1", status: "delivered", timestamp: "1750263773", recipient_id: "919820012345" },
          { id: "wamid.OUT1", status: "read", timestamp: "1750263780", recipient_id: "919820012345" },
          {
            id: "wamid.OUT2",
            status: "failed",
            timestamp: "1751142888",
            recipient_id: "919820012345",
            errors: [{ code: 131047, title: "Re-engagement message", error_data: { details: "Message failed to send because more than 24 hours have passed" } }],
          },
          { id: "wamid.OUT3", status: "played", timestamp: "1" },
        ],
      }),
    );
    expect(p.statuses.map((s) => [s.providerMessageId, s.status, s.errorCode])).toEqual([
      ["wamid.OUT1", "sent", null],
      ["wamid.OUT1", "delivered", null],
      ["wamid.OUT1", "read", null],
      ["wamid.OUT2", "failed", 131047],
    ]);
    expect(p.statuses[3].error).toContain("131047");
    expect(p.statuses[3].error).toContain("24 hours");
    expect(p.statuses[1].at).toBe(1750263773000);
  });

  it("ignores anything that isn't a WhatsApp Business Account webhook", () => {
    expect(parseWebhook({ object: "page", entry: [] })).toEqual({ messages: [], statuses: [] });
    expect(parseWebhook(null)).toEqual({ messages: [], statuses: [] });
    expect(parseWebhook("nonsense")).toEqual({ messages: [], statuses: [] });
  });
});

/* ───────────────────────────── Window vs template ───────────────────────────── */

describe("24 h window vs template decision", () => {
  it("sends free-form text inside the window", () => {
    expect(chooseDelivery({ lastInboundAt: NOW - 2 * HOUR, templateSentAt: null, now: NOW })).toBe("text");
    expect(chooseDelivery({ lastInboundAt: NOW - 24 * HOUR + 1, templateSentAt: null, now: NOW })).toBe("text");
  });

  it("sends a template when the person never messaged or the window has closed", () => {
    expect(chooseDelivery({ lastInboundAt: null, templateSentAt: null, now: NOW })).toBe("template");
    expect(chooseDelivery({ lastInboundAt: undefined, templateSentAt: null, now: NOW })).toBe("template");
    expect(chooseDelivery({ lastInboundAt: NOW - 24 * HOUR, templateSentAt: null, now: NOW })).toBe("template");
    expect(chooseDelivery({ lastInboundAt: NOW - 3 * 24 * HOUR, templateSentAt: null, now: NOW })).toBe("template");
  });

  it("holds the text after a template until they reply, then gives up", () => {
    expect(chooseDelivery({ lastInboundAt: null, templateSentAt: NOW - HOUR, now: NOW })).toBe("await_reply");
    expect(chooseDelivery({ lastInboundAt: null, templateSentAt: NOW - 25 * HOUR, now: NOW })).toBe("expired");
  });

  it("sends the held text as soon as a reply reopens the window", () => {
    expect(chooseDelivery({ lastInboundAt: NOW - 1000, templateSentAt: NOW - HOUR, now: NOW })).toBe("text");
  });
});

/* ───────────────────────────── Graph calls (mocked fetch) ───────────────────────────── */

const CFG: WaConfig = { phoneNumberId: "106540352242922", accessToken: "EAAG-test-token", template: { name: "hello_world", language: "en_US" } };

function mockFetch(status: number, body: unknown) {
  return vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("Graph API sender", () => {
  it("POSTs a text message to /{version}/{phone-number-id}/messages with the Bearer token", async () => {
    const f = mockFetch(200, { messaging_product: "whatsapp", contacts: [{ input: "919820012345", wa_id: "919820012345" }], messages: [{ id: "wamid.SENT" }] });
    const r = await sendText(CFG, "+919820012345", "Hello *donor*", f);
    expect(r).toEqual({ providerMessageId: "wamid.SENT" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`https://graph.facebook.com/${GRAPH_VERSION}/106540352242922/messages`);
    expect(GRAPH_VERSION).toMatch(/^v\d+\.0$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer EAAG-test-token");
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919820012345",
      type: "text",
      text: { preview_url: false, body: "Hello *donor*" },
    });
  });

  it("sends the configured template (hello_world / en_US by default)", async () => {
    const f = mockFetch(200, { messages: [{ id: "wamid.TPL" }] });
    await sendTemplate(CFG, "+919820012345", f);
    expect(JSON.parse(f.mock.calls[0][1].body as string)).toMatchObject({
      to: "919820012345",
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    });
  });

  it("maps 131047 (outside the 24 h window) to a permanent error flagged outsideWindow", async () => {
    const f = mockFetch(400, { error: { message: "(#131047) Re-engagement message", code: 131047, error_data: { details: "more than 24 hours" } } });
    const err = await sendText(CFG, "+919820012345", "hi", f).catch((e) => e);
    expect(err).toBeInstanceOf(CloudSendError);
    expect(err.retryable).toBe(false);
    expect(err.outsideWindow).toBe(true);
    expect(err.code).toBe(131047);
  });

  it("maps throttling and server errors to retryable, token and recipient errors to permanent", async () => {
    const throttled = await sendText(CFG, "+919820012345", "hi", mockFetch(400, { error: { code: 130429, message: "throughput" } })).catch((e) => e);
    expect(throttled.retryable).toBe(true);
    const server = await sendText(CFG, "+919820012345", "hi", mockFetch(503, {})).catch((e) => e);
    expect(server.retryable).toBe(true);
    const token = await sendText(CFG, "+919820012345", "hi", mockFetch(401, { error: { code: 190, message: "expired" } })).catch((e) => e);
    expect(token.retryable).toBe(false);
    const notOnWa = await sendText(CFG, "+919820012345", "hi", mockFetch(400, { error: { code: 131026, message: "undeliverable" } })).catch((e) => e);
    expect(notOnWa.retryable).toBe(false);
  });

  it("treats a network failure as retryable", async () => {
    const f = vi.fn<FetchLike>(async () => {
      throw new TypeError("fetch failed");
    });
    const err = await sendText(CFG, "+919820012345", "hi", f).catch((e) => e);
    expect(err).toBeInstanceOf(CloudSendError);
    expect(err.retryable).toBe(true);
  });

  it("classifies codes before HTTP status", () => {
    expect(isRetryableGraphError(400, 131056)).toBe(true);
    expect(isRetryableGraphError(500, 100)).toBe(false);
    expect(isRetryableGraphError(429, null)).toBe(true);
    expect(isRetryableGraphError(400, null)).toBe(false);
    expect(isRetryableGraphError(400, 999_999)).toBe(false);
  });
});

/* ───────────────────────────── Config & click-to-chat ───────────────────────────── */

describe("provider selection and config", () => {
  const full = { WA_PHONE_NUMBER_ID: "106540352242922", WA_ACCESS_TOKEN: "EAAG" };
  it("uses the gateway until both phone number id and token are set", () => {
    expect(whatsappProvider({})).toBe("gateway");
    expect(whatsappProvider({ WA_PHONE_NUMBER_ID: "1" })).toBe("gateway");
    expect(whatsappProvider({ ...full, WA_ACCESS_TOKEN: "  " })).toBe("gateway");
    expect(cloudConfig({})).toBeNull();
  });
  it("defaults to cloud when configured; WA_PROVIDER=gateway keeps the laptop sender", () => {
    expect(whatsappProvider(full)).toBe("cloud");
    expect(whatsappProvider({ ...full, WA_PROVIDER: "cloud" })).toBe("cloud");
    expect(whatsappProvider({ ...full, WA_PROVIDER: "GATEWAY" })).toBe("gateway");
    expect(cloudConfig({ ...full, WA_PROVIDER: "gateway" })).toBeNull();
    expect(cloudConfig(full)).toEqual({ phoneNumberId: "106540352242922", accessToken: "EAAG", template: { name: "hello_world", language: "en_US" } });
  });
  it("parses WA_TEMPLATE_ALERT as name[:language]", () => {
    expect(parseTemplate(undefined)).toEqual({ name: "hello_world", language: "en_US" });
    expect(parseTemplate("blood_alert:en")).toEqual({ name: "blood_alert", language: "en" });
    expect(parseTemplate("blood_alert|hi")).toEqual({ name: "blood_alert", language: "hi" });
    expect(parseTemplate("blood_alert")).toEqual({ name: "blood_alert", language: "en" });
  });
  it("builds the public wa.me link from WA_DISPLAY_NUMBER", () => {
    expect(contactInfo({})).toEqual({ whatsappNumber: null, waLink: null });
    expect(contactInfo({ WA_DISPLAY_NUMBER: "+1 555 010 2030" })).toEqual({ whatsappNumber: "+15550102030", waLink: "https://wa.me/15550102030?text=JOIN" });
    expect(contactInfo({ WA_DISPLAY_NUMBER: "15550102030" }).whatsappNumber).toBe("+15550102030");
    expect(contactInfo({ WA_DISPLAY_NUMBER: "98200 12345" }).whatsappNumber).toBe("+919820012345");
    expect(contactInfo({ WA_DISPLAY_NUMBER: "+15550102030" }, "JOIN K7Q2M9").waLink).toBe("https://wa.me/15550102030?text=JOIN%20K7Q2M9");
  });
});

describe("JOIN <code> from click-to-chat", () => {
  it.each([
    ["JOIN K7Q2M9", "K7Q2M9"],
    ["join k7q2m9", "K7Q2M9"],
    ["  Join: K7Q2M9. ", "K7Q2M9"],
  ])("%s → %s", (text, code) => expect(parseJoinCode(text)).toBe(code));
  it.each(["JOIN", "join now", "JOIN K7Q2M", "JOIN K7Q2M9X", "please JOIN K7Q2M9", "JOIN HELLO1"])("ignores %s", (text) =>
    expect(parseJoinCode(text)).toBeNull(),
  );
});

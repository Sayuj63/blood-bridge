/**
 * SMS through SMS Gateway for Android (https://sms-gate.app, open source): an Android
 * phone with a SIM becomes an SMS API.
 *
 *  - Outbound: the `android-sms-gateway` client, in cloud mode (api.sms-gate.app relays to
 *    the phone) or local mode (the phone's own HTTP server on your LAN). Both outbound-only.
 *  - Inbound: the app POSTs `sms:received` webhooks. We listen on SMS_WEBHOOK_PORT; in local
 *    mode the phone reaches this laptop over the LAN, in cloud mode the URL must be public.
 *    Webhooks are HMAC-verified when SMS_WEBHOOK_SIGNING_KEY is set.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import Client, { WebHookEventType } from "android-sms-gateway";

type SmsClient = InstanceType<typeof Client>;
import type { Logger } from "../log.ts";
import { BaseAdapter, SendError, type AdapterHooks, type OutboundMessage, type SendResult } from "./types.ts";

export interface SmsAndroidOptions {
  mode: "cloud" | "local";
  username: string;
  password: string;
  baseUrl: string;
  simNumber?: number;
  webhookPort: number;
  webhookPublicUrl?: string;
  signingKey?: string;
}

const WEBHOOK_PATH = "/sms/webhook";
const WEBHOOK_ID = "blood-bridge-sms-received";
const MAX_WEBHOOK_BYTES = 64 * 1024;
const SIGNATURE_MAX_AGE_S = 300;
const HEALTH_RETRY_MS = 30_000;

export class SmsAndroidGatewayAdapter extends BaseAdapter {
  readonly name: string;
  readonly channel = "sms" as const;
  private readonly client: SmsClient;
  private server: Server | null = null;
  private healthTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly opts: SmsAndroidOptions,
    private readonly log: Logger,
  ) {
    super();
    this.name = `sms-gate-${opts.mode}`;
    this.client = new Client(opts.username, opts.password, undefined, opts.baseUrl);
  }

  async start(hooks: AdapterHooks): Promise<void> {
    this.hooks = hooks;
    this.setState("starting", `connecting to SMS gateway (${this.opts.mode})`);
    if (this.opts.webhookPort > 0) await this.listen();
    void this.checkHealth();
  }

  private async checkHealth(): Promise<void> {
    try {
      const health = await this.client.getHealth();
      const status = (health as { status?: string }).status ?? "pass";
      if (status === "fail") throw new Error("gateway health check failed");
      this.setState("online", `SMS gateway ${this.opts.mode} mode`);
      if (this.opts.webhookPublicUrl) await this.registerWebhook();
    } catch (err) {
      this.log.warn("sms: gateway unreachable, retrying", { error: err as Error, retryInMs: HEALTH_RETRY_MS });
      this.setState("offline", "SMS gateway unreachable");
      this.healthTimer = setTimeout(() => void this.checkHealth(), HEALTH_RETRY_MS);
    }
  }

  private async registerWebhook(): Promise<void> {
    try {
      await this.client.registerWebhook({ id: WEBHOOK_ID, event: WebHookEventType.SmsReceived, url: this.opts.webhookPublicUrl! });
      this.log.info("sms: inbound webhook registered", { url: this.opts.webhookPublicUrl });
    } catch (err) {
      this.log.warn("sms: could not register inbound webhook (register it in the app instead)", { error: err as Error });
    }
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (this.state !== "online") throw new SendError("SMS gateway is not reachable", true);
    try {
      const state = await this.client.send({
        // The outbox id doubles as the SMS gateway's message id, so a retried send can't double-deliver.
        id: message.id,
        phoneNumbers: [message.to],
        textMessage: { text: message.body },
        simNumber: this.opts.simNumber ?? null,
        ttl: 3600,
      });
      return { providerMessageId: state.id };
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const status = Number(/HTTP error (\d{3})/.exec(msg)?.[1] ?? 0);
      // 409: this id was already accepted earlier, i.e. a retry of a send that went through.
      if (status === 409) return { providerMessageId: message.id };
      // Other 4xx are permanent (bad number, bad request); 5xx, 429 and network errors are worth retrying.
      throw new SendError(msg, status === 0 || status === 429 || status >= 500);
    }
  }

  async stop(): Promise<void> {
    if (this.healthTimer) clearTimeout(this.healthTimer);
    await new Promise<void>((done) => (this.server ? this.server.close(() => done()) : done()));
    this.server = null;
    this.setState("offline", "stopped");
  }

  /* ── Inbound webhooks ── */

  private listen(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.onWebhook(req)
        .then((status) => {
          res.writeHead(status, { "Content-Type": "text/plain" }).end(status === 200 ? "ok" : "rejected");
        })
        .catch((err: Error) => {
          this.log.warn("sms: webhook error", { error: err });
          res.writeHead(500).end();
        });
    });
    return new Promise((resolveListen, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.opts.webhookPort, () => {
        this.log.info("sms: webhook listener ready", { port: this.opts.webhookPort, path: WEBHOOK_PATH, signed: Boolean(this.opts.signingKey) });
        resolveListen();
      });
    });
  }

  private async onWebhook(req: IncomingMessage): Promise<number> {
    if (req.method !== "POST" || req.url?.split("?")[0] !== WEBHOOK_PATH) return 404;
    const raw = await readBody(req);
    if (raw === null) return 413;
    if (this.opts.signingKey && !verifySignature(raw, req.headers, this.opts.signingKey)) {
      this.log.warn("sms: rejected webhook with bad or missing signature");
      return 401;
    }
    let event: { event?: string; payload?: { messageId?: string; phoneNumber?: string; sender?: string; message?: string; receivedAt?: string } };
    try {
      event = JSON.parse(raw);
    } catch {
      return 400;
    }
    if (event.event !== WebHookEventType.SmsReceived) return 200; // acknowledged, not for us
    const p = event.payload ?? {};
    const from = p.sender ?? p.phoneNumber;
    if (!from || !p.message || !p.messageId) return 400;
    this.hooks?.onInbound({
      channel: "sms",
      from,
      text: p.message.slice(0, 2000),
      messageId: p.messageId,
      at: p.receivedAt ? Date.parse(p.receivedAt) || Date.now() : Date.now(),
    });
    return 200;
  }
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_WEBHOOK_BYTES) {
        req.destroy();
        resolveBody(null);
      } else chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** SMS Gate signs `body + X-Timestamp` with HMAC-SHA256 (hex) in X-Signature. */
function verifySignature(raw: string, headers: IncomingMessage["headers"], key: string): boolean {
  const signature = String(headers["x-signature"] ?? "");
  const timestamp = String(headers["x-timestamp"] ?? "");
  if (!signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_MAX_AGE_S) return false;
  const expected = createHmac("sha256", key).update(raw + timestamp).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

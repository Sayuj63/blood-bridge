/**
 * WhatsApp through open-wa: a real WhatsApp Web session in headless Chrome.
 *
 * UNOFFICIAL and against WhatsApp's Terms of Service: use a spare number. Production
 * swaps this class for a WhatsApp Business Cloud API adapter behind the same interface.
 *
 * First run prints a QR code in the terminal (WhatsApp → Linked devices → Link a device).
 * The session is persisted under WA_SESSION_DIR, so later runs reconnect without a scan.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { create, createConsoleOutputSink, setCliOutputSink, type Client } from "@open-wa/wa-automate";
import type { Logger } from "../log.ts";
import { BaseAdapter, SendError, type AdapterHooks, type OutboundMessage, type SendResult } from "./types.ts";

export interface WhatsAppOpenWaOptions {
  sessionId: string;
  sessionDir: string;
  headless: boolean;
  groups: boolean;
  chromePath?: string;
}

/** The subset of open-wa's Message we rely on (kept loose: open-wa's types move between releases). */
interface WaMessage {
  id: string;
  body?: string;
  type?: string;
  from?: string;
  chatId?: string;
  author?: string;
  fromMe?: boolean;
  isGroupMsg?: boolean;
  t?: number;
  sender?: { id?: string };
}

const PERMANENT = /not a whatsapp user|not on whatsapp|invalid (wid|number|chat)|no lid for user|phone number is not registered/i;

export class WhatsAppOpenWaAdapter extends BaseAdapter {
  readonly name = "open-wa";
  readonly channel = "whatsapp" as const;
  private client: Client | null = null;
  private stopping = false;

  constructor(
    private readonly opts: WhatsAppOpenWaOptions,
    private readonly log: Logger,
  ) {
    super();
  }

  async start(hooks: AdapterHooks): Promise<void> {
    this.hooks = hooks;
    const sessionDataPath = resolve(this.opts.sessionDir);
    mkdirSync(sessionDataPath, { recursive: true, mode: 0o700 });
    this.installOutputSink();
    this.setState("starting", "launching WhatsApp Web");

    // create() resolves only once logged in (possibly after a QR scan), so it runs in the background.
    void create({
      sessionId: this.opts.sessionId,
      sessionDataPath,
      headless: this.opts.headless,
      multiDevice: true,
      qrTimeout: 0,
      authTimeout: 0,
      qrLogSkip: false,
      popup: false,
      disableSpins: true,
      logConsole: false,
      killProcessOnBrowserClose: false,
      skipUpdateCheck: true,
      ...(this.opts.chromePath ? { executablePath: this.opts.chromePath, useChrome: true } : {}),
    })
      .then((client) => this.onReady(client))
      .catch((err: Error) => {
        if (this.stopping) return;
        this.log.error("whatsapp: failed to start", { error: err });
        this.setState("offline", `start failed: ${err.message.slice(0, 120)}`);
      });
  }

  private onReady(client: Client): void {
    if (this.stopping) {
      void client.stop("gateway-shutdown");
      return;
    }
    this.client = client;
    this.setState("online", "WhatsApp Web connected");
    this.log.info("whatsapp: session ready");

    client.onStateChanged((state) => {
      this.log.info("whatsapp: state changed", { state });
      if (state === "READY") this.setState("online", "WhatsApp Web connected");
      else if (state === "DISCONNECTED" || state === "STOPPED") this.setState("offline", `WhatsApp ${state.toLowerCase()}`);
      else this.setState("starting", `WhatsApp ${state.toLowerCase()}`);
    });

    client.onMessage((raw) => {
      const m = raw as unknown as WaMessage;
      try {
        this.handleMessage(m);
      } catch (err) {
        this.log.warn("whatsapp: could not handle inbound message", { error: err as Error });
      }
    });
  }

  private handleMessage(m: WaMessage): void {
    if (m.fromMe || m.type !== "chat" || !m.body?.trim()) return;
    const chat = m.chatId ?? m.from ?? "";
    if (chat === "status@broadcast") return;

    let from: string | null;
    if (m.isGroupMsg || chat.endsWith("@g.us")) {
      if (!this.opts.groups) return;
      from = chat;
    } else {
      from = toE164([m.from, m.sender?.id, m.chatId]);
    }
    if (!from) {
      // Some senders appear as privacy ids (…@lid) with no phone number; we can't route those.
      this.log.warn("whatsapp: sender has no phone number (LID); ignoring");
      return;
    }
    this.hooks?.onInbound({
      channel: "whatsapp",
      from,
      text: m.body.slice(0, 2000),
      messageId: String(m.id),
      at: m.t ? m.t * 1000 : Date.now(),
    });
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const client = this.client;
    if (!client || this.state !== "online") throw new SendError("WhatsApp is not connected", true);
    const chatId = message.to.endsWith("@g.us") ? message.to : `${message.to.replace(/^\+/, "")}@c.us`;
    try {
      const id = await client.sendText(chatId, message.body);
      if (!id || typeof id === "boolean") throw new SendError("WhatsApp did not accept the message", true);
      return { providerMessageId: String(id) };
    } catch (err) {
      if (err instanceof SendError) throw err;
      const msg = (err as Error).message ?? String(err);
      throw new SendError(msg, !PERMANENT.test(msg));
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const client = this.client;
    this.client = null;
    if (client) {
      try {
        await client.stop("gateway-shutdown");
      } catch (err) {
        this.log.warn("whatsapp: error during stop", { error: err as Error });
      }
    }
    this.setState("offline", "stopped");
  }

  /** Route open-wa's terminal output: QR to stdout (it must be seen), the rest into our structured log. */
  private installOutputSink(): void {
    const consoleSink = createConsoleOutputSink();
    setCliOutputSink({
      write: (entry) => {
        const fields = { source: "open-wa" };
        if (entry.level === "error" || entry.level === "warn") this.log.warn(entry.message, fields);
        else this.log.debug(entry.message, fields);
      },
      status: (update) => {
        if (update.phase === "auth.qr") this.setState("needs_qr", "scan the QR code in the gateway terminal");
        if (update.phase === "error") this.log.warn("whatsapp: open-wa reported an error", { detail: update.detail });
      },
      qr: (payload) => {
        this.setState("needs_qr", "scan the QR code in the gateway terminal");
        process.stdout.write("\nWhatsApp: open WhatsApp on the SPARE phone → Linked devices → Link a device, and scan:\n");
        consoleSink.qr(payload);
      },
    });
  }
}

/** First candidate that is a phone JID (…@c.us / …@s.whatsapp.net), as E.164. */
function toE164(candidates: (string | undefined)[]): string | null {
  for (const c of candidates) {
    const m = c ? /^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/.exec(c) : null;
    if (m) return `+${m[1]}`;
  }
  return null;
}

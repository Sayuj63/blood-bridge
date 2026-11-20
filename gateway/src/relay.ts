/**
 * The relay loop: the only thing that talks to the Worker.
 *
 *  poll   every POLL_INTERVAL_MS: claim pending messages for channels that are online,
 *         send each through its adapter (paced per channel), ack sent/failed.
 *         Errors back off exponentially (with jitter) up to 30 s.
 *  inbound adapters push messages here; we forward them with retries, then poll at once
 *         so the bot's reply goes out without waiting for the next tick.
 *  heartbeat every HEARTBEAT_INTERVAL_MS and on every adapter state change.
 *
 * Delivery is at-least-once with a guard: if an ack is lost and the lease expires, the
 * Worker hands the message out again; we remember recent successful sends and re-ack
 * them instead of sending twice.
 */
import { ApiError, type BloodBridgeApi, type OutboxMessage } from "./api.ts";
import type { Logger } from "./log.ts";
import { scrub } from "./log.ts";
import { SendError, type Channel, type ChannelAdapter, type InboundMessage } from "./adapters/types.ts";

export interface RelayOptions {
  gatewayId: string;
  version: string;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  sendGapMs: number;
}

const MAX_BACKOFF_MS = 30_000;
const INBOUND_RETRIES = [1_000, 3_000, 9_000, 27_000];
const SENT_MEMORY = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Relay {
  private stopping = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private polling: Promise<void> | null = null;
  private pollAgain = false;
  private failures = 0;
  private readonly lastSendAt = new Map<Channel, number>();
  /** outbox id → provider id of sends that succeeded but whose ack may not have landed. */
  private readonly recentlySent = new Map<string, string | undefined>();
  private readonly inflightInbound = new Set<Promise<void>>();

  constructor(
    private readonly api: BloodBridgeApi,
    private readonly adapters: ChannelAdapter[],
    private readonly opts: RelayOptions,
    private readonly log: Logger,
  ) {}

  async start(): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.start({
        onInbound: (m) => this.onInbound(m),
        onStateChange: (state, detail) => {
          this.log.info("channel state", { channel: adapter.channel, adapter: adapter.name, state, detail });
          if (this.stopping) return; // the final heartbeat already reported offline
          void this.heartbeat();
          if (state === "online") this.kick();
        },
      });
    }
    await this.heartbeat();
    this.heartbeatTimer = setInterval(() => void this.heartbeat(), this.opts.heartbeatIntervalMs);
    this.schedule(0);
  }

  /**
   * Graceful stop: stop claiming, report offline first (open-wa's runtime exits the process on
   * SIGINT once its own teardown finishes, so this must land early), finish the in-flight send
   * and inbound forwards, then stop adapters. Unacked claims simply return to the pool when
   * their 30 s lease lapses.
   */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    await this.heartbeat(true);
    await this.polling?.catch(() => undefined);
    await Promise.race([Promise.allSettled([...this.inflightInbound]), sleep(5_000)]);
    await Promise.allSettled(this.adapters.map((a) => a.stop()));
  }

  /* ── Heartbeat ── */

  private async heartbeat(final = false): Promise<void> {
    try {
      await this.api.heartbeat({
        gatewayId: this.opts.gatewayId,
        version: this.opts.version,
        channels: this.adapters.map((a) => ({
          channel: a.channel,
          adapter: a.name,
          state: final ? "offline" : a.state,
          ...(a.detail ? { detail: a.detail.slice(0, 200) } : {}),
        })),
      });
    } catch (err) {
      this.log.warn("heartbeat failed", { error: err as Error });
    }
  }

  /* ── Outbound ── */

  /** Poll now (e.g. right after an inbound message, so the reply isn't delayed). */
  kick(): void {
    if (this.stopping) return;
    if (this.polling) {
      this.pollAgain = true;
      return;
    }
    this.schedule(0);
  }

  private schedule(delay: number): void {
    if (this.stopping) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.polling = this.tick().finally(() => {
        this.polling = null;
        const again = this.pollAgain;
        this.pollAgain = false;
        this.schedule(again ? 0 : this.nextDelay());
      });
    }, delay);
  }

  private nextDelay(): number {
    if (this.failures === 0) return this.opts.pollIntervalMs;
    const backoff = Math.min(MAX_BACKOFF_MS, this.opts.pollIntervalMs * 2 ** this.failures);
    return Math.round(backoff * (0.8 + Math.random() * 0.4));
  }

  private async tick(): Promise<void> {
    const online = this.adapters.filter((a) => a.state === "online");
    if (online.length === 0) return;
    try {
      const { messages } = await this.api.claim({ gatewayId: this.opts.gatewayId, channels: online.map((a) => a.channel), limit: 10 });
      this.failures = 0;
      if (messages.length > 0) this.log.info("claimed messages", { count: messages.length });
      for (const m of messages) {
        if (this.stopping) break;
        await this.deliver(m);
      }
      // A full batch probably means more are waiting.
      if (messages.length >= 10) this.pollAgain = true;
    } catch (err) {
      this.failures = Math.min(this.failures + 1, 6);
      const level = err instanceof ApiError && !err.retryable ? "error" : "warn";
      this.log[level]("claim failed", { error: err as Error, failures: this.failures, status: err instanceof ApiError ? err.status : undefined });
    }
  }

  private async deliver(m: OutboxMessage): Promise<void> {
    const log = this.log.child({ outboxId: m.id, channel: m.channel, attempt: m.attempt });
    if (this.recentlySent.has(m.id)) {
      log.info("already sent; re-acknowledging without resending");
      await this.ack(m, { status: "sent", providerMessageId: this.recentlySent.get(m.id) }, log);
      return;
    }
    const adapter = this.adapters.find((a) => a.channel === m.channel && a.state === "online");
    if (!adapter) {
      await this.ack(m, { status: "failed", error: `${m.channel} went offline before sending`, retryable: true }, log);
      return;
    }
    await this.pace(m.channel);
    const started = Date.now();
    try {
      const result = await adapter.send({ id: m.id, to: m.to, body: m.body });
      this.remember(m.id, result.providerMessageId);
      log.info("sent", { to: m.to, body: m.body, ms: Date.now() - started });
      await this.ack(m, { status: "sent", providerMessageId: result.providerMessageId }, log);
    } catch (err) {
      const retryable = err instanceof SendError ? err.retryable : true;
      const error = scrub((err as Error).message ?? String(err));
      log.warn("send failed", { to: m.to, error, retryable });
      await this.ack(m, { status: "failed", error, retryable }, log);
    }
  }

  private async pace(channel: Channel): Promise<void> {
    const wait = (this.lastSendAt.get(channel) ?? 0) + this.opts.sendGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastSendAt.set(channel, Date.now());
  }

  private remember(id: string, providerId: string | undefined): void {
    this.recentlySent.set(id, providerId);
    if (this.recentlySent.size > SENT_MEMORY) this.recentlySent.delete(this.recentlySent.keys().next().value!);
  }

  private async ack(
    m: OutboxMessage,
    body: { status: "sent" | "failed"; error?: string; retryable?: boolean; providerMessageId?: string },
    log: Logger,
  ): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.api.ack(m.id, { leaseToken: m.leaseToken, ...body });
        if (res.fallbackId) log.info("worker re-queued this alert as SMS", { fallbackId: res.fallbackId });
        return;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          log.warn("ack rejected: lease expired or already acknowledged");
          return;
        }
        if (err instanceof ApiError && !err.retryable) {
          log.error("ack failed", { error: err });
          return;
        }
        await sleep(500 * 2 ** attempt);
      }
    }
    log.error("ack failed after retries; the lease will expire and the Worker will re-offer it");
  }

  /* ── Inbound ── */

  private onInbound(m: InboundMessage): void {
    if (this.stopping) return;
    const job = this.forward(m).finally(() => this.inflightInbound.delete(job));
    this.inflightInbound.add(job);
  }

  private async forward(m: InboundMessage): Promise<void> {
    const log = this.log.child({ channel: m.channel, messageId: m.messageId });
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await this.api.inbound(m);
        log.info("inbound handled", { from: m.from, text: m.text, intent: res.intent, queued: res.queued, duplicate: res.duplicate });
        if (res.queued > 0) this.kick();
        return;
      } catch (err) {
        const retryable = !(err instanceof ApiError) || err.retryable;
        if (!retryable || attempt >= INBOUND_RETRIES.length || this.stopping) {
          log.error("inbound dropped", { from: m.from, error: err as Error });
          return;
        }
        log.warn("inbound forward failed; retrying", { error: err as Error, inMs: INBOUND_RETRIES[attempt] });
        await sleep(INBOUND_RETRIES[attempt]);
      }
    }
  }
}

/**
 * One interface for every delivery channel. The relay neither knows nor cares whether a
 * message leaves through open-wa, an Android phone or the console: implement ChannelAdapter
 * and register it in main.ts. (The official WhatsApp Business Cloud API runs inside the Worker
 * instead; when it is configured the Worker stops handing WhatsApp rows to gateways.)
 */
export type Channel = "whatsapp" | "sms";
export type ChannelState = "starting" | "needs_qr" | "online" | "offline";

export interface InboundMessage {
  channel: Channel;
  /** E.164 number, or a WhatsApp group id ending in @g.us. */
  from: string;
  text: string;
  /** Provider message id: the Worker de-duplicates on it. */
  messageId: string;
  at: number;
}

export interface OutboundMessage {
  /** Outbox id: adapters that support idempotency keys should pass it through. */
  id: string;
  to: string;
  body: string;
}

export interface SendResult {
  providerMessageId?: string;
}

/** A failed send. `retryable: false` means don't try this message again (e.g. number not on WhatsApp). */
export class SendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SendError";
  }
}

export interface AdapterHooks {
  onInbound(message: InboundMessage): void;
  onStateChange(state: ChannelState, detail?: string): void;
}

export interface ChannelAdapter {
  /** Reported in heartbeats and on the dashboard, e.g. "open-wa". */
  readonly name: string;
  readonly channel: Channel;
  readonly state: ChannelState;
  readonly detail: string | undefined;
  /** Must return promptly; slow logins (QR scan) continue in the background and report via onStateChange. */
  start(hooks: AdapterHooks): Promise<void>;
  send(message: OutboundMessage): Promise<SendResult>;
  stop(): Promise<void>;
}

/** Shared state bookkeeping for adapters. */
export abstract class BaseAdapter implements ChannelAdapter {
  abstract readonly name: string;
  abstract readonly channel: Channel;
  private _state: ChannelState = "offline";
  private _detail: string | undefined;
  protected hooks: AdapterHooks | null = null;

  get state(): ChannelState {
    return this._state;
  }
  get detail(): string | undefined {
    return this._detail;
  }

  protected setState(state: ChannelState, detail?: string): void {
    if (state === this._state && detail === this._detail) return;
    this._state = state;
    this._detail = detail;
    this.hooks?.onStateChange(state, detail);
  }

  abstract start(hooks: AdapterHooks): Promise<void>;
  abstract send(message: OutboundMessage): Promise<SendResult>;
  abstract stop(): Promise<void>;
}

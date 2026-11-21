/** Typed client for the Worker's /api/gateway/* endpoints. Outbound HTTPS only. */
import type { Channel, ChannelState } from "./adapters/types.ts";

export interface OutboxMessage {
  id: string;
  channel: Channel;
  to: string;
  body: string;
  leaseToken: string;
  attempt: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
  /** Worth retrying: network failure, rate limit or server error. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export class BloodBridgeApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly version: string,
    private readonly timeoutMs = 10_000,
  ) {}

  heartbeat(body: { gatewayId: string; version: string; channels: { channel: Channel; adapter: string; state: ChannelState; detail?: string }[] }) {
    return this.post<{ ok: true }>("/api/gateway/heartbeat", body);
  }

  claim(body: { gatewayId: string; channels: Channel[]; limit: number }) {
    return this.post<{ messages: OutboxMessage[]; leaseMs: number }>("/api/gateway/outbox/claim", body);
  }

  ack(id: string, body: { leaseToken: string; status: "sent" | "failed"; error?: string; retryable?: boolean; providerMessageId?: string }) {
    return this.post<{ status: string; fallbackId?: string }>(`/api/gateway/outbox/${encodeURIComponent(id)}/ack`, body);
  }

  inbound(body: { channel: Channel; from: string; text: string; messageId: string; at: number }) {
    return this.post<{ ok: true; duplicate: boolean; intent: string; queued: number }>("/api/gateway/inbound", body);
  }

  /** Push raw e-RaktKosh rows fetched from India; reconciling 25 banks takes a few seconds. */
  eraktkosh(results: { componentCode: string; rows: string[][] }[]) {
    return this.post<{ banks: unknown[]; added: number; removed: number }>("/api/gateway/eraktkosh", { results }, 90_000);
  }

  private async post<T>(path: string, body: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": `blood-bridge-gateway/${this.version}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new ApiError(0, "network", `Can't reach Blood Bridge: ${(err as Error).message}`);
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(res.status, e?.code ?? `http_${res.status}`, e?.message ?? `HTTP ${res.status}`);
    }
    return data as T;
  }
}

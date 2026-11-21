import { getActor, msSinceLastWrite } from "./api";
/**
 * Realtime bridge: one WebSocket per document to /api/realtime.
 * Events say *what changed* (topics); we invalidate the matching React Query
 * families and every open view refetches from the API — the single source of truth.
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import type { RealtimeEvent, ServerMessage } from "../../shared/events";
import { TOPIC_INVALIDATES } from "./queryKeys";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "offline";

interface Snapshot {
  status: ConnectionStatus;
  lastEvent: RealtimeEvent | null;
  /** Most recent events, newest first (max 20) — for a live ticker. */
  recent: RealtimeEvent[];
}

const PING_MS = 25_000;
const BACKOFF_BASE_MS = 800;
const BACKOFF_MAX_MS = 15_000;
const RECENT_LIMIT = 20;

/** Decide whether an event should raise a toast in this view. */
export type ToastFilter = (event: RealtimeEvent) => boolean;

class RealtimeConnection {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private pingTimer: number | null = null;
  private retryTimer: number | null = null;
  private stopped = false;
  private snapshot: Snapshot = { status: "connecting", lastEvent: null, recent: [] };
  private listeners = new Set<() => void>();

  constructor(
    private readonly queryClient: QueryClient,
    private readonly shouldToast: () => ToastFilter | null,
  ) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): Snapshot => this.snapshot;

  private set(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  private connect(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
    this.ws = ws;
    this.set({ status: this.attempts === 0 ? "connecting" : "reconnecting" });

    ws.addEventListener("open", () => {
      const wasReconnect = this.attempts > 0;
      this.attempts = 0;
      this.set({ status: "open" });
      this.pingTimer = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, PING_MS);
      // Anything could have changed while we were away.
      if (wasReconnect) void this.queryClient.invalidateQueries();
    });

    ws.addEventListener("message", (msg) => {
      if (typeof msg.data !== "string") return;
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(msg.data) as ServerMessage;
      } catch {
        return;
      }
      if (parsed.type === "event") this.handleEvent(parsed.event);
    });

    ws.addEventListener("close", () => {
      this.clearTimers();
      if (this.stopped) return;
      this.attempts += 1;
      this.set({ status: this.attempts > 4 ? "offline" : "reconnecting" });
      const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (this.attempts - 1));
      this.retryTimer = window.setTimeout(() => this.connect(), delay * (0.75 + Math.random() * 0.5));
    });
  }

  private handleEvent(event: RealtimeEvent): void {
    const roots = new Map<string, readonly string[]>();
    for (const topic of event.topics) {
      for (const root of TOPIC_INVALIDATES[topic] ?? []) roots.set(root[0], root);
    }
    roots.forEach((queryKey) => void this.queryClient.invalidateQueries({ queryKey }));

    this.set({ lastEvent: event, recent: [event, ...this.snapshot.recent].slice(0, RECENT_LIMIT) });

    const filter = this.shouldToast();
    if (event.headline && filter?.(event)) {
      const show =
        event.tone === "critical" ? toast.error : event.tone === "warning" ? toast.warning : event.tone === "success" ? toast.success : toast.info;
      show(event.headline, { id: `rt-${event.seq}` });
    }
  }

  private clearTimers(): void {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.pingTimer = null;
    this.retryTimer = null;
  }
}

const RealtimeContext = createContext<RealtimeConnection | null>(null);

/** The echo of this tab's own action arrives within this window; its toast was already shown. */
const OWN_ACTION_ECHO_MS = 4000;

/**
 * Default: toast warnings, criticals and successes, but only
 *  - when they concern this screen (a bank or hospital sees its own site's events, a donor its own alerts;
 *    Command sees everything), and
 *  - when they are not the echo of an action this tab just took (that tab already confirmed it).
 */
const defaultToastFilter: ToastFilter = (e) => {
  if (!(e.tone === "critical" || e.tone === "warning" || e.tone === "success")) return false;
  if (msSinceLastWrite() < OWN_ACTION_ECHO_MS) return false;
  const [role, id] = getActor().split(":");
  if ((role === "bank" || role === "hospital") && e.siteIds?.length) return e.siteIds.includes(id);
  if (role === "donor" && e.donorIds?.length) return e.donorIds.includes(id);
  if (role === "donor") return false;
  return true;
};

/**
 * Mount once near the root. `toastFilter` decides which events toast in this
 * document; pass `null` to silence toasts (e.g. inside the /stage iframes host).
 */
export function RealtimeProvider({ children, toastFilter = defaultToastFilter }: { children: ReactNode; toastFilter?: ToastFilter | null }) {
  const queryClient = useQueryClient();
  const filterRef = useRef(toastFilter);
  useEffect(() => {
    filterRef.current = toastFilter;
  }, [toastFilter]);
  const connection = useMemo(() => new RealtimeConnection(queryClient, () => filterRef.current), [queryClient]);

  useEffect(() => {
    connection.start();
    return () => connection.stop();
  }, [connection]);

  return <RealtimeContext.Provider value={connection}>{children}</RealtimeContext.Provider>;
}

/** Live connection status, last event and a short recent-event list. */
export function useRealtime(): Snapshot {
  const connection = useContext(RealtimeContext);
  if (!connection) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return useSyncExternalStore(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
}

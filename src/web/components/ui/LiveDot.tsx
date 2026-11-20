import type { ConnectionStatus } from "../../lib/realtime";
import { cn } from "../../lib/cn";

const COPY: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  open: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

/** Realtime connection indicator. Green and pulsing when live. */
export function LiveDot({ status, showLabel = true, className }: { status: ConnectionStatus; showLabel?: boolean; className?: string }) {
  const color = status === "open" ? "bg-ok" : status === "offline" ? "bg-critical" : "bg-warn";
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-label text-xs text-ink-muted", className)} role="status">
      <span className="relative flex size-2.5" aria-hidden>
        {status === "open" ? <span className={cn("absolute inset-0 animate-pulse-ring rounded-full", color)} /> : null}
        <span className={cn("relative size-2.5 rounded-full", color)} />
      </span>
      <span className={showLabel ? undefined : "sr-only"}>{COPY[status]}</span>
    </span>
  );
}

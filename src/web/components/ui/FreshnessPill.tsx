import { RefreshCw } from "lucide-react";
import { POLICY } from "../../../shared/domain";
import { cn } from "../../lib/cn";
import { freshnessLabel } from "../../lib/format";
import { useNow } from "../../lib/useNow";

export interface FreshnessPillProps {
  /** Epoch ms of the last stock sync. Preferred: the pill keeps counting up live. */
  lastSyncAt?: number;
  /** Minutes since sync, if only that is known (e.g. SiteDTO.freshnessMinutes). */
  minutes?: number;
  /** Override the stale flag from the server; otherwise POLICY.staleAfterMinutes decides. */
  stale?: boolean;
  className?: string;
}

/** How fresh a site's stock is. Stale stock is flagged and must be confirmed by phone before reserving. */
export function FreshnessPill({ lastSyncAt, minutes, stale, className }: FreshnessPillProps) {
  const now = useNow(30_000);
  const mins = lastSyncAt !== undefined ? Math.max(0, (now - lastSyncAt) / 60_000) : (minutes ?? 0);
  const isStale = stale ?? mins > POLICY.staleAfterMinutes;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2 font-label text-xs",
        isStale ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-muted",
        className,
      )}
    >
      <RefreshCw className="size-3" aria-hidden />
      {freshnessLabel(mins)}
      {isStale ? <span className="font-bold">· unconfirmed</span> : null}
    </span>
  );
}

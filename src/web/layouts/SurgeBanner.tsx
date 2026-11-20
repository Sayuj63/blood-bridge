import { Siren } from "lucide-react";
import type { SurgeDTO } from "../../shared/api";
import { formatClock } from "../lib/format";
import { useNow } from "../lib/useNow";
import { cn } from "../lib/cn";

/** Red, striped banner shown on every view while a surge scenario is active. */
export function SurgeBanner({ surge, compact = false }: { surge: SurgeDTO; compact?: boolean }) {
  const now = useNow(1000);
  return (
    <div
      role="status"
      className={cn(
        "surge-stripes animate-surge-sweep relative flex items-center gap-3 overflow-hidden bg-[#c3122b] text-white",
        compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm sm:px-6",
      )}
    >
      <Siren className={cn("shrink-0 motion-safe:animate-pulse", compact ? "size-3.5" : "size-4")} aria-hidden />
      <p className="min-w-0 truncate">
        <span className="font-display mr-2 tracking-wide">Surge mode</span>
        <span className="font-semibold">{surge.label}</span>
        <span className="opacity-85"> near {surge.areaName}</span>
      </p>
      <span className="ml-auto shrink-0 font-numeric font-semibold" aria-label="Time since surge started">
        T+{formatClock(now - surge.startedAt)}
      </span>
    </div>
  );
}

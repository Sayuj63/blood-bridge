import { FlaskConical } from "lucide-react";
import { cn } from "../../lib/cn";
import { Tooltip } from "./Tooltip";

/**
 * "Simulated demo data" marker. Required on every screen: facility names and
 * locations are real open data; stock, patients and donors are simulated.
 */
export function SimulatedBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Tooltip
      side="bottom"
      content="Blood bank names and locations come from open data (OpenStreetMap, data.gov.in). Stock levels, patients and donors are simulated for this demo."
    >
      <span
        tabIndex={0}
        className={cn(
          "focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-warn/60 bg-warn-soft px-2.5 font-label text-xs text-warn",
          className,
        )}
      >
        <FlaskConical className="size-3.5" aria-hidden />
        {compact ? <span className="sr-only">Simulated demo data</span> : "Simulated demo data"}
      </span>
    </Tooltip>
  );
}

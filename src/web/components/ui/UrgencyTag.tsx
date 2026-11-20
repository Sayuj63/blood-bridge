import type { Urgency } from "../../../shared/domain";
import { cn } from "../../lib/cn";
import { Badge } from "./Badge";

const TONE: Record<Urgency, "neutral" | "warn" | "critical"> = { routine: "neutral", urgent: "warn", critical: "critical" };
const LABEL: Record<Urgency, string> = { routine: "Routine", urgent: "Urgent", critical: "Critical" };

/** Request urgency. Critical pulses so it is never missed on a busy screen. */
export function UrgencyTag({ urgency, size = "md", className }: { urgency: Urgency; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <Badge tone={TONE[urgency]} size={size} className={cn(urgency === "critical" && "font-bold", className)}>
      <span className="relative flex size-2" aria-hidden>
        {urgency === "critical" ? <span className="absolute inset-0 animate-pulse-ring rounded-full bg-current" /> : null}
        <span className="relative size-2 rounded-full bg-current" />
      </span>
      {LABEL[urgency]}
    </Badge>
  );
}

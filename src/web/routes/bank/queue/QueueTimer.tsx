import type { ReservationDTO } from "../../../../shared/api";
import { POLICY } from "../../../../shared/domain";
import { Countdown } from "../../../components/ui/Countdown";
import { cn } from "../../../lib/cn";

const SECOND = 1000;

/** The deadline that matters for the card's status: the confirm window, or the pickup hold. */
export function QueueTimer({ reservation: res, className }: { reservation: ReservationDTO; className?: string }) {
  if (res.status === "requested") {
    return (
      <span className={cn("inline-flex items-baseline gap-1 text-xs text-ink-muted", className)}>
        Auto-reroutes in
        <Countdown
          target={res.confirmBy}
          label="Auto-reroutes to the next bank in"
          doneLabel="rerouting…"
          criticalBelow={30 * SECOND}
          warnBelow={(POLICY.confirmWindowSeconds / 2) * SECOND}
          className="text-sm font-bold text-ink"
        />
      </span>
    );
  }
  if (res.status === "reserved" && res.holdExpiresAt) {
    return (
      <span className={cn("inline-flex items-baseline gap-1 text-xs text-ink-muted", className)}>
        Hold ends in
        <Countdown
          target={res.holdExpiresAt}
          label="Reserved units return to stock in"
          doneLabel="releasing…"
          warnBelow={10 * 60 * SECOND}
          announce={false}
          className="font-semibold text-ink"
        />
      </span>
    );
  }
  return null;
}

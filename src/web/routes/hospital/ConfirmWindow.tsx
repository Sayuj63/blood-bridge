import { Hourglass, Loader2 } from "lucide-react";
import { POLICY } from "../../../shared/domain";
import { Countdown } from "../../components/ui/Countdown";
import { cn } from "../../lib/cn";
import { useTick } from "./useTick";

/**
 * The bank's confirmation window: a draining bar and a seconds countdown.
 * When it runs out the server reroutes to the next-best bank and the tracker updates live.
 */
export function ConfirmWindow({ bankName, confirmBy }: { bankName: string; confirmBy: number }) {
  const now = useTick(1000);
  const windowMs = POLICY.confirmWindowSeconds * 1000;
  const left = confirmBy - now;
  const fraction = Math.max(0, Math.min(1, left / windowMs));
  const lapsed = left <= 0;
  const urgent = left < 30_000;

  return (
    <div className={cn("rounded-(--radius-control) border p-3", lapsed ? "border-critical/40 bg-critical-soft" : "border-warn/40 bg-warn-soft")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          {lapsed ? (
            <Loader2 className="size-4 animate-spin text-critical" aria-hidden />
          ) : (
            <Hourglass className="size-4 text-warn" aria-hidden />
          )}
          {lapsed ? `${bankName} didn't confirm. Rerouting to the next-best bank…` : `Waiting for ${bankName} to confirm`}
        </p>
        {lapsed ? null : (
          <Countdown
            target={confirmBy}
            label="Bank must confirm within"
            criticalBelow={30_000}
            className="text-2xl font-bold"
          />
        )}
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-label="Time left for the bank to confirm"
        aria-valuemin={0}
        aria-valuemax={POLICY.confirmWindowSeconds}
        aria-valuenow={Math.max(0, Math.round(left / 1000))}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", urgent ? "bg-critical" : "bg-warn")}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        The bank has {POLICY.confirmWindowSeconds}s to confirm, then we auto-reroute to the next-best bank.
      </p>
    </div>
  );
}

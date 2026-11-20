import { CalendarClock, HeartHandshake } from "lucide-react";
import type { ReactNode } from "react";
import type { DonorDTO } from "../../../../shared/api";
import { Card } from "../../../components/ui/Card";
import { cn } from "../../../lib/cn";
import { useMeta } from "../../../lib/queries";
import { useClock } from "../useClock";
import { DAY_MS, formatDate } from "../copy";

const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

function ProgressRing({ progress, done, children }: { progress: number; done: boolean; children: ReactNode }) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative grid size-[120px] shrink-0 place-items-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-surface-3" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          className={cn("transition-[stroke-dashoffset] duration-(--duration-slow) ease-(--ease-out-expo)", done ? "stroke-ok" : "stroke-accent")}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/** "Eligible now", or "Eligible again on <date>" with a ring filling up towards it. */
export function EligibilityCard({ donor }: { donor: DonorDTO }) {
  const now = useClock(60_000);
  const intervalDays = useMeta().data?.eligibilityRules.minDaysBetweenDonations;
  // The waiting window runs from the last donation to the date the bank's interval allows the next one.
  const wait =
    !donor.eligible && donor.eligibleFrom !== null && donor.lastDonationAt !== null
      ? { from: donor.lastDonationAt, until: donor.eligibleFrom }
      : null;
  const waiting = wait !== null;
  const daysLeft = wait ? Math.max(1, Math.ceil((wait.until - now) / DAY_MS)) : 0;
  const progress = wait ? (now - wait.from) / (wait.until - wait.from) : 1;

  return (
    <Card as="section" aria-labelledby="eligibility-title" className="p-4">
      <div className="flex items-center gap-4">
        <ProgressRing progress={progress} done={!waiting}>
          {waiting ? (
            <>
              <span className="block font-numeric text-3xl font-bold leading-none text-ink">{daysLeft}</span>
              <span className="mt-1 block font-label text-xs text-ink-muted">{daysLeft === 1 ? "day to go" : "days to go"}</span>
            </>
          ) : (
            <HeartHandshake className="size-9 text-ok" aria-hidden />
          )}
        </ProgressRing>
        <div className="min-w-0">
          <h2 id="eligibility-title" className="text-xl font-semibold leading-tight text-ink">
            {wait ? `Eligible again on ${formatDate(wait.until)}` : "Eligible now"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {waiting
              ? "Thank you for your last donation. We won't send you alerts until then."
              : "You can donate whenever a bank near you needs your group."}
          </p>
          {donor.lastDonationAt !== null ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-faint">
              <CalendarClock className="size-3.5" aria-hidden />
              Last donated {formatDate(donor.lastDonationAt)}
            </p>
          ) : null}
        </div>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
        Donation intervals follow local guidelines.
        {intervalDays ? ` The ${intervalDays}-day gap here is demo configuration set by the blood bank.` : " The gap shown here is demo configuration."}
      </p>
    </Card>
  );
}

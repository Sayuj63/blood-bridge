import { CalendarClock, CheckCircle2, HeartHandshake } from "lucide-react";
import type { DonorDTO } from "../../../../shared/api";
import { useMeta } from "../../../lib/queries";
import { DAY_MS, formatDate } from "../copy";
import { ReminderButton } from "../keepsake/ReminderButton";
import { useClock } from "../useClock";

<<<<<<< Updated upstream
const SIZE = 120;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

function ProgressRing({ progress, done, children }: { progress: number; done: boolean; children: ReactNode }) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative grid size-[96px] shrink-0 place-items-center sm:size-[120px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full -rotate-90" aria-hidden>
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
=======
/** Visual eligibility status card with horizontal progress bar & interval gauge. */
>>>>>>> Stashed changes
export function EligibilityCard({ donor }: { donor: DonorDTO }) {
  const now = useClock(60_000);
  const intervalDays = useMeta().data?.eligibilityRules.minDaysBetweenDonations ?? 90;
  const wait =
    !donor.eligible && donor.eligibleFrom !== null && donor.lastDonationAt !== null
      ? { from: donor.lastDonationAt, until: donor.eligibleFrom }
      : null;
  const waiting = wait !== null;
  const daysLeft = wait ? Math.max(1, Math.ceil((wait.until - now) / DAY_MS)) : 0;
  const progressPct = wait ? Math.min(98, Math.max(4, Math.round(((now - wait.from) / (wait.until - wait.from)) * 100))) : 100;

  return (
<<<<<<< Updated upstream
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
          <h2 id="eligibility-title" className="text-lg font-semibold leading-tight text-balance text-ink sm:text-xl">
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
      {waiting && donor.eligibleFrom !== null ? <ReminderButton donorId={donor.id} eligibleFrom={donor.eligibleFrom} className="mt-4 w-full" /> : null}
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
        Donation intervals follow local guidelines.
        {intervalDays ? ` The ${intervalDays}-day gap here is demo configuration set by the blood bank.` : " The gap shown here is demo configuration."}
      </p>
    </Card>
=======
    <section aria-labelledby="eligibility-title" className="d-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={
              waiting
                ? "grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]"
                : "grid size-8 shrink-0 place-items-center rounded-xl bg-[#ECFDF3] text-[#1F7A4D]"
            }
          >
            {waiting ? <CalendarClock className="size-4" aria-hidden /> : <HeartHandshake className="size-4" aria-hidden />}
          </span>
          <div>
            <h2 id="eligibility-title" className="d-display text-sm font-bold text-[#171717]">
              {wait ? `Eligible again ${formatDate(wait.until)}` : "Eligible to donate now"}
            </h2>
            <p className="mt-0.5 text-xs text-[#737373]">
              {waiting ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} remaining · alerts paused` : "Ready when nearby banks need your group"}
            </p>
          </div>
        </div>
        <span
          className={
            waiting
              ? "d-num shrink-0 rounded-full bg-[#FCEBED] px-2.5 py-0.5 text-[11px] font-bold text-[#A82436]"
              : "inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-bold text-[#1F7A4D]"
          }
        >
          {waiting ? (
            `${progressPct}%`
          ) : (
            <>
              <CheckCircle2 className="size-3" aria-hidden /> Ready
            </>
          )}
        </span>
      </div>

      {/* Recovery Progress Bar */}
      <div className="mt-3.5">
        <div className="h-2 overflow-hidden rounded-full bg-[#F4ECEA]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: waiting ? "linear-gradient(90deg, #D1384B, #C93245)" : "linear-gradient(90deg, #2E9E66, #1F7A4D)",
            }}
          />
        </div>
        <div className="d-num mt-1.5 flex items-center justify-between text-[11px] text-[#737373]">
          <span>{donor.lastDonationAt ? `Last: ${formatDate(donor.lastDonationAt)}` : "First donation"}</span>
          <span>{intervalDays}-day demo interval</span>
        </div>
      </div>

      {waiting && donor.eligibleFrom !== null ? (
        <div className="mt-3 pt-1">
          <ReminderButton donorId={donor.id} eligibleFrom={donor.eligibleFrom} className="w-full rounded-xl sm:w-auto" />
        </div>
      ) : null}
    </section>
>>>>>>> Stashed changes
  );
}

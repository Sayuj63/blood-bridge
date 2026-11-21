import type { OutcomeSummary } from "../../../shared/forecast";
import { cn } from "../../lib/cn";
import { plural } from "../../lib/format";

type CountKey = Exclude<keyof OutcomeSummary, "earliestStockoutHours">;

interface Metric {
  key: CountKey;
  label: string;
  unit: string;
}

const METRICS: Metric[] = [
  { key: "shortfall24h", label: "Unmet in next 24h", unit: "units" },
  { key: "shortfall", label: "Unmet over 72h", unit: "units" },
  { key: "expectedWaste", label: "Expiring unused", unit: "units" },
  { key: "cellsAtRisk", label: "Stock lines out <24h", unit: "lines" },
];

export interface OutcomeMeterProps {
  /** Normal day, no surge. */
  baseline: OutcomeSummary;
  /** Now, with approved transfers. */
  current: OutcomeSummary;
  /** If every remaining suggestion is approved. */
  withPlan: OutcomeSummary;
  /** First reading after the surge began, to show what has been averted so far. */
  surgeStart: OutcomeSummary | null;
}

/**
 * Before/after meter. Each metric shows now → with plan on a shared track, with
 * a tick for a normal day. Approving transfers moves "now" toward "with plan".
 */
export function OutcomeMeter({ baseline, current, withPlan, surgeStart }: OutcomeMeterProps) {
  const avertedShortfall = surgeStart ? Math.max(0, surgeStart.shortfall24h - current.shortfall24h) : 0;
  const savedFromExpiry = surgeStart ? Math.max(0, surgeStart.expectedWaste - current.expectedWaste) : 0;
  const planShortfall = Math.max(0, current.shortfall24h - withPlan.shortfall24h);
  const planWaste = Math.max(0, current.expectedWaste - withPlan.expectedWaste);

  return (
    <div className="grid gap-4 p-3 lg:grid-cols-[minmax(14rem,0.8fr)_2fr]">
      <div className="flex flex-col justify-center gap-3" aria-live="polite">
        <div>
          <div className="font-label text-xs text-ink-faint">Averted since the surge began</div>
          <div className="mt-1 flex items-baseline gap-4 font-numeric">
            <span>
              <span className="text-3xl font-bold text-bridge">{avertedShortfall}</span>
              <span className="ml-1 text-xs text-ink-muted">units of 24h shortfall</span>
            </span>
            <span>
              <span className="text-3xl font-bold text-ok">{savedFromExpiry}</span>
              <span className="ml-1 text-xs text-ink-muted">saved from expiry</span>
            </span>
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          {planShortfall > 0 || planWaste > 0
            ? `Approving the remaining plan would avert ${plural(planShortfall, "more unit")} of shortfall and save ${planWaste} more from expiry.`
            : "No further gains from the current plan."}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        {METRICS.map((m) => {
          const now = current[m.key];
          const plan = withPlan[m.key];
          const base = baseline[m.key];
          const max = Math.max(now, plan, base, 1);
          const pct = (v: number) => `${(v / max) * 100}%`;
          const delta = plan - now;
          return (
            <li key={m.key} className="min-w-0 rounded-(--radius-control) border border-line bg-surface-2/60 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-ink-muted">{m.label}</span>
                {delta < 0 ? <span className="font-numeric text-xs font-semibold text-ok">{delta}</span> : null}
              </div>
              <div className="mt-1 flex items-baseline gap-2 font-numeric">
                <span className={cn("text-2xl font-bold", now > base ? "text-critical" : "text-ink")}>{now}</span>
                <span className="text-ink-faint" aria-hidden>
                  →
                </span>
                <span className="text-2xl font-bold text-bridge">{plan}</span>
                <span className="sr-only">
                  {m.label}: {now} now, {plan} with plan, {base} on a normal day
                </span>
              </div>
              <div className="relative mt-2 h-2 rounded-full bg-surface-3" aria-hidden>
                <div className="absolute inset-y-0 left-0 rounded-full bg-critical/70 transition-[width] duration-700" style={{ width: pct(now) }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-bridge transition-[width] duration-700" style={{ width: pct(plan) }} />
                <div className="absolute -inset-y-1 w-0.5 rounded bg-ink" style={{ left: pct(base) }} title="Normal day" />
              </div>
              <div className="mt-1.5 flex justify-between font-numeric text-2xs text-ink-faint">
                <span>now · with plan</span>
                <span>normal day {base}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

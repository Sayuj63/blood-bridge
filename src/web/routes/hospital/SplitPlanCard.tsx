import { AlertTriangle, CheckCircle2, Layers, Phone, Siren, Timer } from "lucide-react";
import type { SplitPlan } from "../../../shared/split";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { plural } from "../../lib/format";

interface SplitPlanCardProps {
  plan: SplitPlan;
  unitsNeeded: number;
  onReserveAll: () => void;
  pending: boolean;
  /** Another reservation is in flight. */
  disabled?: boolean;
  /** Raise a critical alert for what the split can't cover; omitted when not available. */
  onCritical?: () => void;
  criticalPending?: boolean;
}

const MATCH_NOTE = {
  exact: "Exact group",
  mixed: "Mixed groups · clinician must confirm",
  compatible: "Compatible alternative · clinician must confirm",
} as const;

/**
 * "Cover all N units across K banks": the whole request in one tap when no single
 * bank holds enough. Each leg becomes its own reservation the bank must confirm.
 */
export function SplitPlanCard({ plan, unitsNeeded, onReserveAll, pending, disabled = false, onCritical, criticalPending = false }: SplitPlanCardProps) {
  const k = plan.legs.length;
  const partial = plan.shortBy > 0;
  const title = partial
    ? `Cover ${plan.covered} of ${plural(unitsNeeded, "unit")} across ${plural(k, "bank")}`
    : `Cover all ${plural(unitsNeeded, "unit")} across ${plural(k, "bank")}`;

  return (
    <section
      aria-labelledby="split-plan-title"
      data-testid="split-plan"
      className="rounded-(--radius-panel) border-2 border-accent/50 bg-surface p-4 shadow-panel"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
          <Layers className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-label text-xs uppercase tracking-wider text-ink-muted">No single bank holds enough</p>
          <h3 id="split-plan-title" className="font-display text-lg leading-tight">
            {title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
            <Timer className="size-3.5" aria-hidden />
            Last bag on the ward in ~<span className="font-numeric">{plan.maxEtaMinutes}</span> min
          </p>
        </div>
      </div>

      <ol className="mt-3 divide-y divide-line rounded-(--radius-control) border border-line">
        {plan.legs.map((leg, i) => (
          <li key={leg.siteId} className="flex items-start gap-3 px-3 py-2.5">
            <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 font-numeric text-xs font-bold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold leading-tight">{leg.name}</span>
                <span className="font-numeric text-sm">
                  <strong>{plural(leg.units, "unit")}</strong>
                  <span className="text-ink-muted"> · {leg.etaMinutes} min</span>
                </span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <span className={cn("inline-flex items-center gap-1", leg.matchType === "exact" ? "text-ok" : "text-warn")}>
                  {leg.matchType === "exact" ? <CheckCircle2 className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
                  {MATCH_NOTE[leg.matchType]}
                </span>
                {leg.stale ? (
                  <span className="inline-flex items-center gap-1 text-warn">
                    <Phone className="size-3.5" aria-hidden />
                    Stale stock data · phone check before pickup
                  </span>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {partial ? (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-(--radius-control) bg-critical-soft p-2.5 text-sm text-ink">
          <Siren className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
          <span>
            Covers {plan.covered} of {unitsNeeded}; <strong>raise a critical alert</strong> for the remaining {plural(plan.shortBy, "unit")}.
          </span>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="lg" className="flex-1" loading={pending} disabled={disabled} onClick={onReserveAll} icon={<Layers className="size-4" aria-hidden />}>
          Reserve all {plan.covered > 0 ? `(${plan.covered})` : ""}
        </Button>
        {partial && onCritical ? (
          <Button variant="danger" size="lg" loading={criticalPending} onClick={onCritical} icon={<Siren className="size-4" aria-hidden />}>
            Critical alert
          </Button>
        ) : null}
      </div>
    </section>
  );
}

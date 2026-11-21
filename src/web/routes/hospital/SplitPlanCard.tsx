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
  disabled?: boolean;
  onCritical?: () => void;
  criticalPending?: boolean;
}

const MATCH_NOTE = {
  exact: "Exact group",
  mixed: "Mixed groups · clinician must confirm",
  compatible: "Compatible alternative · clinician must confirm",
} as const;

/**
 * "Cover all N units across K banks": multi-bank split reservation in one tap
 * when no single bank holds enough stock.
 */
export function SplitPlanCard({
  plan,
  unitsNeeded,
  onReserveAll,
  pending,
  disabled = false,
  onCritical,
  criticalPending = false,
}: SplitPlanCardProps) {
  const k = plan.legs.length;
  const partial = plan.shortBy > 0;
  const title = partial
    ? `Cover ${plan.covered} of ${plural(unitsNeeded, "unit")} across ${plural(k, "bank")}`
    : `Cover all ${plural(unitsNeeded, "unit")} across ${plural(k, "bank")}`;

  return (
    <section
      aria-labelledby="split-plan-title"
      data-testid="split-plan"
      className="h-card border-[#C93245]/50 bg-[#FFF5F5]/40 p-4"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#C93245] text-white">
          <Layers className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C93245]">Multi-bank split plan</p>
          <h4 id="split-plan-title" className="text-sm font-semibold text-[#171717]">
            {title}
          </h4>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[#737373]">
            <Timer className="size-3.5" aria-hidden />
            Last bag arrives in ~<span className="h-num font-semibold text-[#171717]">{plan.maxEtaMinutes}</span> min
          </p>
        </div>
      </div>

      <ol className="mt-3 divide-y divide-[#EAE6E3] rounded-lg border border-[#EAE6E3] bg-white">
        {plan.legs.map((leg, i) => (
          <li key={leg.siteId} className="flex items-start gap-2.5 px-3 py-2.5 text-xs">
            <span aria-hidden className="h-num mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#F5F3EF] text-[11px] font-bold text-[#171717]">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold text-[#171717]">{leg.name}</span>
                <span className="h-num">
                  <strong className="text-[#171717]">{plural(leg.units, "unit")}</strong>
                  <span className="text-[#737373]"> · {leg.etaMinutes} min</span>
                </span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <span className={cn("inline-flex items-center gap-1 font-medium", leg.matchType === "exact" ? "text-[#15803D]" : "text-[#A16207]")}>
                  {leg.matchType === "exact" ? <CheckCircle2 className="size-3" aria-hidden /> : <AlertTriangle className="size-3" aria-hidden />}
                  {MATCH_NOTE[leg.matchType]}
                </span>
                {leg.stale ? (
                  <span className="inline-flex items-center gap-1 text-[#C2410C]">
                    <Phone className="size-3" aria-hidden />
                    Stale data · phone check required
                  </span>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {partial ? (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs text-[#991B1B]">
          <Siren className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Covers {plan.covered} of {unitsNeeded}; <strong className="font-semibold">raise a critical alert</strong> for the remaining{" "}
            {plural(plan.shortBy, "unit")}.
          </span>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          loading={pending}
          disabled={disabled}
          onClick={onReserveAll}
          icon={<Layers className="size-4" aria-hidden />}
        >
          Reserve all {plan.covered > 0 ? `(${plan.covered})` : ""}
        </Button>
        {partial && onCritical ? (
          <Button variant="danger" size="md" loading={criticalPending} onClick={onCritical} icon={<Siren className="size-4" aria-hidden />}>
            Critical alert
          </Button>
        ) : null}
      </div>
    </section>
  );
}

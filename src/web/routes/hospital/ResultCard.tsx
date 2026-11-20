import { AlertTriangle, CheckCircle2, Phone, Timer } from "lucide-react";
import type { RankedOption } from "../../../shared/ranking";
import { Button } from "../../components/ui/Button";
import { ExpiryBadge } from "../../components/ui/ExpiryBadge";
import { FreshnessPill } from "../../components/ui/FreshnessPill";
import { cn } from "../../lib/cn";
import { plural } from "../../lib/format";
import { AllocationChips } from "./AllocationChips";
import { RankWhy } from "./RankWhy";

interface ResultCardProps {
  option: RankedOption;
  unitsNeeded: number;
  highlighted: boolean;
  reserving: boolean;
  /** Another card's reservation is in flight. */
  disabled: boolean;
  onReserve: () => void;
  onHover: (siteId: string | null) => void;
}

/** One ranked blood bank: what it can supply, how fresh the data is, and a one-tap Reserve. */
export function ResultCard({ option, unitsNeeded, highlighted, reserving, disabled, onReserve, onHover }: ResultCardProps) {
  const soonest = Math.min(...option.allocation.map((u) => u.expiresAt));
  const exact = option.matchType === "exact";
  const best = option.rank === 1;

  return (
    <article
      id={`result-${option.siteId}`}
      tabIndex={-1}
      aria-labelledby={`result-${option.siteId}-name`}
      onMouseEnter={() => onHover(option.siteId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(option.siteId)}
      className={cn(
        "focus-ring rounded-(--radius-panel) border bg-surface p-4 shadow-panel transition-[border-color,box-shadow] duration-(--duration-base)",
        highlighted ? "border-ink/60" : best ? "border-accent/40" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full font-numeric text-base font-bold",
            best ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink",
          )}
        >
          {option.rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`result-${option.siteId}-name`} className="font-semibold leading-tight">
            <span className="sr-only">Rank {option.rank}: </span>
            {option.name}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            <span className="font-numeric">{option.distanceKm} km</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 font-numeric">
              <Timer className="size-3.5" aria-hidden />
              {option.etaMinutes} min
            </span>
            <RankWhy option={option} unitsNeeded={unitsNeeded} />
          </p>
        </div>
        <Button variant={best ? "primary" : "secondary"} size="md" loading={reserving} disabled={disabled} onClick={onReserve} className="hidden sm:inline-flex">
          Reserve
        </Button>
      </div>

      <div className="mt-3 space-y-2.5 sm:pl-12">
        <AllocationChips units={option.allocation} />
        <div className="flex flex-wrap items-center gap-1.5">
          <ExpiryBadge expiresAt={soonest} />
          <FreshnessPill minutes={option.freshnessMinutes} stale={option.stale} />
          {!option.coversRequest ? (
            <span className="font-label text-xs text-warn">
              Covers {option.allocation.length} of {plural(unitsNeeded, "unit")}
            </span>
          ) : null}
        </div>
        {exact ? (
          <p className="flex items-center gap-1.5 text-sm text-ok">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Exact group match
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Compatible alternative ({option.alternativeGroups.join(", ")}) · <strong>clinician must confirm</strong>
            </span>
          </p>
        )}
        {option.stale ? (
          <p className="flex items-start gap-1.5 text-sm text-warn">
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Stock unconfirmed: a phone check is needed before pickup.</span>
          </p>
        ) : null}
        <Button variant={best ? "primary" : "secondary"} size="lg" loading={reserving} disabled={disabled} onClick={onReserve} className="w-full sm:hidden">
          Reserve
        </Button>
      </div>
    </article>
  );
}

import { Info } from "lucide-react";
import { RANK_WEIGHTS, type RankedOption } from "../../../shared/ranking";
import { Tooltip } from "../../components/ui/Tooltip";
import { formatHours } from "../../lib/format";

type Factor = keyof RankedOption["scoreBreakdown"];

const FACTORS: { key: Factor; label: string; describe: (o: RankedOption, unitsNeeded: number) => string }[] = [
  { key: "travel", label: "Travel", describe: (o) => `${o.etaMinutes} min by road` },
  { key: "freshness", label: "Data freshness", describe: (o) => `synced ${o.freshnessMinutes} min ago` },
  { key: "shelfLife", label: "Shelf life", describe: (o) => `oldest in-date first · ${formatHours(o.soonestExpiryHours)}` },
  { key: "coverage", label: "Coverage", describe: (o, n) => `${Math.min(o.allocation.length, n)} of ${n} units` },
];

/** "Why this rank?" — the weighted score breakdown behind a result's position. Lower is better. */
export function RankWhy({ option, unitsNeeded }: { option: RankedOption; unitsNeeded: number }) {
  return (
    <Tooltip
      side="bottom"
      content={
        <span className="block space-y-2">
          <span className="block font-semibold">
            Ranked #{option.rank} · score {option.score.toFixed(3)}
          </span>
          {FACTORS.map((f) => {
            const contribution = option.scoreBreakdown[f.key] * RANK_WEIGHTS[f.key];
            return (
              <span key={f.key} className="block">
                <span className="flex justify-between gap-2">
                  <span>
                    {f.label} <span className="text-ink-faint">×{RANK_WEIGHTS[f.key]}</span>
                  </span>
                  <span className="font-numeric">+{contribution.toFixed(3)}</span>
                </span>
                <span className="mt-0.5 block h-1 rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-ink-muted" style={{ width: `${Math.min(100, (contribution / 0.5) * 100)}%` }} />
                </span>
                <span className="text-ink-muted">{f.describe(option, unitsNeeded)}</span>
              </span>
            );
          })}
          <span className="block border-t border-line pt-2 text-ink-muted">
            Banks that cover the whole request with exact-group units rank first; within a tier the lowest score wins.
          </span>
        </span>
      }
    >
      <button type="button" className="focus-ring inline-flex items-center gap-1 rounded-md px-1 text-xs text-ink-muted underline decoration-dotted underline-offset-2 hover:text-ink">
        <Info className="size-3.5" aria-hidden />
        Why #{option.rank}?
      </button>
    </Tooltip>
  );
}

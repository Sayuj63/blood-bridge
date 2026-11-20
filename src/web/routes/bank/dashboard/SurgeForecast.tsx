import { Siren } from "lucide-react";
import type { ForecastDTO } from "../../../../shared/api";
import { COMPONENT_SHORT } from "../../../../shared/domain";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { formatHours } from "../../../lib/format";

const OUTLOOK_ROWS = 3;

/** This site's forecast during a surge, with the city cells that run out first. */
export function SurgeForecast({ forecast, siteId }: { forecast: ForecastDTO; siteId: string }) {
  const surge = forecast.surge;
  if (!surge) return null;
  const mine = forecast.sites.find((s) => s.siteId === siteId);
  const atRisk = forecast.outlook.filter((o) => o.stockoutHours !== null).slice(0, OUTLOOK_ROWS);

  return (
    <section aria-labelledby="surge-forecast-title" className="overflow-hidden rounded-(--radius-panel) border-2 border-critical bg-critical-soft">
      <div className="flex items-center gap-2 bg-critical px-4 py-2 text-white command:text-[#1a0207]">
        <Siren className="size-4 shrink-0 motion-safe:animate-pulse" aria-hidden />
        <h2 id="surge-forecast-title" className="font-label text-sm tracking-wide uppercase">
          Surge forecast · {surge.label} near {surge.areaName}
        </h2>
      </div>
      <div className="grid gap-4 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="font-label text-xs text-ink-muted uppercase">This bank, next {forecast.horizonHours}h</p>
          {mine?.earliestStockoutHours != null && mine.worst ? (
            <p className="mt-1 text-lg font-semibold text-critical">
              {mine.worst.bloodGroup} {COMPONENT_SHORT[mine.worst.component]} runs out in {formatHours(mine.earliestStockoutHours)}
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold text-ok">No stockout forecast inside the horizon</p>
          )}
          {mine ? (
            <p className="mt-1 text-sm text-ink-muted">
              Demand ×{mine.surgeInfluence.toFixed(1)} from the surge · {mine.expectedWaste} units at risk of expiring unused
            </p>
          ) : null}
        </div>
        {atRisk.length > 0 ? (
          <div>
            <p className="font-label text-xs text-ink-muted uppercase">City cells running out first</p>
            <ul className="mt-1.5 space-y-1">
              {atRisk.map((o) => (
                <li key={`${o.bloodGroup}|${o.component}`} className="flex items-center gap-2 text-sm">
                  <BloodGroupChip group={o.bloodGroup} size="sm" />
                  <span className="font-label">{COMPONENT_SHORT[o.component]}</span>
                  <span className="font-numeric font-semibold text-critical">{formatHours(o.stockoutHours ?? 0)}</span>
                  <span className="ml-auto text-xs text-ink-muted">
                    short {o.shortfall} · {o.sitesAtRisk} sites at risk
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

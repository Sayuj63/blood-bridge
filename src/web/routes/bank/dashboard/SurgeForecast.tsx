import { Siren } from "lucide-react";
import type { ForecastDTO } from "../../../../shared/api";
import { COMPONENT_SHORT } from "../../../../shared/domain";
import { formatHours } from "../../../lib/format";

const OUTLOOK_ROWS = 3;

/** This site's forecast during a surge, with the city cells that run out first. */
export function SurgeForecast({ forecast, siteId }: { forecast: ForecastDTO; siteId: string }) {
  const surge = forecast.surge;
  if (!surge) return null;
  const mine = forecast.sites.find((s) => s.siteId === siteId);
  const atRisk = forecast.outlook.filter((o) => o.stockoutHours !== null).slice(0, OUTLOOK_ROWS);

  return (
    <section aria-labelledby="surge-forecast-title" className="overflow-hidden rounded-2xl border border-[#F2D7DB] bg-[#FFF5F5] shadow-xs">
      <div className="flex items-center gap-2 bg-[#C93245] px-4 py-2.5 text-white">
        <Siren className="size-4 shrink-0 motion-safe:animate-pulse" aria-hidden />
        <h2 id="surge-forecast-title" className="b-display text-xs font-bold tracking-wide uppercase">
          Surge forecast · {surge.label} near {surge.areaName}
        </h2>
      </div>
      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold tracking-wider text-[#737373] uppercase">This bank, next {forecast.horizonHours}h</p>
          {mine?.earliestStockoutHours != null && mine.worst ? (
            <p className="b-display mt-1 text-base font-bold text-[#A82436]">
              {mine.worst.bloodGroup.replace("-", "−")} {COMPONENT_SHORT[mine.worst.component]} runs out in{" "}
              {formatHours(mine.earliestStockoutHours)}
            </p>
          ) : (
            <p className="b-display mt-1 text-base font-bold text-[#1F7A4D]">No stockout forecast inside the horizon</p>
          )}
          {mine ? (
            <p className="b-num mt-1 text-xs text-[#737373]">
              Demand ×{mine.surgeInfluence.toFixed(1)} from surge · {mine.expectedWaste} units at risk of expiring unused
            </p>
          ) : null}
        </div>
        {atRisk.length > 0 ? (
          <div>
            <p className="text-[11px] font-bold tracking-wider text-[#737373] uppercase">City cells running out first</p>
            <ul className="mt-2 space-y-1.5">
              {atRisk.map((o) => (
                <li key={`${o.bloodGroup}|${o.component}`} className="flex items-center gap-2 text-xs">
                  <span className="b-num inline-grid h-6 min-w-9 place-items-center rounded-md bg-[#FCEBED] px-1.5 font-extrabold text-[#A82436]">
                    {o.bloodGroup.replace("-", "−")}
                  </span>
                  <span className="font-semibold text-[#171717]">{COMPONENT_SHORT[o.component]}</span>
                  <span className="b-num font-bold text-[#C93245]">{formatHours(o.stockoutHours ?? 0)}</span>
                  <span className="b-num ml-auto text-[11px] text-[#737373]">
                    short {o.shortfall} · {o.sitesAtRisk} sites
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

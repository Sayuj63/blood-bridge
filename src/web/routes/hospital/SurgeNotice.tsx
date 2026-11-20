import { TrendingUp } from "lucide-react";
import { useForecast } from "../../lib/queries";

/** In-view reminder during a surge scenario: demand is forecast to rise, so reserve early. */
export function SurgeNotice() {
  const surge = useForecast().data?.surge;
  if (!surge) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-(--radius-panel) border border-critical/30 bg-critical-soft px-4 py-3">
      <TrendingUp className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden />
      <p className="text-sm text-ink">
        <span className="font-semibold">Surge scenario: {surge.label} near {surge.areaName}.</span> Demand forecasts are elevated across the
        city for the next hours. Expect tighter stock and reserve as early as you can.
      </p>
    </div>
  );
}

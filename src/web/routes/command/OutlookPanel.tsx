import { useState } from "react";
import type { ForecastDTO } from "../../../shared/api";
import { COMPONENTS, COMPONENT_SHORT, COMPONENT_LABEL, type Component } from "../../../shared/domain";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";
import { Countdown } from "../../components/ui/Countdown";
import { ErrorState } from "../../components/ui/EmptyState";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { cn } from "../../lib/cn";
import { spokenGroup } from "../../lib/format";
import { Panel } from "./Panel";
import { TONE_BG, stockoutTone } from "./severity";

const HOUR = 3_600_000;

/** City outlook per blood group: live stock-out countdowns, soonest first. */
export function OutlookPanel({
  forecast,
  isLoading,
  error,
  onRetry,
}: {
  forecast: ForecastDTO | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const [component, setComponent] = useState<Component>("red_cells");
  const horizon = forecast?.horizonHours ?? 72;
  const rows = (forecast?.outlook ?? [])
    .filter((o) => o.component === component)
    .sort((a, b) => (a.stockoutHours ?? Infinity) - (b.stockoutHours ?? Infinity) || b.shortfall - a.shortfall);

  return (
    <Panel id="outlook" title="City outlook" meta={`${horizon}h horizon`} className="border-r">
      <div className="border-b border-line p-2">
        <SegmentedControl
          label="Component"
          size="sm"
          value={component}
          onChange={setComponent}
          options={COMPONENTS.map((c) => ({ value: c, label: <span title={COMPONENT_LABEL[c]}>{COMPONENT_SHORT[c]}</span> }))}
          className="w-full"
        />
      </div>
      {error ? (
        <ErrorState compact what="the city forecast" error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <SkeletonRows rows={8} className="p-3" />
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted">No stock or demand recorded for {COMPONENT_LABEL[component].toLowerCase()}.</p>
      ) : (
        <ul aria-label={`${COMPONENT_LABEL[component]} stock-out countdowns, soonest first`}>
          {rows.map((o, i) => {
            const tone = stockoutTone(o.stockoutHours);
            const pct = o.stockoutHours === null ? 100 : Math.max(2, (o.stockoutHours / horizon) * 100);
            return (
              <li key={o.bloodGroup} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-x-2.5 border-b border-line/70 px-3 py-2">
                <BloodGroupChip group={o.bloodGroup} size="md" />
                <div className="min-w-0">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={cn("h-full origin-left rounded-full transition-[width] duration-700 ease-(--ease-out-expo)", TONE_BG[tone])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex gap-3 font-numeric text-2xs text-ink-faint">
                    <span>{o.onHand} on hand</span>
                    {o.shortfall > 0 ? <span className="text-critical">−{o.shortfall} short</span> : null}
                    {o.expectedWaste > 0 ? <span className="text-warn">{o.expectedWaste} expiring</span> : null}
                    {o.sitesAtRisk > 0 ? <span>{o.sitesAtRisk} sites &lt;24h</span> : null}
                  </div>
                </div>
                <div className="text-right font-numeric text-sm font-semibold">
                  {o.stockoutHours === null || !forecast ? (
                    <span className="text-ok">{horizon}h+</span>
                  ) : (
                    <Countdown
                      target={forecast.generatedAt + o.stockoutHours * HOUR}
                      label={`${spokenGroup(o.bloodGroup)} ${COMPONENT_LABEL[component]} run out in`}
                      announce={i === 0}
                      criticalBelow={6 * HOUR}
                      warnBelow={24 * HOUR}
                      doneLabel="Out"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

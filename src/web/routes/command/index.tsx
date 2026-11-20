import { useMemo, useState } from "react";
import { CityMap } from "../../components/map/CityMap";
import { ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useForecast, useSites, useTransferBoard } from "../../lib/queries";
import { BriefPanel } from "./BriefPanel";
import { DonorDriveDialog } from "./DonorDriveDialog";
import { OutcomeMeter } from "./OutcomeMeter";
import { OutlookPanel } from "./OutlookPanel";
import { Panel } from "./Panel";
import { ScenarioBar } from "./ScenarioBar";
import { TransfersPanel } from "./TransfersPanel";
import { useCommandActions } from "./useCommandActions";
import { useCommandMap } from "./useCommandMap";
import { useSurgeStart } from "./useSurgeStart";

/** `/command` — city operations: outlook, map, plan, outcome. */
export default function CommandPage() {
  const sites = useSites();
  const forecast = useForecast();
  const board = useTransferBoard();
  const actions = useCommandActions();
  const [focused, setFocused] = useState<string | null>(null);
  const [donorsOpen, setDonorsOpen] = useState(false);

  const surge = forecast.data?.surge ?? null;
  const surgeStart = useSurgeStart(forecast.data);
  const { markers, arcs } = useCommandMap(sites.data, forecast.data, board.data, focused);

  const banks = useMemo(() => (sites.data ?? []).filter((s) => s.kind === "blood_bank"), [sites.data]);
  const donorDefaults = useMemo(() => {
    const f = forecast.data;
    const worstGroup = f?.outlook
      .filter((o) => o.stockoutHours !== null)
      .sort((a, b) => (a.stockoutHours ?? 0) - (b.stockoutHours ?? 0))[0]?.bloodGroup;
    const bankIds = new Set(banks.map((b) => b.id));
    const worstBank = f?.sites
      .filter((r) => bankIds.has(r.siteId) && r.earliestStockoutHours !== null)
      .sort((a, b) => (a.earliestStockoutHours ?? 0) - (b.earliestStockoutHours ?? 0))[0]?.siteId;
    return { group: worstGroup, bankId: worstBank };
  }, [forecast.data, banks]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScenarioBar surge={surge} actions={actions} onRequestDonors={() => setDonorsOpen(true)} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[18.5rem_minmax(0,1fr)_23rem] lg:grid-rows-1">
        <div className="order-2 min-h-0 lg:order-1">
          <OutlookPanel
            forecast={forecast.data}
            isLoading={forecast.isPending}
            error={forecast.error}
            onRetry={() => void forecast.refetch()}
          />
        </div>

        <div className="order-1 flex min-h-0 flex-col lg:order-2">
          <div className="relative h-[52vh] min-h-72 lg:h-auto lg:flex-1">
            <CityMap
              theme="command"
              markers={markers}
              arcs={arcs}
              surge={surge ? { lat: surge.epicenter.lat, lng: surge.epicenter.lng, radiusKm: surge.radiusKm } : null}
              fitToMarkers
              fitPadding={50}
              pitch={35}
              label="City map: blood banks and hospitals coloured by how soon they run out, with transfer routes"
              className="absolute inset-0"
            />
            <MapLegend />
            {sites.error ? (
              <div className="absolute inset-x-3 top-3 rounded-(--radius-control) border border-line bg-surface/95">
                <ErrorState compact what="sites" error={sites.error} onRetry={() => void sites.refetch()} />
              </div>
            ) : null}
          </div>
          <Panel id="outcome" title="Outcome" meta="next 72h · now vs with plan" className="border-t lg:max-h-[17rem] lg:flex-none">
            {forecast.data ? (
              <OutcomeMeter
                baseline={forecast.data.baseline}
                current={forecast.data.current}
                withPlan={forecast.data.withPlan}
                surgeStart={surgeStart}
              />
            ) : forecast.error ? (
              <ErrorState compact what="the outcome forecast" error={forecast.error} />
            ) : (
              <div className="grid gap-3 p-3 sm:grid-cols-3" aria-busy="true">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            )}
          </Panel>
        </div>

        <aside className="order-3 flex min-h-0 flex-col border-line lg:border-l" aria-label="Brief and transfer plan">
          <div className="max-h-[45%] min-h-0 shrink-0 overflow-hidden lg:flex lg:flex-col">
            <BriefPanel surge={surge} />
          </div>
          <div className="min-h-0 flex-1">
            <TransfersPanel
              board={board.data}
              isLoading={board.isPending}
              error={board.error}
              onRetry={() => void board.refetch()}
              actions={actions}
              focused={focused}
              onFocus={setFocused}
            />
          </div>
        </aside>
      </div>

      <DonorDriveDialog
        open={donorsOpen}
        onClose={() => setDonorsOpen(false)}
        banks={banks}
        defaultBankId={donorDefaults.bankId}
        defaultGroup={donorDefaults.group}
      />
    </div>
  );
}

const LEGEND = [
  { label: "Out < 6h", cls: "bg-critical" },
  { label: "Out < 24h", cls: "bg-warn" },
  { label: "Later", cls: "bg-info" },
  { label: "Covered", cls: "bg-ok" },
];

function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-control) border border-line bg-surface/90 px-2.5 py-1.5 font-label text-2xs text-ink-muted backdrop-blur">
      {LEGEND.map((l) => (
        <span key={l.label} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${l.cls}`} aria-hidden />
          {l.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-bridge" aria-hidden />
        Transfer
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-[2px] bg-ink-faint" aria-hidden />
        Hospital
      </span>
    </div>
  );
}

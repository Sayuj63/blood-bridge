import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ambulance, FlaskConical, Power, Sparkles, Waves } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import type { ForecastDTO, SiteDTO, TransferBoardDTO } from "../../../shared/api";
import { COMPONENT_SHORT, type SurgeKind } from "../../../shared/domain";
import { CityMap, type MapArc, type MapMarker } from "../../components/map/CityMap";
import { Button } from "../../components/ui/Button";
import { api, errorMessage } from "../../lib/api";
import { formatHours, plural } from "../../lib/format";
import { useMeta } from "../../lib/queries";
import { queryKeys } from "../../lib/queryKeys";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { actAs } from "./useHospitalView";

const SCENARIOS: { kind: SurgeKind; area: string; label: string; summary: string; icon: typeof Waves }[] = [
  {
    kind: "flood",
    area: "Kurla",
    label: "Simulate Kurla Flood",
    summary: "Models a 4 km Mithi river flash-flood demand spike (up to 3× O− PRBC).",
    icon: Waves,
  },
  {
    kind: "mass_casualty",
    area: "Dadar",
    label: "Simulate Dadar MCI",
    summary: "Models a 3 km mass-casualty trauma surge (up to 5× O− PRBC, 4× O+ PRBC).",
    icon: Ambulance,
  },
];

export interface SurgeScenarioPanelProps {
  hospital: SiteDTO;
  sites: SiteDTO[];
  forecast: ForecastDTO;
  board: TransferBoardDTO | undefined;
}

/**
 * Integrated Doomsday / Surge what-if scenario panel for hospital planners.
 * Explicitly framed as a simulated what-if scenario, never a real disaster alert.
 */
export function SurgeScenarioPanel({ hospital, sites, forecast, board }: SurgeScenarioPanelProps) {
  const qc = useQueryClient();
  const areas = useMeta().data?.areas ?? [];
  const [confirmKind, setConfirmKind] = useState<SurgeKind | null>(null);
  const surge = forecast.surge;

  const brief = useQuery({
    queryKey: queryKeys.surgeBrief(surge?.id ?? "none"),
    queryFn: ({ signal }) => api.surge.brief(signal),
    enabled: surge !== null,
    staleTime: 60_000,
  });

  const startSurge = useMutation({
    mutationFn: (kind: SurgeKind) => {
      actAs(hospital.id);
      const areaName = SCENARIOS.find((s) => s.kind === kind)?.area ?? "";
      const areaId = areas.find((a) => a.name.toLowerCase().includes(areaName.toLowerCase()))?.id;
      return api.surge.start({ kind, areaId });
    },
    onSuccess: (s) => {
      toast.warning(`Simulated scenario active: ${s.label} (${s.areaName})`);
      setConfirmKind(null);
      void qc.invalidateQueries({ queryKey: queryKeys.forecast() });
      void qc.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (e) => toast.error("Could not start simulated scenario", { description: errorMessage(e) }),
  });

  const endSurge = useMutation({
    mutationFn: () => {
      actAs(hospital.id);
      return api.surge.end();
    },
    onSuccess: () => {
      toast.success("Returned to normal operating baseline");
      void qc.invalidateQueries({ queryKey: queryKeys.forecast() });
      void qc.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (e) => toast.error("Could not stand down scenario", { description: errorMessage(e) }),
  });

  // Before / Surge / With-Plan comparison data from existing OutcomeSummary objects.
  const comparisonData = useMemo(
    () => [
      {
        metric: "24h unmet",
        normal: forecast.baseline.shortfall24h,
        current: forecast.current.shortfall24h,
        withPlan: forecast.withPlan.shortfall24h,
      },
      {
        metric: "72h shortfall",
        normal: forecast.baseline.shortfall,
        current: forecast.current.shortfall,
        withPlan: forecast.withPlan.shortfall,
      },
      {
        metric: "Expiring unused",
        normal: forecast.baseline.expectedWaste,
        current: forecast.current.expectedWaste,
        withPlan: forecast.withPlan.expectedWaste,
      },
      {
        metric: "Lines out <24h",
        normal: forecast.baseline.cellsAtRisk,
        current: forecast.current.cellsAtRisk,
        withPlan: forecast.withPlan.cellsAtRisk,
      },
    ],
    [forecast],
  );

  // Regional map markers & transfer arcs (reusing existing CityMap component in light clinical theme).
  const { markers, arcs } = useMemo(() => {
    const byId = new Map(sites.map((s) => [s.id, s]));
    const riskById = new Map(forecast.sites.map((r) => [r.siteId, r]));

    const mapMarkers: MapMarker[] = sites.map((s) => {
      const r = riskById.get(s.id);
      const h = r?.earliestStockoutHours ?? null;
      const tone =
        s.id === hospital.id
          ? "info"
          : h !== null && h < 6
            ? "critical"
            : h !== null && h < 24
              ? "warn"
              : "ok";
      return {
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        label: `${s.name}: ${h !== null ? `stock-out in ${formatHours(h)}` : "covered"}`,
        tone,
        shape: s.kind === "hospital" ? "square" : "round",
        size: s.id === hospital.id ? "lg" : tone === "critical" ? "lg" : "sm",
        highlighted: s.id === hospital.id,
        pulse: tone === "critical",
      };
    });

    const mapArcs: MapArc[] = [];
    for (const s of board?.suggestions ?? []) {
      const from = byId.get(s.fromSiteId);
      const to = byId.get(s.toSiteId);
      if (from && to) mapArcs.push({ id: s.key, from, to, state: "suggested", tone: "bridge" });
    }
    for (const t of board?.active ?? []) {
      if (t.status !== "approved") continue;
      const from = byId.get(t.fromSiteId);
      const to = byId.get(t.toSiteId);
      if (from && to) mapArcs.push({ id: t.id, from, to, state: "active", tone: "accent", emphasis: true });
    }
    return { markers: mapMarkers, arcs: mapArcs };
  }, [sites, forecast, board, hospital.id]);

  const affectedGroups = useMemo(
    () => forecast.outlook.filter((o) => o.stockoutHours !== null && o.stockoutHours < 48).slice(0, 5),
    [forecast],
  );

  const shortfallReduction = Math.max(0, forecast.current.shortfall24h - forecast.withPlan.shortfall24h);
  const wasteReduction = Math.max(0, forecast.current.expectedWaste - forecast.withPlan.expectedWaste);

  return (
    <section aria-labelledby="surge-sim-title" className="h-card overflow-hidden">
      {/* Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE6E3] bg-[#FAF9F6] px-5 py-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="surge-sim-title" className="text-sm font-semibold text-[#171717]">
              Surge Stress-Test &amp; Replenishment Impact
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#EAE6E3] bg-white px-2 py-0.5 text-[11px] font-medium text-[#737373]">
              <FlaskConical className="size-3 text-[#C93245]" aria-hidden />
              Simulated what-if scenario · Not a real alert
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#737373]">
            Compare normal operating baseline against a simulated Mumbai surge and see how approved transfers avert shortages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {surge ? (
            <Button
              size="sm"
              variant="secondary"
              loading={endSurge.isPending}
              onClick={() => endSurge.mutate()}
              icon={<Power className="size-3.5" aria-hidden />}
            >
              End simulated surge
            </Button>
          ) : (
            SCENARIOS.map((sc) => {
              const Icon = sc.icon;
              return (
                <Button
                  key={sc.kind}
                  size="sm"
                  variant={sc.kind === "flood" ? "primary" : "secondary"}
                  onClick={() => setConfirmKind(sc.kind)}
                  icon={<Icon className="size-3.5" aria-hidden />}
                >
                  {sc.label}
                </Button>
              );
            })
          )}
        </div>
      </div>

      {/* Body: Left metrics + comparison chart, Right regional map */}
      <div className="grid gap-5 p-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          {/* Operating mode indicator + Before/After summary */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#EAE6E3] bg-[#FAF9F6] p-3">
              <p className="text-[11px] font-medium text-[#737373]">Operating mode</p>
              <p className="mt-1 text-sm font-semibold text-[#171717]">
                {surge ? `${surge.label} (${surge.areaName})` : "Normal baseline"}
              </p>
              <p className="mt-0.5 text-[11px] text-[#737373]">
                {surge ? `Radius ${surge.radiusKm} km · Simulated` : "Standard Mumbai daily demand"}
              </p>
            </div>
            <div className="rounded-lg border border-[#EAE6E3] bg-[#FAF9F6] p-3">
              <p className="text-[11px] font-medium text-[#737373]">Earliest stock-out</p>
              <p className="h-num mt-1 text-sm font-semibold text-[#991B1B]">
                {forecast.current.earliestStockoutHours !== null
                  ? formatHours(forecast.current.earliestStockoutHours)
                  : "None <24h"}
              </p>
              <p className="mt-0.5 text-[11px] text-[#737373]">
                With plan:{" "}
                {forecast.withPlan.earliestStockoutHours !== null
                  ? formatHours(forecast.withPlan.earliestStockoutHours)
                  : "Covered 24h+"}
              </p>
            </div>
            <div className="rounded-lg border border-[#BBF7D0] bg-[#ECFDF3]/70 p-3">
              <p className="text-[11px] font-medium text-[#15803D]">Plan risk reduction</p>
              <p className="h-num mt-1 text-sm font-semibold text-[#15803D]">
                −{shortfallReduction}u 24h gap · −{wasteReduction}u waste
              </p>
              <p className="mt-0.5 text-[11px] text-[#15803D]/80">
                {plural(board?.suggestions.length ?? 0, "transfer suggestion")} ready
              </p>
            </div>
          </div>

          {/* Before vs Surge vs With Plan Grouped Bar Chart */}
          <div className="rounded-xl border border-[#EAE6E3] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-[#171717]">Normal vs Current vs With Approved Transfers</h4>
              <div className="flex items-center gap-3 text-[11px] text-[#737373]">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-xs bg-[#D6CFC9]" aria-hidden /> Normal
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-xs bg-[#C93245]" aria-hidden /> Current
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-xs bg-[#15803D]" aria-hidden /> With plan
                </span>
              </div>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6E3" />
                  <XAxis dataKey="metric" tick={{ fill: "#525252", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EAE6E3",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="normal" name="Normal baseline" fill="#D6CFC9" radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                  <Bar dataKey="current" name="Current forecast" fill="#C93245" radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                  <Bar dataKey="withPlan" name="After transfer plan" fill="#15803D" radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Affected groups & AI/template situation brief */}
          {surge && brief.data ? (
            <div className="rounded-xl border border-[#FECACA] bg-[#FFF5F5] p-3.5 text-xs">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#A82436]">
                <Sparkles className="size-3.5" aria-hidden />
                Situation brief ({brief.data.source === "workers-ai" ? "Workers AI" : "Deterministic template"})
              </div>
              <p className="whitespace-pre-line leading-relaxed text-[#171717]">{brief.data.text}</p>
            </div>
          ) : affectedGroups.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-[#737373]">Lines &lt;48h cover:</span>
              {affectedGroups.map((g) => (
                <span
                  key={`${g.bloodGroup}-${g.component}`}
                  className="h-num rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-[#991B1B]"
                >
                  {g.bloodGroup} {COMPONENT_SHORT[g.component]} (~{formatHours(g.stockoutHours!)})
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Regional Map with Surge Radius & Transfer Arcs */}
        <div className="flex flex-col lg:col-span-5">
          <div className="h-72 overflow-hidden rounded-xl border border-[#EAE6E3] lg:h-full lg:min-h-[21rem]">
            <MapErrorBoundary fallbackTitle="Regional Mumbai surge map">
              <CityMap
                theme="clinical"
                markers={markers}
                arcs={arcs}
                surge={surge ? { lat: surge.epicenter.lat, lng: surge.epicenter.lng, radiusKm: surge.radiusKm } : null}
                fitToMarkers
                fitPadding={40}
                label="Regional Mumbai blood network map with simulated surge zone and transfer arcs"
                className="size-full [&_.maplibregl-map]:h-full"
              />
            </MapErrorBoundary>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#737373]">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-xs bg-[#1d5fb8]" aria-hidden /> {hospital.shortName}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#15803D]" aria-hidden /> Covered
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#b45309]" aria-hidden /> Out &lt;24h
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#991B1B]" aria-hidden /> Critical &lt;6h
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-3.5 bg-[#0a7383]" aria-hidden /> Transfer arc
            </span>
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmKind !== null}
        onClose={() => setConfirmKind(null)}
        onConfirm={() => {
          if (confirmKind) startSurge.mutate(confirmKind);
        }}
        pending={startSurge.isPending}
        title="Launch simulated what-if surge scenario?"
        description="This activates a simulated demand multiplier across the local Blood Bridge demo workspace so you can evaluate shortage risks and transfer plans. It is not a real emergency alert."
        confirmLabel="Start simulated scenario"
        confirmVariant="danger"
      >
        {confirmKind ? (
          <p className="rounded-lg border border-[#EAE6E3] bg-[#FAF9F6] p-3 text-xs text-[#525252]">
            {SCENARIOS.find((s) => s.kind === confirmKind)?.summary}
          </p>
        ) : null}
      </ConfirmActionDialog>
    </section>
  );
}

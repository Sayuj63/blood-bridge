import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowRightLeft, BellRing, Check, Search, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { ApproveTransferInput, ForecastDTO, SiteDTO, TransferBoardDTO, TransferSuggestionDTO } from "../../../shared/api";
import { COMPONENT_LABEL, COMPONENT_SHORT, type BloodGroup, type Component } from "../../../shared/domain";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { api, errorMessage } from "../../lib/api";
import { formatHours, plural } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { SurgeScenarioPanel } from "./SurgeScenarioPanel";
import {
  RISK_META,
  RISK_ORDER,
  buildForecastSeries,
  classifyOutlookRisk,
  explainOutlookRisk,
  matchingSuggestions,
} from "./forecastUtils";
import { actAs } from "./useHospitalView";

const TOOLTIP_STYLE = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #EAE6E3",
  borderRadius: "10px",
  boxShadow: "0 10px 28px -10px rgb(127 20 34 / 0.22)",
  fontSize: "12px",
};

export interface PredictiveInsightsProps {
  hospital: SiteDTO;
  sites: SiteDTO[];
  forecast: ForecastDTO | undefined;
  forecastLoading: boolean;
  forecastError: unknown;
  onRetryForecast: () => void;
  board: TransferBoardDTO | undefined;
  selectedLine: { bloodGroup: BloodGroup; component: Component } | null;
  onSelectLine: (line: { bloodGroup: BloodGroup; component: Component }) => void;
  onFindGroup: (group: BloodGroup, component: Component) => void;
  onOpenDonorDrive: (group: BloodGroup, bankId?: string) => void;
}

export function PredictiveInsights({
  hospital,
  sites,
  forecast,
  forecastLoading,
  forecastError,
  onRetryForecast,
  board,
  selectedLine,
  onSelectLine,
  onFindGroup,
  onOpenDonorDrive,
}: PredictiveInsightsProps) {
  const qc = useQueryClient();
  const [pendingTransfer, setPendingTransfer] = useState<TransferSuggestionDTO | null>(null);

  const approveTransfer = useMutation({
    mutationFn: (input: ApproveTransferInput) => {
      actAs(hospital.id);
      return api.transfers.approve(input);
    },
    onSuccess: (t) => {
      toast.success(`Transfer approved: ${t.quantity} × ${t.bloodGroup} to ${t.toName}`);
      setPendingTransfer(null);
      void qc.invalidateQueries({ queryKey: queryKeys.forecast() });
      void qc.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (e) => toast.error("Transfer approval failed", { description: errorMessage(e) }),
  });

  const sortedOutlook = useMemo(() => {
    return [...(forecast?.outlook ?? [])].sort((a, b) => {
      const diff = RISK_ORDER[classifyOutlookRisk(a)] - RISK_ORDER[classifyOutlookRisk(b)];
      if (diff !== 0) return diff;
      return (a.stockoutHours ?? 999) - (b.stockoutHours ?? 999) || b.shortfall - a.shortfall;
    });
  }, [forecast]);

  const activeOutlook = useMemo(() => {
    if (selectedLine) {
      const exact = sortedOutlook.find(
        (o) => o.bloodGroup === selectedLine.bloodGroup && o.component === selectedLine.component,
      );
      if (exact) return exact;
    }
    return sortedOutlook[0] ?? null;
  }, [selectedLine, sortedOutlook]);

  const horizon = forecast?.horizonHours ?? 72;
  const series = useMemo(() => (activeOutlook ? buildForecastSeries(activeOutlook, horizon) : null), [activeOutlook, horizon]);

  const lineRecommendations = useMemo(() => {
    if (!activeOutlook) return [];
    const exact = matchingSuggestions(board?.suggestions, activeOutlook.bloodGroup, activeOutlook.component);
    return exact.length > 0 ? exact : (board?.suggestions ?? []).slice(0, 4);
  }, [board, activeOutlook]);

  const nearestAtRiskBank = useMemo(() => {
    const bankIds = new Set(sites.filter((s) => s.kind === "blood_bank").map((s) => s.id));
    return forecast?.sites
      .filter((s) => bankIds.has(s.siteId) && s.earliestStockoutHours !== null)
      .sort((a, b) => (a.earliestStockoutHours ?? 999) - (b.earliestStockoutHours ?? 999))[0]?.siteId;
  }, [forecast, sites]);

  // Horizontal hours-to-stockout comparison chart across the top 8 riskiest lines
  const coverageBarData = useMemo(
    () =>
      sortedOutlook.slice(0, 8).map((o) => ({
        key: `${o.bloodGroup}|${o.component}`,
        label: `${o.bloodGroup} ${COMPONENT_SHORT[o.component]}`,
        hours: o.stockoutHours ?? horizon,
        risk: classifyOutlookRisk(o),
        bloodGroup: o.bloodGroup,
        component: o.component,
      })),
    [sortedOutlook, horizon],
  );

  if (forecastLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-44 rounded-[20px]" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (forecastError) return <ErrorState what="predictive insights" error={forecastError} onRetry={onRetryForecast} />;
  if (!forecast || !activeOutlook || !series) {
    return <EmptyState icon={<TrendingDown />} title="No forecast data" description="Load demo data to run the 72h forecast." />;
  }

  const activeRisk = classifyOutlookRisk(activeOutlook);
  const activeRiskMeta = RISK_META[activeRisk];
  const explanation = explainOutlookRisk(activeOutlook, forecast);

  const crossingPoint =
    series.crossingHour !== null
      ? series.points.reduce((best, p) =>
          Math.abs(p.hour - series.crossingHour!) < Math.abs(best.hour - series.crossingHour!) ? p : best,
        )
      : null;

  const coverPct =
    activeOutlook.stockoutHours !== null ? Math.max(6, Math.min(100, Math.round((activeOutlook.stockoutHours / horizon) * 100))) : 100;
  const ringR = 38;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc * (1 - coverPct / 100);

  // Selected line composition pie: Usable vs Expiring vs Shortfall
  const lineSplitPie = [
    { name: "Usable", value: series.usableStock, color: "#171717" },
    { name: "Expiring loss", value: activeOutlook.expectedWaste, color: "#E36272" },
    { name: "Shortfall gap", value: activeOutlook.shortfall, color: "#C93245" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      {/* 1. CRIMSON HERO: RADIAL STOCK-OUT GAUGE + SELECTOR + KEY METRICS */}
      <section aria-label="Selected line shortage forecast" className="h-hero-crimson p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-display text-base font-bold text-white">72h Baseline Forecast</span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#FCEBED]">
              Rule-based FIFO · Non-ML
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Inspect blood line"
              value={`${activeOutlook.bloodGroup}|${activeOutlook.component}`}
              onChange={(e) => {
                const [bloodGroup, component] = e.target.value.split("|") as [BloodGroup, Component];
                onSelectLine({ bloodGroup, component });
              }}
              className="focus-ring h-9 cursor-pointer rounded-xl bg-white px-3 text-xs font-bold text-[#A82436] outline-none"
            >
              {sortedOutlook.map((o) => (
                <option key={`${o.bloodGroup}|${o.component}`} value={`${o.bloodGroup}|${o.component}`}>
                  {o.bloodGroup} {COMPONENT_LABEL[o.component]} ({o.stockoutHours !== null ? formatHours(o.stockoutHours) : "72h+"})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onFindGroup(activeOutlook.bloodGroup, activeOutlook.component)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/16 px-3.5 text-xs font-bold text-white ring-1 ring-white/25 hover:bg-white/25"
            >
              <Search className="size-3.5" aria-hidden />
              Find {activeOutlook.bloodGroup}
            </button>
          </div>
        </div>

        <div className="mt-4 grid items-center gap-5 lg:grid-cols-12">
          {/* Radial Stock-Out Countdown Ring */}
          <div className="flex items-center gap-4 lg:col-span-4">
            <div className="relative grid size-24 shrink-0 place-items-center">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r={ringR} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r={ringR}
                  fill="none"
                  stroke="#FCEBED"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="h-num text-sm font-extrabold text-white">
                  {activeOutlook.stockoutHours !== null ? formatHours(activeOutlook.stockoutHours) : `>${horizon}h`}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-[#FCEBED]/75">Cover</span>
              </div>
            </div>
            <div>
              <p className="h-display text-xl font-extrabold text-white">
                {activeOutlook.bloodGroup.replace("-", "−")} {COMPONENT_LABEL[activeOutlook.component]}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/16 px-2.5 py-0.5 text-[11px] font-bold text-[#FCEBED]">
                {activeRiskMeta.label}
              </p>
            </div>
          </div>

          {/* 5 Visual Metric Tiles */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:col-span-8">
            <CrimsonMetric label="Usable" value={series.usableStock} sub={`of ${activeOutlook.onHand}u`} />
            <CrimsonMetric label="72h Demand" value={series.expectedDemand} sub={`${activeOutlook.demandPerHour}/hr`} />
            <CrimsonMetric label="Proj +72h" value={series.projectedEndStock} sub="remaining" />
            <CrimsonMetric label="Safety Target" value={series.safetyTarget} sub="24h buffer" />
            <CrimsonMetric label="Shortfall Gap" value={activeOutlook.shortfall} sub={`${activeOutlook.sitesAtRisk} sites <24h`} />
          </div>
        </div>
      </section>

      {/* 2. CENTERPIECE 72h FORECAST TRAJECTORY + VISUAL RISK PIE & FORMULA */}
      <div className="grid gap-4 xl:grid-cols-12">
        <section aria-labelledby="forecast-graph-title" className="h-card p-5 xl:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="forecast-graph-title" className="h-display text-sm font-bold text-[#171717]">
              Stock depletion vs demand curve
            </h2>
            {series.crossingHour !== null ? (
              <span className="h-num rounded-full bg-[#FCEBED] px-2.5 py-0.5 text-[11px] font-bold text-[#C93245]">
                {series.crossingHour === 0 ? "Below safety target now" : `Crosses safety target at +${series.crossingHour}h`}
              </span>
            ) : null}
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series.points} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="projCrimsonGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C93245" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#C93245" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6E3" />
                <XAxis dataKey="label" tick={{ fill: "#171717", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown, n: unknown) => [
                    `${v} units`,
                    n === "projectedStock" ? "Projected stock" : n === "cumulativeDemand" ? "Cumulative demand" : "Safety target",
                  ]}
                />
                {series.safetyTarget > 0 ? (
                  <ReferenceLine
                    y={series.safetyTarget}
                    stroke="#CA8A04"
                    strokeDasharray="6 4"
                    strokeWidth={1.75}
                    label={{ value: `Safety (${series.safetyTarget}u)`, position: "insideTopRight", fill: "#A16207", fontSize: 11, fontWeight: 700 }}
                  />
                ) : null}
                {crossingPoint ? (
                  <ReferenceLine x={crossingPoint.label} stroke="#C93245" strokeDasharray="3 3" strokeOpacity={0.5} />
                ) : null}
                <Area
                  type="monotone"
                  dataKey="projectedStock"
                  stroke="#C93245"
                  strokeWidth={2.75}
                  fill="url(#projCrimsonGrad)"
                  isAnimationActive={false}
                  activeDot={{ r: 5, fill: "#C93245", stroke: "#FFFFFF", strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeDemand"
                  stroke="#171717"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  isAnimationActive={false}
                  dot={false}
                />
                {crossingPoint ? (
                  <ReferenceDot x={crossingPoint.label} y={crossingPoint.projectedStock} r={5.5} fill="#C93245" stroke="#FFFFFF" strokeWidth={2.5} />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-5 border-t border-[#EAE6E3] pt-3 text-xs font-medium text-[#737373]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full bg-[#C93245]" aria-hidden /> Projected stock
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-[#171717]" aria-hidden /> Cumulative demand
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-[#CA8A04]" aria-hidden /> Safety threshold
            </span>
          </div>
        </section>

        {/* Visual Breakdown PieChart + Explainable Formula Chips */}
        <section aria-labelledby="why-risk-title" className="h-card-blush flex flex-col justify-between p-5 xl:col-span-4">
          <div>
            <h2 id="why-risk-title" className="h-display text-sm font-bold text-[#171717]">
              Why is this blood group at risk?
            </h2>

            <div className="my-3 grid grid-cols-[8.5rem_1fr] items-center gap-3">
              <div className="relative h-32 w-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lineSplitPie.length ? lineSplitPie : [{ name: "Covered", value: 1, color: "#171717" }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={54}
                      paddingAngle={3}
                      cornerRadius={4}
                      isAnimationActive={false}
                    >
                      {(lineSplitPie.length ? lineSplitPie : [{ name: "Covered", value: 1, color: "#171717" }]).map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="h-num text-sm font-extrabold text-[#171717]">{activeOutlook.onHand}</span>
                  <span className="text-[9px] font-semibold text-[#737373]">On hand</span>
                </div>
              </div>

              <ul className="space-y-1.5 text-xs">
                {lineSplitPie.map((d) => (
                  <li key={d.name} className="flex items-center justify-between rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-[#EAE6E3]">
                    <span className="flex items-center gap-1.5 text-[#525252]">
                      <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
                      {d.name}
                    </span>
                    <span className="h-num font-bold text-[#171717]">{d.value}u</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual Formula Strip */}
            <div className="h-num grid grid-cols-3 gap-1.5 rounded-xl bg-white p-2 text-center ring-1 ring-[#EAE6E3]">
              <div>
                <span className="block text-[10px] text-[#737373]">On hand</span>
                <span className="text-xs font-extrabold text-[#171717]">{activeOutlook.onHand}u</span>
              </div>
              <div className="border-x border-[#EAE6E3]">
                <span className="block text-[10px] text-[#737373]">Expiring</span>
                <span className="text-xs font-extrabold text-[#C93245]">−{activeOutlook.expectedWaste}u</span>
              </div>
              <div>
                <span className="block text-[10px] text-[#737373]">Burn/hr</span>
                <span className="text-xs font-extrabold text-[#171717]">{activeOutlook.demandPerHour}</span>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-white/90 p-3 text-xs leading-relaxed text-[#171717] ring-1 ring-[#EAE6E3]">
              {explanation}
            </p>
          </div>
        </section>
      </div>

      {/* 3. COVERAGE HORIZON COMPARISON CHART + RECOMMENDED ACTIONS */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Horizontal Hours-to-Stockout BarChart (click any bar to inspect!) */}
        <section aria-label="Soonest stockout comparison" className="h-card p-5 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="h-display text-sm font-bold text-[#171717]">Soonest stock-outs (hours)</h2>
            <span className="text-[11px] font-medium text-[#737373]">Click bar to inspect</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageBarData} layout="vertical" margin={{ top: 2, right: 18, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EAE6E3" />
                <XAxis type="number" domain={[0, horizon]} tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={68}
                  tick={{ fill: "#171717", fontSize: 11, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  cursor={{ fill: "#FFF5F5" }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown) => [`${v}h cover`, "Horizon"]}
                />
                <ReferenceLine x={24} stroke="#C93245" strokeDasharray="4 4" />
                <Bar
                  dataKey="hours"
                  radius={[0, 6, 6, 0]}
                  barSize={18}
                  isAnimationActive={false}
                  className="cursor-pointer"
                  onClick={(d) => {
                    const row = d?.payload as (typeof coverageBarData)[number] | undefined;
                    if (row) onSelectLine({ bloodGroup: row.bloodGroup, component: row.component });
                  }}
                >
                  {coverageBarData.map((row) => (
                    <Cell
                      key={row.key}
                      fill={
                        row.key === `${activeOutlook.bloodGroup}|${activeOutlook.component}`
                          ? "#A82436"
                          : row.risk === "critical"
                            ? "#C93245"
                            : row.risk === "gap"
                              ? "#E36272"
                              : "#E8A2AB"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Actionable Replenishment Recommendations */}
        <section aria-labelledby="recs-title" className="h-card p-5 xl:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="recs-title" className="h-display text-sm font-bold text-[#171717]">
              Actionable replenishment moves
            </h2>
            {activeOutlook.shortfall > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onOpenDonorDrive(activeOutlook.bloodGroup, nearestAtRiskBank)}
                icon={<BellRing className="size-3.5 text-[#C93245]" aria-hidden />}
              >
                Donor drive ({activeOutlook.bloodGroup})
              </Button>
            ) : null}
          </div>

          {lineRecommendations.length === 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-[#FAF9F6] p-4">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[#171717]">
                <Check className="size-4 text-[#15803D]" aria-hidden />
                No transfers required right now
              </div>
              <Button size="sm" variant="primary" onClick={() => onFindGroup(activeOutlook.bloodGroup, activeOutlook.component)}>
                Find stock
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lineRecommendations.map((s) => (
                <div
                  key={s.key}
                  className="h-card-blush h-card-interactive flex flex-col justify-between p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="h-num inline-flex items-center gap-1.5 rounded-lg bg-[#C93245] px-2 py-0.5 text-[11px] font-bold text-white">
                        {s.bloodGroup.replace("-", "−")} · {s.quantity}u {COMPONENT_SHORT[s.component]}
                      </span>
                      <span className="h-num text-[11px] font-bold text-[#C93245]">
                        {s.receiverStockoutHours !== null ? `Dry ~${formatHours(s.receiverStockoutHours)}` : `Short ${s.receiverShortfall}u`}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#171717]">
                      <span className="truncate">{s.fromName}</span>
                      <ArrowRight className="size-3.5 shrink-0 text-[#C93245]" aria-hidden />
                      <span className="truncate">{s.toName}</span>
                    </p>
                    <p className="h-num mt-1 text-[11px] text-[#737373]">
                      ETA ~{s.etaMinutes} min {s.rescuedFromExpiry > 0 ? `· Rescues ${s.rescuedFromExpiry} expiring` : ""}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onClick={() => setPendingTransfer(s)}
                      icon={<ArrowRightLeft className="size-3" aria-hidden />}
                    >
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onFindGroup(s.bloodGroup, s.component)}>
                      Find
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 4. SURGE STRESS-TEST PANEL */}
      <SurgeScenarioPanel hospital={hospital} sites={sites} forecast={forecast} board={board} />

      <ConfirmActionDialog
        open={pendingTransfer !== null}
        onClose={() => setPendingTransfer(null)}
        onConfirm={() => {
          if (!pendingTransfer) return;
          approveTransfer.mutate({
            fromSiteId: pendingTransfer.fromSiteId,
            toSiteId: pendingTransfer.toSiteId,
            bloodGroup: pendingTransfer.bloodGroup,
            component: pendingTransfer.component,
            quantity: pendingTransfer.quantity,
          });
        }}
        pending={approveTransfer.isPending}
        title="Authorize inter-bank transfer?"
        description="Explicit operator confirmation is required before moving units."
        confirmLabel="Approve transfer"
      >
        {pendingTransfer ? (
          <div className="rounded-xl bg-[#FFF5F5] p-3 text-xs ring-1 ring-[#EAE6E3]">
            <p className="font-bold text-[#171717]">
              {plural(pendingTransfer.quantity, "unit")} · {pendingTransfer.bloodGroup} {COMPONENT_LABEL[pendingTransfer.component]}
            </p>
            <p className="mt-1 text-[#737373]">
              {pendingTransfer.fromName} → {pendingTransfer.toName} · ETA ~{pendingTransfer.etaMinutes} min
            </p>
          </div>
        ) : null}
      </ConfirmActionDialog>
    </div>
  );
}

function CrimsonMetric({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl bg-white/12 px-3 py-2.5 ring-1 ring-white/15">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#FCEBED]/75">{label}</span>
      <span className="h-num mt-0.5 block text-xl font-extrabold text-white">{value.toLocaleString("en-IN")}</span>
      <span className="block text-[10px] text-[#FCEBED]/75">{sub}</span>
    </div>
  );
}

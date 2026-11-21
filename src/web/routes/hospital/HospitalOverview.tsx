import { ArrowRight, ArrowUpRight, Clock, Droplets, Search, ShieldAlert, TrendingUp } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastDTO, RequestDTO, SiteDTO, SiteStockDTO } from "../../../shared/api";
import { COMPONENT_LABEL, COMPONENT_SHORT, type BloodGroup, type Component } from "../../../shared/domain";
import { etaMinutes, haversineKm } from "../../../shared/geo";
import { Skeleton } from "../../components/ui/Skeleton";
import { cn } from "../../lib/cn";
import { formatHours, plural } from "../../lib/format";
import { FindBloodView } from "./FindBloodView";
import {
  RISK_META,
  RISK_ORDER,
  aggregateByBloodGroup,
  aggregateByComponent,
  buildForecastSeries,
  classifyOutlookRisk,
  type RiskTier,
} from "./forecastUtils";
import type { RequestFormValues } from "./formModel";
import { unitsHeld } from "./statusMeta";
import type { HospitalSection } from "./useHospitalView";

export interface HospitalOverviewProps {
  hospital: SiteDTO;
  sites: SiteDTO[];
  stock: SiteStockDTO | undefined;
  stockLoading: boolean;
  forecast: ForecastDTO | undefined;
  forecastLoading: boolean;
  requests: RequestDTO[];
  embed: boolean;
  formValues: RequestFormValues;
  onFormChange: (values: RequestFormValues) => void;
  autoSearchToken: number;
  scrollToFindToken: number;
  onNavigate: (section: HospitalSection) => void;
  onFindGroup: (group: BloodGroup, component?: Component) => void;
  onInspectGroup: (group: BloodGroup, component: Component) => void;
  onOpenRequest: (requestId: string) => void;
  onOpenCompatibility: () => void;
}

/** Cohesive crimson-editorial palette for charts — zero clashing rainbow hues. */
const COMPONENT_TONE: Record<Component, string> = {
  plasma: "#A82436",
  red_cells: "#C93245",
  platelets: "#E36272",
  whole_blood: "#F2A8B2",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #EAE6E3",
  borderRadius: "12px",
  boxShadow: "0 12px 30px -10px rgb(127 20 34 / 0.2)",
  fontSize: "12px",
  color: "#171717",
};

export function HospitalOverview({
  hospital,
  sites,
  stock,
  stockLoading,
  forecast,
  forecastLoading,
  requests,
  embed,
  formValues,
  onFormChange,
  autoSearchToken,
  scrollToFindToken,
  onNavigate,
  onFindGroup,
  onInspectGroup,
  onOpenRequest,
  onOpenCompatibility,
}: HospitalOverviewProps) {
  const scrollToFind = () => {
    document.getElementById("find-blood")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (scrollToFindToken > 0) {
      const id = window.requestAnimationFrame(() => scrollToFind());
      return () => window.cancelAnimationFrame(id);
    }
  }, [scrollToFindToken]);
  const banks = useMemo(() => sites.filter((s) => s.kind === "blood_bank"), [sites]);
  const groupRows = useMemo(() => aggregateByBloodGroup(forecast, sites), [forecast, sites]);
  const componentRows = useMemo(() => aggregateByComponent(forecast), [forecast]);

  const totalNetworkUnits = useMemo(() => banks.reduce((sum, b) => sum + b.totalAvailable, 0), [banks]);
  const hospitalOnHand = stock?.totals.onHand ?? 0;
  const openRequests = useMemo(() => requests.filter((r) => r.status === "open"), [requests]);
  const reservedUnits = useMemo(
    () => openRequests.reduce((sum, r) => sum + unitsHeld(r), 0) + (stock?.totals.reserved ?? 0),
    [openRequests, stock],
  );
  const cityWaste72h = forecast?.current.expectedWaste ?? 0;
  const cityShortfall72h = forecast?.current.shortfall ?? 0;
  const expiring48h = stock?.totals.expiring48h ?? 0;
  const expiring7d = stock?.totals.expiring7d ?? 0;
  const atRiskGroups = useMemo(() => groupRows.filter((g) => g.risk !== "sufficient"), [groupRows]);

  const usablePct = totalNetworkUnits > 0 ? Math.round(((totalNetworkUnits - cityWaste72h) / totalNetworkUnits) * 1000) / 10 : 100;

  const urgentLines = useMemo(
    () =>
      [...(forecast?.outlook ?? [])]
        .filter((o) => classifyOutlookRisk(o) !== "sufficient")
        .sort((a, b) => RISK_ORDER[classifyOutlookRisk(a)] - RISK_ORDER[classifyOutlookRisk(b)] || (a.stockoutHours ?? 999) - (b.stockoutHours ?? 999))
        .slice(0, 5),
    [forecast],
  );

  // Sparkline trajectory inside the crimson hero (most urgent blood line)
  const heroSpark = useMemo(() => {
    const top = urgentLines[0] ?? forecast?.outlook[0];
    if (!top) return [];
    return buildForecastSeries(top, forecast?.horizonHours ?? 72).points;
  }, [urgentLines, forecast]);

  // Component pie chart data
  const componentPie = useMemo(
    () =>
      componentRows
        .map((c) => ({
          key: c.component,
          name: c.label,
          short: c.shortLabel,
          value: c.onHand,
          pct: totalNetworkUnits > 0 ? Math.round((c.onHand / totalNetworkUnits) * 1000) / 10 : 0,
          color: COMPONENT_TONE[c.component],
        }))
        .sort((a, b) => b.value - a.value),
    [componentRows, totalNetworkUnits],
  );

  // Risk & expiry breakdown pie chart (visually proportioned for immediate clarity)
  const riskTierPie = useMemo(() => {
    const counts: Record<RiskTier, number> = { critical: 0, gap: 0, approaching: 0, sufficient: 0 };
    for (const o of forecast?.outlook ?? []) {
      counts[classifyOutlookRisk(o)] += 1;
    }
    return [
      { name: "Sufficient", value: counts.sufficient, color: "#171717" },
      { name: "Approaching", value: counts.approaching, color: "#F2A8B2" },
      { name: "Near-term gap", value: counts.gap, color: "#E36272" },
      { name: "Critical", value: counts.critical, color: "#C93245" },
    ].filter((d) => d.value > 0);
  }, [forecast]);

  // Nearest 5 blood banks with visual ETA ratio
  const nearestBanks = useMemo(() => {
    const list = banks
      .map((b) => ({
        site: b,
        km: Math.round(haversineKm(hospital, b) * 10) / 10,
        eta: etaMinutes(hospital, b),
      }))
      .sort((a, b) => a.eta - b.eta)
      .slice(0, 5);
    const maxEta = Math.max(...list.map((x) => x.eta), 1);
    return list.map((x) => ({ ...x, pct: Math.max(18, Math.round((x.eta / maxEta) * 100)) }));
  }, [banks, hospital]);

  if (forecastLoading || stockLoading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-52 rounded-[20px]" />
        <div className="grid gap-4 xl:grid-cols-12">
          <Skeleton className="h-80 rounded-2xl xl:col-span-7" />
          <Skeleton className="h-80 rounded-2xl xl:col-span-5" />
        </div>
      </div>
    );
  }

  const ringRadius = 42;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc * (1 - usablePct / 100);
  const horizon = forecast?.horizonHours ?? 72;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. SCULPTURAL DEEP-CRIMSON HERO COMMAND BANNER */}
      <section aria-label="Live network telemetry" className="h-hero-crimson relative overflow-hidden p-5 sm:p-6">
        {/* Subtle radial highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#FCEBED]/12 blur-3xl"
        />

        <div className="relative grid items-center gap-6 lg:grid-cols-12">
          {/* Left: Focal Stock Counter + 4 Visual Stat Pills */}
          <div className="lg:col-span-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="h-num text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                {totalNetworkUnits.toLocaleString("en-IN")}
              </span>
              <span className="text-sm font-medium text-[#FCEBED]/80">available units · {banks.length} Mumbai banks</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <HeroStat
                label="Reserved"
                value={reservedUnits}
                sub={openRequests.length > 0 ? `${openRequests.length} open` : "0 open"}
                onClick={() => (openRequests[0] ? onOpenRequest(openRequests[0].id) : onNavigate("reservations"))}
              />
              <HeroStat
                label="Expiry ≤72h"
                value={cityWaste72h}
                sub={`Fridge: ${expiring48h}`}
                onClick={() => onNavigate("inventory")}
              />
              <HeroStat
                label="At risk"
                value={`${atRiskGroups.length}/8`}
                sub={urgentLines[0] ? `${urgentLines[0].bloodGroup} ${COMPONENT_SHORT[urgentLines[0].component]}` : "Stable"}
                onClick={() => onNavigate("insights")}
              />
              <HeroStat
                label="72h Gap"
                value={cityShortfall72h}
                sub={`Fridge: ${hospitalOnHand}u`}
                onClick={() => onNavigate("insights")}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={scrollToFind}
                className="focus-ring group inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#A82436] shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#FFF5F5] hover:shadow-lg"
              >
                <Search className="size-3.5" aria-hidden />
                <span>Find compatible blood</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("insights")}
                className="focus-ring inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-white/14 px-4 text-xs font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/24"
              >
                <TrendingUp className="size-3.5" aria-hidden />
                <span>Forecast &amp; surge</span>
                <ArrowUpRight className="size-3.5 opacity-80" aria-hidden />
              </button>
            </div>
          </div>

          {/* Center: Live Radial Readiness Gauge */}
          <div className="flex items-center justify-center lg:col-span-2">
            <div className="relative grid size-28 place-items-center">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="#FCEBED"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="h-num text-xl font-extrabold text-white">{usablePct}%</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#FCEBED]/80">Usable</span>
              </div>
            </div>
          </div>

          {/* Right: Live 72h Depletion Spark-Area directly in the Crimson Hero */}
          <div className="rounded-2xl bg-black/18 p-3.5 ring-1 ring-white/15 lg:col-span-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#FCEBED]" aria-hidden />
                <span className="text-xs font-semibold text-white">
                  {urgentLines[0]
                    ? `${urgentLines[0].bloodGroup} ${COMPONENT_SHORT[urgentLines[0].component]} · 72h curve`
                    : "72h Supply Curve"}
                </span>
              </div>
              {urgentLines[0]?.stockoutHours != null ? (
                <span className="h-num rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold text-[#FCEBED]">
                  Out ~{formatHours(urgentLines[0].stockoutHours)}
                </span>
              ) : null}
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={heroSpark} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heroSparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FCEBED" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#FCEBED" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#171717",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "#FFFFFF",
                    }}
                    formatter={(v: unknown) => [`${v} units`, "Projected"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="projectedStock"
                    stroke="#FFFFFF"
                    strokeWidth={2.2}
                    fill="url(#heroSparkGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="h-num mt-1 flex justify-between text-[10px] text-[#FCEBED]/70">
              <span>Now</span>
              <span>+24h</span>
              <span>+48h</span>
              <span>+72h</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. EMBEDDED FIND BLOOD WORKSPACE (directly inside Overview) */}
      <div id="find-blood" className={cn("scroll-mt-20", embed && "order-first")}>
        <FindBloodView
          key={hospital.id}
          hospital={hospital}
          sites={sites}
          formValues={formValues}
          onFormChange={onFormChange}
          autoSearchToken={autoSearchToken}
          onOpenRequest={onOpenRequest}
          onOpenCompatibility={onOpenCompatibility}
        />
      </div>

      {/* 3. PRIMARY VISUAL CHARTS BENTO: BLOOD GROUP BAR CHART + COMPONENT DONUT PIE CHART */}
      <section aria-label="Stock distribution visualizations" className="grid gap-4 xl:grid-cols-12">
        {/* Blood Group Bar Chart (Cohesive Crimson Tonal Bars) */}
        <div className="h-card p-5 xl:col-span-7">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="h-display text-sm font-bold text-[#171717]">Blood group stock</h2>
            <div className="flex items-center gap-3 text-[11px] font-medium text-[#737373]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-[#C93245]" aria-hidden /> Rh+
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-[#EE929E]" aria-hidden /> Rh−
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupRows} margin={{ top: 22, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6E3" />
                <XAxis
                  dataKey="bloodGroup"
                  tick={{ fill: "#171717", fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  cursor={{ fill: "#FFF5F5" }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: unknown) => [`${Number(value).toLocaleString("en-IN")} units`, "Available"]}
                />
                <Bar
                  dataKey="onHand"
                  radius={[8, 8, 2, 2]}
                  maxBarSize={44}
                  isAnimationActive={false}
                  onClick={(data) => {
                    const row = data?.payload as (typeof groupRows)[number] | undefined;
                    if (row) onInspectGroup(row.bloodGroup, row.worstComponent ?? "platelets");
                  }}
                  className="cursor-pointer"
                >
                  <LabelList
                    dataKey="onHand"
                    position="top"
                    formatter={(v: unknown) => Number(v).toLocaleString("en-IN")}
                    style={{ fill: "#737373", fontSize: 11, fontWeight: 600 }}
                  />
                  {groupRows.map((entry) => (
                    <Cell
                      key={entry.bloodGroup}
                      fill={entry.bloodGroup.endsWith("-") ? "#EE929E" : entry.risk === "critical" ? "#A82436" : "#C93245"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Component Composition Donut / Pie Chart (Blush-tinted surface!) */}
        <div className="h-card-blush flex flex-col justify-between p-5 xl:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="h-display text-sm font-bold text-[#171717]">Component mix</h2>
            <span className="h-num rounded-full bg-[#FCEBED] px-2.5 py-0.5 text-[11px] font-bold text-[#C93245]">
              4 types
            </span>
          </div>

          <div className="my-2 grid items-center gap-4 sm:grid-cols-[12rem_1fr]">
            <div className="relative mx-auto h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={componentPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    cornerRadius={5}
                    stroke="#FFF5F5"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {componentPie.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: unknown) => [`${Number(v).toLocaleString("en-IN")} units`, "Stock"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="h-num text-xl font-extrabold text-[#171717]">{totalNetworkUnits.toLocaleString("en-IN")}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">Total</span>
              </div>
            </div>

            <ul className="space-y-2.5">
              {componentPie.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[#EAE6E3]">
                  <span className="flex items-center gap-2 text-xs font-semibold text-[#171717]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                    {c.name}
                  </span>
                  <span className="h-num text-xs font-bold text-[#171717]">
                    {c.value.toLocaleString("en-IN")} <span className="font-medium text-[#737373]">({c.pct}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3. SECONDARY VISUAL ANALYTICS: COUNTDOWN GAUGES + RISK PIE CHART + NEAREST BANKS ETA */}
      <section aria-label="Risk and readiness visuals" className="grid gap-4 lg:grid-cols-12">
        {/* 72h Countdown Fill Bars */}
        <div className="h-card p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-[#C93245]" aria-hidden />
              <h2 className="h-display text-sm font-bold text-[#171717]">72h shortage pressure</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("insights")}
              className="focus-ring inline-flex items-center gap-1 text-xs font-semibold text-[#C93245] hover:text-[#A82436]"
            >
              Forecast <ArrowUpRight className="size-3.5" aria-hidden />
            </button>
          </div>

          <ul className="space-y-2.5">
            {urgentLines.map((item) => {
              const tier = classifyOutlookRisk(item);
              const meta = RISK_META[tier];
              const pct = item.stockoutHours !== null ? Math.max(8, Math.min(100, Math.round((item.stockoutHours / horizon) * 100))) : 100;
              return (
                <li key={`${item.bloodGroup}-${item.component}`}>
                  <button
                    type="button"
                    onClick={() => onInspectGroup(item.bloodGroup, item.component)}
                    aria-label={`Inspect ${item.bloodGroup} ${COMPONENT_LABEL[item.component]} 72-hour forecast`}
                    className="focus-ring group w-full cursor-pointer rounded-xl border border-transparent bg-[#FAF9F6] p-2.5 text-left transition-all hover:border-[#F2D7DB] hover:bg-[#FFF5F5]"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-num inline-flex h-5 min-w-8 items-center justify-center rounded-md bg-[#C93245] px-1.5 text-[11px] font-bold text-white">
                          {item.bloodGroup.replace("-", "−")}
                        </span>
                        <span className="font-semibold text-[#171717] group-hover:text-[#A82436]">{COMPONENT_LABEL[item.component]}</span>
                        <span className="h-num text-[11px] text-[#737373]">{item.onHand}u</span>
                      </div>
                      <span className="h-num inline-flex items-center gap-1 font-bold" style={{ color: meta.textColor }}>
                        {item.stockoutHours !== null ? formatHours(item.stockoutHours) : "Gap"}
                        <ArrowUpRight className="size-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" aria-hidden />
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EAE6E3]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: tier === "critical" ? "#C93245" : tier === "gap" ? "#E36272" : "#E69AA4" }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Risk Line Split PieChart */}
        <div className="h-card-blush flex flex-col justify-between p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="h-display text-sm font-bold text-[#171717]">Risk split</h2>
            <span className="h-num text-xs font-semibold text-[#C93245]">{forecast?.outlook.length ?? 0} lines</span>
          </div>
          <div className="relative mx-auto my-1 h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskTierPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="#FFF5F5"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {riskTierPie.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="h-num text-lg font-extrabold text-[#C93245]">{urgentLines.length}</span>
              <span className="text-[10px] font-semibold text-[#737373]">At risk</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {riskTierPie.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg bg-white/80 px-2 py-1 ring-1 ring-[#EAE6E3]">
                <span className="flex items-center gap-1.5 text-[#525252]">
                  <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                  {r.name}
                </span>
                <span className="h-num font-bold text-[#171717]">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#FCEBED]/70 px-2.5 py-1.5 text-[11px]">
            <span className="font-medium text-[#A82436]">Fridge ≤48h / ≤7d</span>
            <span className="h-num font-bold text-[#A82436]">
              {expiring48h} / {expiring7d}
            </span>
          </div>
        </div>

        {/* Nearest Supply Centres Visual ETA */}
        <div className="h-card flex flex-col justify-between p-5 lg:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#C93245]" aria-hidden />
              <h2 className="h-display text-sm font-bold text-[#171717]">Nearest banks · ETA</h2>
            </div>
            <button
              type="button"
              onClick={scrollToFind}
              className="focus-ring text-xs font-semibold text-[#C93245] hover:text-[#A82436]"
            >
              Search →
            </button>
          </div>
          <ul className="mt-3 space-y-2.5">
            {nearestBanks.map(({ site, km, eta, pct }) => (
              <li key={site.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-[#171717]">{site.shortName}</span>
                  <span className="h-num shrink-0 font-bold text-[#C93245]">{site.totalAvailable}u</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#FCEBED]">
                    <div className="h-full rounded-full bg-[#C93245]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="h-num w-20 text-right text-[11px] text-[#737373]">
                    {km}km · {eta}m
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FAF9F6] px-3 py-2 text-xs">
            <span className="text-[#737373]">Active hospital holds</span>
            <button
              type="button"
              onClick={() => onNavigate("reservations")}
              className="h-num font-bold text-[#C93245] hover:underline"
            >
              {plural(openRequests.length, "request")} →
            </button>
          </div>
        </div>
      </section>

      {/* 4. VISUAL 8-GROUP BLOOD MATRIX */}
      <section aria-labelledby="blood-matrix-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Droplets className="size-4 text-[#C93245]" aria-hidden />
            <h2 id="blood-matrix-heading" className="h-display text-sm font-bold text-[#171717]">
              Blood group readiness
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-[#737373]">
            {(["sufficient", "approaching", "gap", "critical"] as RiskTier[]).map((tier) => (
              <span key={tier} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: RISK_META[tier].dotColor }} aria-hidden />
                {RISK_META[tier].shortLabel}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {groupRows.map((g) => {
            const meta = RISK_META[g.risk];
            const isAtRisk = g.risk === "critical" || g.risk === "gap";
            const totalComp = Math.max(1, g.onHand);
            return (
              <div
                key={g.bloodGroup}
                className={cn(
                  "h-card-interactive flex flex-col justify-between p-4",
                  isAtRisk ? "h-card-blush" : "h-card",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "h-num grid size-10 place-items-center rounded-xl text-sm font-extrabold",
                        isAtRisk ? "bg-[#C93245] text-white" : "bg-[#FCEBED] text-[#A82436]",
                      )}
                    >
                      {g.bloodGroup.replace("-", "−")}
                    </span>
                    <div>
                      <p className="h-num text-xl font-extrabold leading-none text-[#171717]">
                        {g.onHand.toLocaleString("en-IN")}
                      </p>
                      <p className="h-num mt-1 text-[11px] text-[#737373]">
                        {g.earliestStockoutHours !== null ? `Out ~${formatHours(g.earliestStockoutHours)}` : "72h+ cover"}
                      </p>
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: meta.bgColor, color: meta.textColor }}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.dotColor }} aria-hidden />
                    {meta.shortLabel}
                  </span>
                </div>

                {/* Proportional 4-component stacked bar */}
                <div className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-[#EAE6E3]">
                  {(["plasma", "red_cells", "platelets", "whole_blood"] as Component[]).map((comp) => {
                    const w = (g.byComponent[comp] / totalComp) * 100;
                    if (w <= 0) return null;
                    return (
                      <div
                        key={comp}
                        title={`${COMPONENT_LABEL[comp]}: ${g.byComponent[comp]}`}
                        style={{ width: `${w}%`, backgroundColor: COMPONENT_TONE[comp] }}
                      />
                    );
                  })}
                </div>

                <div className="h-num mt-2 flex items-center justify-between text-[10px] font-semibold text-[#737373]">
                  <span>PRBC {g.byComponent.red_cells}</span>
                  <span>PLT {g.byComponent.platelets}</span>
                  <span>FFP {g.byComponent.plasma}</span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#EAE6E3] pt-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onInspectGroup(g.bloodGroup, g.worstComponent ?? "platelets")}
                    aria-label={`View ${g.bloodGroup} forecast`}
                    className="focus-ring cursor-pointer rounded-lg px-2 py-1 font-semibold text-[#525252] transition-colors hover:bg-[#FAF9F6] hover:text-[#171717]"
                  >
                    Forecast
                  </button>
                  <button
                    type="button"
                    onClick={() => onFindGroup(g.bloodGroup, g.worstComponent ?? "red_cells")}
                    aria-label={`Find available ${g.bloodGroup} blood`}
                    className="focus-ring group inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#FCEBED] px-2.5 py-1 font-bold text-[#A82436] transition-colors hover:bg-[#C93245] hover:text-white"
                  >
                    <span>Find</span>
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value} (${sub}). Open details`}
      className="focus-ring group cursor-pointer rounded-xl bg-white/12 px-3 py-2 text-left ring-1 ring-white/15 transition-all hover:-translate-y-0.5 hover:bg-white/22 hover:ring-white/35"
    >
      <span className="flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#FCEBED]/80">
        <span>{label}</span>
        <ArrowUpRight className="size-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" aria-hidden />
      </span>
      <span className="h-num mt-0.5 block text-lg font-extrabold leading-tight text-white">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </span>
      <span className="mt-0.5 block truncate text-[10px] text-[#FCEBED]/85">{sub}</span>
    </button>
  );
}

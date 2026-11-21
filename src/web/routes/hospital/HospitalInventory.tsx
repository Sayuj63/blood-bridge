import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Check, Package, RotateCcw, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { ForecastDTO, SiteDTO, SiteStockDTO } from "../../../shared/api";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, COMPONENT_SHORT, POLICY, type BloodGroup, type Component } from "../../../shared/domain";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { ExpiryBadge } from "../../components/ui/ExpiryBadge";
import { FreshnessPill } from "../../components/ui/FreshnessPill";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { api, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatHours, formatISTDateTime, plural, spokenGroup } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { RISK_META, classifyOutlookRisk, stockCellRiskTier, type RiskTier } from "./forecastUtils";
import { actAs } from "./useHospitalView";
import { useTick } from "./useTick";

type InventoryScope = "network" | "fridge";
type ExpiryFilter = "all" | "48h" | "7d" | "fresh";

const COMPONENT_TONE: Record<Component, string> = {
  plasma: "#A82436",
  red_cells: "#C93245",
  platelets: "#E36272",
  whole_blood: "#F2A8B2",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #EAE6E3",
  borderRadius: "10px",
  boxShadow: "0 10px 24px -10px rgb(127 20 34 / 0.2)",
  fontSize: "12px",
};

const offeredCount = (res: unknown, fallback: number): number =>
  typeof res === "object" && res !== null && "offered" in res && typeof res.offered === "number" ? res.offered : fallback;

export interface HospitalInventoryProps {
  hospital: SiteDTO;
  stock: SiteStockDTO | undefined;
  stockLoading: boolean;
  stockError: unknown;
  onRetryStock: () => void;
  forecast: ForecastDTO | undefined;
  onFindGroup: (group: BloodGroup, component: Component) => void;
}

export function HospitalInventory({
  hospital,
  stock,
  stockLoading,
  stockError,
  onRetryStock,
  forecast,
  onFindGroup,
}: HospitalInventoryProps) {
  const queryClient = useQueryClient();
  const now = useTick(60_000);
  const [scope, setScope] = useState<InventoryScope>("network");
  const [groupFilter, setGroupFilter] = useState<BloodGroup | "all">("all");
  const [componentFilter, setComponentFilter] = useState<Component | "all">("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskTier | "all">("all");
  const [selectedUnits, setSelectedUnits] = useState<ReadonlySet<string>>(new Set());
  const [confirmOfferOpen, setConfirmOfferOpen] = useState(false);

  const offer = useMutation({
    mutationFn: (unitIds: string[]) => {
      actAs(hospital.id);
      return api.sites.offer(hospital.id, { unitIds });
    },
    onSuccess: (res, unitIds) => {
      toast.success(`Offered ${plural(offeredCount(res, unitIds.length), "unit")} for transfer`);
      setSelectedUnits(new Set());
      setConfirmOfferOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock(hospital.id) });
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (error) => toast.error("Couldn't offer those units", { description: errorMessage(error) }),
  });

  const soonMs = POLICY.expiringSoonHours * 3_600_000;
  const sevenDaysMs = 7 * 24 * 3_600_000;

  const tableRows = useMemo(() => {
    if (scope === "fridge") {
      return (stock?.cells ?? [])
        .map((c) => ({
          key: `${c.bloodGroup}|${c.component}`,
          bloodGroup: c.bloodGroup,
          component: c.component,
          available: c.onHand,
          reserved: c.reserved,
          expiring48h: c.expiring48h,
          expiring7d: c.expiring7d,
          horizonNote: c.daysOfCover !== null ? `${c.daysOfCover}d` : "—",
          risk: stockCellRiskTier(c.level),
        }))
        .filter((r) => {
          if (groupFilter !== "all" && r.bloodGroup !== groupFilter) return false;
          if (componentFilter !== "all" && r.component !== componentFilter) return false;
          if (riskFilter !== "all" && r.risk !== riskFilter) return false;
          if (expiryFilter === "48h" && r.expiring48h === 0) return false;
          if (expiryFilter === "7d" && r.expiring7d === 0) return false;
          if (expiryFilter === "fresh" && (r.available === 0 || r.expiring7d === r.available)) return false;
          return r.available > 0 || r.reserved > 0 || riskFilter !== "all";
        });
    }

    const reservedMap = new Map<string, number>();
    for (const c of stock?.cells ?? []) reservedMap.set(`${c.bloodGroup}|${c.component}`, c.reserved);

    return (forecast?.outlook ?? [])
      .map((o) => {
        const key = `${o.bloodGroup}|${o.component}`;
        return {
          key,
          bloodGroup: o.bloodGroup,
          component: o.component,
          available: o.onHand,
          reserved: reservedMap.get(key) ?? 0,
          expiring48h: o.component === "platelets" ? o.expectedWaste : 0,
          expiring7d: o.expectedWaste,
          horizonNote: o.stockoutHours !== null ? `~${formatHours(o.stockoutHours)}` : "72h+",
          risk: classifyOutlookRisk(o),
        };
      })
      .filter((r) => {
        if (groupFilter !== "all" && r.bloodGroup !== groupFilter) return false;
        if (componentFilter !== "all" && r.component !== componentFilter) return false;
        if (riskFilter !== "all" && r.risk !== riskFilter) return false;
        if (expiryFilter === "48h" && r.expiring48h === 0) return false;
        if (expiryFilter === "7d" && r.expiring7d === 0) return false;
        if (expiryFilter === "fresh" && r.expiring7d > 0) return false;
        return true;
      });
  }, [scope, stock, forecast, groupFilter, componentFilter, expiryFilter, riskFilter]);

  const maxRowUnits = useMemo(() => Math.max(...tableRows.map((r) => r.available), 1), [tableRows]);

  const groupChartData = useMemo(
    () =>
      BLOOD_GROUPS.map((g) => {
        const rows = tableRows.filter((r) => r.bloodGroup === g);
        return {
          bloodGroup: g,
          available: rows.reduce((n, r) => n + r.available, 0),
          expiring: rows.reduce((n, r) => n + r.expiring7d, 0),
        };
      }),
    [tableRows],
  );

  const componentPieData = useMemo(
    () =>
      COMPONENTS.map((c) => ({
        name: COMPONENT_SHORT[c],
        fullName: COMPONENT_LABEL[c],
        value: tableRows.filter((r) => r.component === c).reduce((n, r) => n + r.available, 0),
        color: COMPONENT_TONE[c],
      })).filter((d) => d.value > 0),
    [tableRows],
  );

  const riskPieData = useMemo(() => {
    const counts: Record<RiskTier, number> = { critical: 0, gap: 0, approaching: 0, sufficient: 0 };
    for (const r of tableRows) counts[r.risk] += 1;
    return [
      { name: "Sufficient", value: counts.sufficient, color: "#171717" },
      { name: "Approaching", value: counts.approaching, color: "#F2A8B2" },
      { name: "Near-term", value: counts.gap, color: "#E36272" },
      { name: "Critical", value: counts.critical, color: "#C93245" },
    ].filter((d) => d.value > 0);
  }, [tableRows]);

  const fridgeUnits = useMemo(
    () =>
      (stock?.units ?? [])
        .filter((u) => u.status === "available" || u.status === "reserved")
        .filter((u) => {
          if (groupFilter !== "all" && u.bloodGroup !== groupFilter) return false;
          if (componentFilter !== "all" && u.component !== componentFilter) return false;
          if (expiryFilter === "48h" && u.expiresAt - now > soonMs) return false;
          if (expiryFilter === "7d" && u.expiresAt - now > sevenDaysMs) return false;
          if (expiryFilter === "fresh" && u.expiresAt - now <= sevenDaysMs) return false;
          return true;
        })
        .sort((a, b) => a.expiresAt - b.expiresAt),
    [stock, groupFilter, componentFilter, expiryFilter, now, soonMs, sevenDaysMs],
  );

  const offerable = useMemo(() => fridgeUnits.filter((u) => u.status === "available" && !u.offered), [fridgeUnits]);
  const expiringIds = useMemo(() => offerable.filter((u) => u.expiresAt - now <= soonMs).map((u) => u.id), [offerable, now, soonMs]);

  const toggleUnit = (id: string) =>
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totals = useMemo(
    () => ({
      available: tableRows.reduce((n, r) => n + r.available, 0),
      reserved: tableRows.reduce((n, r) => n + r.reserved, 0),
      expiring7d: tableRows.reduce((n, r) => n + r.expiring7d, 0),
      atRisk: tableRows.filter((r) => r.risk !== "sufficient").length,
    }),
    [tableRows],
  );

  const hasFilters = groupFilter !== "all" || componentFilter !== "all" || expiryFilter !== "all" || riskFilter !== "all";
  const clearFilters = () => {
    setGroupFilter("all");
    setComponentFilter("all");
    setExpiryFilter("all");
    setRiskFilter("all");
  };

  return (
    <div className="space-y-5">
      {/* Top Scope Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Inventory scope"
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
              e.preventDefault();
              setScope(scope === "network" ? "fridge" : "network");
            }
          }}
          className="inline-flex border-b border-[#EAE6E3]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={scope === "network"}
            tabIndex={scope === "network" ? 0 : -1}
            onClick={() => setScope("network")}
            className="h-tab focus-ring cursor-pointer px-4 py-2 text-xs font-bold text-[#737373] transition-colors hover:text-[#171717]"
          >
            Mumbai Supply Network
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "fridge"}
            tabIndex={scope === "fridge" ? 0 : -1}
            onClick={() => setScope("fridge")}
            className="h-tab focus-ring cursor-pointer px-4 py-2 text-xs font-bold text-[#737373] transition-colors hover:text-[#171717]"
          >
            {hospital.shortName} Fridge ({stock?.totals.onHand ?? 0})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {stock ? <FreshnessPill lastSyncAt={stock.site.lastSyncAt} /> : null}
          {hasFilters ? (
            <Button size="sm" variant="secondary" onClick={clearFilters} icon={<RotateCcw className="size-3" aria-hidden />}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {/* VISUAL-FIRST 3-CHART ANALYTICS RIBBON */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Chart 1: Component Donut */}
        <div className="h-card-blush p-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="h-display text-xs font-bold text-[#171717]">By component</h2>
            <span className="h-num text-xs font-extrabold text-[#C93245]">{totals.available.toLocaleString("en-IN")}u</span>
          </div>
          <div className="relative mx-auto mt-2 h-36 w-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={componentPieData.length ? componentPieData : [{ name: "Empty", value: 1, color: "#EAE6E3" }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={3}
                  cornerRadius={4}
                  isAnimationActive={false}
                >
                  {(componentPieData.length ? componentPieData : [{ name: "Empty", value: 1, color: "#EAE6E3" }]).map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="h-num text-base font-extrabold text-[#171717]">{totals.available.toLocaleString("en-IN")}</span>
              <span className="text-[10px] font-semibold text-[#737373]">Units</span>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-2 text-[10px] font-semibold text-[#737373]">
            {componentPieData.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 2: Blood Group Distribution BarChart */}
        <div className="h-card p-4 lg:col-span-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h-display text-xs font-bold text-[#171717]">Stock by blood group</h2>
            <div className="flex items-center gap-3 text-[11px] text-[#737373]">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-xs bg-[#C93245]" aria-hidden /> Available
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-xs bg-[#E36272]" aria-hidden /> Expiring ({totals.expiring7d})
              </span>
            </div>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupChartData} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6E3" />
                <XAxis dataKey="bloodGroup" tick={{ fill: "#171717", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: "#FFF5F5" }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="available" name="Available" fill="#C93245" radius={[6, 6, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                <Bar dataKey="expiring" name="Expiring / risk" fill="#F29AA4" radius={[6, 6, 0, 0]} maxBarSize={30} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Risk Tier PieChart */}
        <div className="h-card-blush p-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="h-display text-xs font-bold text-[#171717]">Risk status</h2>
            <span className="h-num text-xs font-extrabold text-[#C93245]">{totals.atRisk} flagged</span>
          </div>
          <div className="relative mx-auto mt-2 h-36 w-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskPieData.length ? riskPieData : [{ name: "None", value: 1, color: "#EAE6E3" }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={3}
                  cornerRadius={4}
                  isAnimationActive={false}
                >
                  {(riskPieData.length ? riskPieData : [{ name: "None", value: 1, color: "#EAE6E3" }]).map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="h-num text-base font-extrabold text-[#C93245]">{totals.atRisk}</span>
              <span className="text-[10px] font-semibold text-[#737373]">At risk</span>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-2 text-[10px] font-semibold text-[#737373]">
            {riskPieData.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
                {d.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* TACTILE PILL FILTER BAR (NO CLUNKY DROPDOWN WALL) */}
      <div className="h-card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by blood group">
          <FilterPill active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
            All
          </FilterPill>
          {BLOOD_GROUPS.map((g) => (
            <FilterPill key={g} active={groupFilter === g} onClick={() => setGroupFilter(groupFilter === g ? "all" : g)}>
              {g.replace("-", "−")}
            </FilterPill>
          ))}
        </div>

        <span aria-hidden className="hidden h-5 w-px bg-[#EAE6E3] md:inline-block" />

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by component">
          {COMPONENTS.map((c) => (
            <FilterPill
              key={c}
              active={componentFilter === c}
              onClick={() => setComponentFilter(componentFilter === c ? "all" : c)}
            >
              {COMPONENT_SHORT[c]}
            </FilterPill>
          ))}
        </div>

        <span aria-hidden className="hidden h-5 w-px bg-[#EAE6E3] md:inline-block" />

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by expiry or risk">
          {(["48h", "7d"] as const).map((ex) => (
            <FilterPill key={ex} active={expiryFilter === ex} onClick={() => setExpiryFilter(expiryFilter === ex ? "all" : ex)}>
              Exp ≤{ex}
            </FilterPill>
          ))}
          {(["critical", "gap"] as const).map((r) => (
            <FilterPill key={r} active={riskFilter === r} onClick={() => setRiskFilter(riskFilter === r ? "all" : r)}>
              {RISK_META[r].shortLabel}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* VISUAL OPERATIONAL TABLE WITH INLINE VOLUME BARS */}
      <section className="h-card overflow-hidden" aria-labelledby="inventory-table-caption">
        <div className="flex items-center justify-between border-b border-[#EAE6E3] bg-[#FFF5F5]/60 px-4 py-3">
          <h3 id="inventory-table-caption" className="h-display text-sm font-bold text-[#171717]">
            {scope === "network" ? "Mumbai stock ledger" : `${hospital.shortName} fridge`}
          </h3>
          <span className="h-num text-xs font-semibold text-[#737373]">{tableRows.length} lines</span>
        </div>

        {stockError && scope === "fridge" ? (
          <ErrorState what="hospital stock" error={stockError} onRetry={onRetryStock} />
        ) : stockLoading && scope === "fridge" ? (
          <SkeletonRows rows={5} className="p-4" />
        ) : tableRows.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={scope === "fridge" ? "Hospital fridge is currently empty" : "No lines match your filter"}
            description={scope === "fridge" ? "Delivered units appear here automatically." : "Reset filters to view all stock."}
            action={
              scope === "fridge" ? (
                <Button size="sm" variant="primary" onClick={() => setScope("network")}>
                  View Mumbai Network
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={clearFilters}>
                  Reset filters
                </Button>
              )
            }
          />
        ) : (
          <div tabIndex={0} role="region" aria-labelledby="inventory-table-caption" className="h-table-wrapper max-h-[26rem]">
            <table className="h-table h-table-stackable text-left text-xs">
              <thead className="bg-[#FAF9F6] text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                <tr>
                  <th scope="col" className="border-b border-[#EAE6E3] px-4 py-2.5">
                    Group
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2.5">
                    Component
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2.5">
                    Volume
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2.5 text-right">
                    Reserved
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2.5 text-right">
                    Exp ≤48h / ≤7d
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-4 py-2.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E3] bg-white">
                {tableRows.map((row) => {
                  const meta = RISK_META[row.risk];
                  const barPct = Math.max(3, Math.round((row.available / maxRowUnits) * 100));
                  return (
                    <tr key={row.key} className="transition-colors hover:bg-[#FFF5F5]/60">
                      <th scope="row" className="bg-inherit px-4 py-2.5 font-bold text-[#171717]">
                        <span className="h-num inline-flex h-6 min-w-9 items-center justify-center rounded-lg bg-[#FCEBED] px-1.5 text-xs font-extrabold text-[#A82436]">
                          {row.bloodGroup.replace("-", "−")}
                        </span>
                      </th>
                      <td data-label="Component" className="px-3 py-2.5 font-semibold text-[#171717]">
                        {COMPONENT_LABEL[row.component]}
                      </td>
                      <td data-label="Volume" className="min-w-36 px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="h-num w-12 font-bold text-[#171717]">{row.available.toLocaleString("en-IN")}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#FCEBED]">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${barPct}%`, backgroundColor: COMPONENT_TONE[row.component] }}
                            />
                          </div>
                        </div>
                      </td>
                      <td data-label="Reserved" className="h-num px-3 py-2.5 text-right text-[#737373]">
                        {row.reserved}
                      </td>
                      <td data-label="Exp ≤48h / ≤7d" className="h-num px-3 py-2.5 text-right font-semibold">
                        <span className={row.expiring48h > 0 ? "text-[#C93245]" : "text-[#737373]"}>{row.expiring48h}</span>
                        <span className="text-[#EAE6E3]"> / </span>
                        <span className={row.expiring7d > 0 ? "text-[#C2410C]" : "text-[#737373]"}>{row.expiring7d}</span>
                      </td>
                      <td data-label="Status" className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{ backgroundColor: meta.bgColor, color: meta.textColor }}
                        >
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.dotColor }} aria-hidden />
                          {meta.shortLabel}
                        </span>
                        <span className="h-num ml-1.5 text-[11px] text-[#737373]">{row.horizonNote}</span>
                      </td>
                      <td data-label="Action" className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onFindGroup(row.bloodGroup, row.component)}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg bg-[#FCEBED] px-2.5 py-1 text-[11px] font-bold text-[#C93245] hover:bg-[#C93245] hover:text-white"
                        >
                          <Search className="size-3" aria-hidden />
                          Find
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ON-SITE SURPLUS OFFER PANEL */}
      <section className="h-card-blush overflow-hidden" aria-labelledby="offer-units-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE6E3] px-4 py-3">
          <h3 id="offer-units-heading" className="h-display text-sm font-bold text-[#171717]">
            Offer expiring on-site units ({fridgeUnits.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={expiringIds.length === 0}
              onClick={() => setSelectedUnits(new Set(expiringIds))}
            >
              Select ≤48h ({expiringIds.length})
            </Button>
            {selectedUnits.size > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setSelectedUnits(new Set())}>
                Clear
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              disabled={selectedUnits.size === 0}
              onClick={() => setConfirmOfferOpen(true)}
              icon={<ArrowRightLeft className="size-3.5" aria-hidden />}
            >
              Offer {selectedUnits.size > 0 ? plural(selectedUnits.size, "unit") : "units"}
            </Button>
          </div>
        </div>

        {fridgeUnits.length === 0 ? (
          <p className="px-4 py-4 text-center text-xs text-[#737373]">
            Delivered bags appear here for expiry tracking and surplus transfer offers.
          </p>
        ) : (
          <div tabIndex={0} role="region" aria-label="On-site fridge units" className="h-table-wrapper max-h-72 bg-white">
            <table className="h-table text-left text-xs">
              <thead className="bg-[#FAF9F6] text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                <tr>
                  <th scope="col" className="w-10 border-b border-[#EAE6E3] py-2 pl-4">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2">
                    Unit
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2">
                    Bag ID
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] px-3 py-2">
                    Expiry
                  </th>
                  <th scope="col" className="border-b border-[#EAE6E3] py-2 pr-4 text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E3]">
                {fridgeUnits.map((u) => {
                  const expiringSoon = u.expiresAt - now <= soonMs;
                  const selectable = u.status === "available" && !u.offered;
                  const checked = selectedUnits.has(u.id);
                  return (
                    <tr key={u.id} className={cn(expiringSoon && "bg-[#FFF5F5]", checked && "bg-[#FCEBED]/60")}>
                      <td className="py-2 pl-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!selectable}
                          onChange={() => toggleUnit(u.id)}
                          aria-label={`Select ${spokenGroup(u.bloodGroup)} ${COMPONENT_LABEL[u.component]} ${u.id}`}
                          className="focus-ring size-4 accent-[#C93245]"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#171717]">
                        <span className="h-num mr-2 inline-flex rounded bg-[#FCEBED] px-1.5 py-0.5 text-[11px] font-bold text-[#A82436]">
                          {u.bloodGroup.replace("-", "−")}
                        </span>
                        {COMPONENT_LABEL[u.component]}
                      </td>
                      <td className="h-num px-3 py-2 text-[#737373]">{u.id}</td>
                      <td className="px-3 py-2">
                        <ExpiryBadge expiresAt={u.expiresAt} size="sm" />
                        <span className="sr-only">expires {formatISTDateTime(u.expiresAt)}</span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {u.offered ? (
                          <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-bold text-[#15803D]">Offered</span>
                        ) : expiringSoon ? (
                          <span className="rounded-full bg-[#FCEBED] px-2 py-0.5 text-[11px] font-bold text-[#C93245]">≤48h</span>
                        ) : (
                          <span className="text-[#737373]">{u.status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmActionDialog
        open={confirmOfferOpen}
        onClose={() => setConfirmOfferOpen(false)}
        onConfirm={() => offer.mutate([...selectedUnits])}
        pending={offer.isPending}
        title="Offer units for transfer?"
        description={`Mark ${plural(selectedUnits.size, "unit")} from ${hospital.shortName} as spare stock on the Mumbai transfer board.`}
        confirmLabel={`Offer ${plural(selectedUnits.size, "unit")}`}
      />
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ring h-num inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-all",
        active
          ? "bg-[#C93245] text-white shadow-xs ring-2 ring-[#C93245]/20"
          : "bg-[#FAF9F6] text-[#525252] hover:bg-[#FCEBED] hover:text-[#A82436]",
      )}
    >
      {active ? <Check className="size-3 shrink-0" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
}

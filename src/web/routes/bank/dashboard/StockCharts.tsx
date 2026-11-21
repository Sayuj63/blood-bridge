import { BarChart3, Clock, Layers } from "lucide-react";
import { useMemo } from "react";
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
import type { SiteStockDTO } from "../../../../shared/api";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, COMPONENT_SHORT, type Component } from "../../../../shared/domain";
import { useNow } from "../../../lib/useNow";
import { LEVEL_ORDER, LEVEL_STYLE } from "./levels";

const COMPONENT_COLORS: Record<Component, string> = {
  red_cells: "#C93245",
  platelets: "#E26D7A",
  plasma: "#D97706",
  whole_blood: "#8C1D2C",
};

const EXPIRY_COLORS = ["#C93245", "#D97706", "#E28B95", "#1F7A4D"] as const;

/**
 * Visual analytics strip for a blood bank's live fridge stock:
 * 1. Blood group inventory stacked bar chart (on-hand vs reserved)
 * 2. Component mix donut chart (PRBC / PLT / FFP / WB)
 * 3. Shelf-life expiry horizon bar chart + 32-cell stock health breakdown
 */
export function StockCharts({ stock }: { stock: SiteStockDTO }) {
  const now = useNow(60_000);

  // 1. Blood group distribution (all 8 groups)
  const groupData = useMemo(() => {
    return BLOOD_GROUPS.map((group) => {
      const rows = stock.cells.filter((c) => c.bloodGroup === group);
      const onHand = rows.reduce((s, r) => s + r.onHand, 0);
      const reserved = rows.reduce((s, r) => s + r.reserved, 0);
      const expiring48h = rows.reduce((s, r) => s + r.expiring48h, 0);
      const expiring7d = rows.reduce((s, r) => s + r.expiring7d, 0);
      return {
        group: group.replace("-", "−"),
        onHand,
        reserved,
        expiring48h,
        expiring7d,
        total: onHand + reserved,
      };
    });
  }, [stock.cells]);

  // 2. Component mix (donut)
  const componentData = useMemo(() => {
    const raw = COMPONENTS.map((comp) => {
      const value = stock.cells.filter((c) => c.component === comp).reduce((s, c) => s + c.onHand, 0);
      return {
        id: comp,
        name: COMPONENT_LABEL[comp],
        short: COMPONENT_SHORT[comp],
        value,
        color: COMPONENT_COLORS[comp],
      };
    });
    const total = raw.reduce((s, d) => s + d.value, 0);
    const nonZero = raw.filter((d) => d.value > 0);
    return {
      total,
      rows: raw.map((d) => ({ ...d, pct: total > 0 ? Math.round((d.value / total) * 100) : 0 })),
      pieData: nonZero.length > 0 ? nonZero : [{ id: "empty", name: "Empty", short: "—", value: 1, color: "#EAE6E3" }],
    };
  }, [stock.cells]);

  // 3. Shelf-life buckets from actual units on shelf
  const expiryBuckets = useMemo(() => {
    const H = 3_600_000;
    let b48h = 0;
    let b7d = 0;
    let b21d = 0;
    let bLong = 0;
    for (const u of stock.units) {
      if (u.status !== "available" && u.status !== "reserved") continue;
      const hrs = (u.expiresAt - now) / H;
      if (hrs <= 48) b48h++;
      else if (hrs <= 24 * 7) b7d++;
      else if (hrs <= 24 * 21) b21d++;
      else bLong++;
    }
    return [
      { label: "≤48h", full: "Expiring within 48 hours", units: b48h, color: EXPIRY_COLORS[0] },
      { label: "2–7d", full: "Expiring in 2 to 7 days", units: b7d, color: EXPIRY_COLORS[1] },
      { label: "8–21d", full: "8 to 21 days remaining", units: b21d, color: EXPIRY_COLORS[2] },
      { label: ">21d", full: "More than 21 days remaining", units: bLong, color: EXPIRY_COLORS[3] },
    ];
  }, [stock.units, now]);

  // 4. Stock-level health distribution across 32 group×component cells
  const levelCounts = useMemo(() => {
    return LEVEL_ORDER.map((lvl) => ({
      level: lvl,
      label: LEVEL_STYLE[lvl].label,
      swatch: LEVEL_STYLE[lvl].swatch,
      count: stock.cells.filter((c) => c.level === lvl).length,
    }));
  }, [stock.cells]);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Chart 1: Blood Group Distribution */}
      <section aria-label="Blood group inventory chart" className="b-card p-5 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <BarChart3 className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="b-display text-sm font-bold text-[#171717]">Inventory by blood group</h2>
              <p className="text-[11px] text-[#737373]">Available on-hand vs. reserved units</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-[#737373]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-[#C93245]" aria-hidden /> On hand
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-[#3B82F6]" aria-hidden /> Reserved
            </span>
          </div>
        </div>

        <div className="mt-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groupData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E3" vertical={false} />
              <XAxis dataKey="group" tick={{ fill: "#171717", fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip
                cursor={{ fill: "#FFF5F5" }}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #EAE6E3",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px -10px rgba(23,23,23,0.14)",
                }}
                formatter={(val: unknown, name: unknown) => [`${val} units`, name === "onHand" ? "On hand" : "Reserved"]}
              />
              <Bar dataKey="onHand" stackId="a" fill="#C93245" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
              <Bar dataKey="reserved" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Chart 2: Component Mix Donut */}
      <section aria-label="Component mix chart" className="b-card flex flex-col justify-between p-5 lg:col-span-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <Layers className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="b-display text-sm font-bold text-[#171717]">Component mix</h2>
            <p className="text-[11px] text-[#737373]">Share of usable units on shelf</p>
          </div>
        </div>

        <div className="mt-3 flex flex-col items-center gap-3">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={componentData.pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={64}
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {componentData.pieData.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #EAE6E3",
                    borderRadius: "10px",
                    fontSize: "11px",
                  }}
                  formatter={(val: unknown, name: unknown) => [`${val} units`, String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="b-num text-lg font-extrabold leading-none text-[#171717]">{componentData.total}</span>
              <span className="mt-0.5 text-[10px] font-semibold text-[#737373]">units</span>
            </div>
          </div>

          <ul className="grid w-full grid-cols-2 gap-2">
            {componentData.rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-1 rounded-lg bg-[#FAF9F6] px-2 py-1.5 text-[11px]">
                <span className="inline-flex shrink-0 items-center gap-1">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
                  <span className="font-bold text-[#171717]">{row.short}</span>
                </span>
                <span className="b-num shrink-0 font-bold text-[#171717]">
                  {row.value} <span className="font-normal text-[#737373]">({row.pct}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Chart 3: Expiry Shelf-Life Horizon + 32-Cell Health Strip */}
      <section aria-label="Expiry horizon and cell health" className="b-card p-5 lg:col-span-12">
        <div className="grid gap-6 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
                <Clock className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="b-display text-sm font-bold text-[#171717]">Shelf-life expiry horizon</h2>
                <p className="text-[11px] text-[#737373]">Live unit aging buckets across active inventory</p>
              </div>
            </div>
            <div className="mt-3 h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expiryBuckets} layout="vertical" margin={{ top: 2, right: 16, left: 0, bottom: 2 }} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={46}
                    tick={{ fill: "#171717", fontSize: 11, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "#FFF5F5" }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EAE6E3",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                    formatter={(val: unknown, _n: unknown, item: { payload?: { full?: string } }) => [
                      `${val} units`,
                      item?.payload?.full ?? "Units",
                    ]}
                  />
                  <Bar dataKey="units" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive={false}>
                    {expiryBuckets.map((b) => (
                      <Cell key={b.label} fill={b.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border-t border-[#EAE6E3] pt-4 md:col-span-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <p className="b-display text-xs font-bold uppercase tracking-wider text-[#737373]">32-Cell Stock Health</p>
            <p className="mt-0.5 text-[11px] text-[#737373]">8 blood groups × 4 components by days of cover</p>

            {/* Stacked proportion bar */}
            <div className="mt-3.5 flex h-3 w-full overflow-hidden rounded-full bg-[#F1ECE9]">
              {levelCounts.map((item) =>
                item.count > 0 ? (
                  <div
                    key={item.level}
                    className={item.swatch}
                    style={{ width: `${(item.count / Math.max(1, stock.cells.length)) * 100}%` }}
                    title={`${item.label}: ${item.count} cells`}
                  />
                ) : null,
              )}
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {levelCounts.map((item) => (
                <div key={item.level} className="flex items-center justify-between rounded-xl border border-[#EAE6E3] bg-[#FAF9F6] px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
                    <span className={`size-2.5 rounded-full ${item.swatch}`} aria-hidden />
                    {item.label}
                  </span>
                  <span className="b-num text-sm font-extrabold text-[#171717]">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

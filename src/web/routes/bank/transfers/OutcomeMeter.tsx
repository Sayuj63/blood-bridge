import { TrendingDown } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import type { OutcomeSummary } from "../../../../shared/forecast";

const METRICS = [
  { key: "expectedWaste", label: "Expiring unused", short: "Expiry waste" },
  { key: "shortfall", label: "Forecast shortfall", short: "Shortfall" },
] as const;

/** City-wide 72h outcome comparison: Recharts before vs. after grouped bar chart + delta summary. */
export function OutcomeMeter({ before, after }: { before: OutcomeSummary; after: OutcomeSummary }) {
  const chartData = useMemo(
    () =>
      METRICS.map(({ key, short }) => ({
        metric: short,
        before: before[key],
        after: after[key],
      })),
    [before.expectedWaste, before.shortfall, after.expectedWaste, after.shortfall],
  );

  return (
    <figure className="b-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <TrendingDown className="size-4" aria-hidden />
          </span>
          <div>
            <figcaption className="b-display text-sm font-bold text-[#171717]">72h transfer impact</figcaption>
            <p className="text-[11px] text-[#737373]">City-wide outlook if every suggested transfer is approved</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-[#737373]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[#E2B4BA]" aria-hidden /> Current
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[#1F7A4D]" aria-hidden /> After transfers
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-12 sm:items-center">
        <div className="h-36 sm:col-span-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E3" vertical={false} />
              <XAxis dataKey="metric" tick={{ fill: "#171717", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
              <RechartsTooltip
                cursor={{ fill: "#FFF5F5" }}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #EAE6E3",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
                formatter={(val: unknown, name: unknown) => [`${val} units`, name === "before" ? "Current" : "After transfers"]}
              />
              <Bar dataKey="before" fill="#E2B4BA" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              <Bar dataKey="after" fill="#1F7A4D" radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <dl className="grid gap-3 sm:col-span-6">
          {METRICS.map(({ key, label }) => {
            const b = before[key];
            const a = after[key];
            const saved = Math.max(0, b - a);
            return (
              <div key={key} className="flex items-center justify-between rounded-xl border border-[#EAE6E3] bg-[#FAF9F6] px-4 py-3">
                <dt className="text-xs font-semibold text-[#737373]">{label}</dt>
                <dd className="b-num flex items-center gap-2 text-sm">
                  <span className="text-[#737373] line-through">{b}</span>
                  <span className="text-[#737373]" aria-hidden>→</span>
                  <strong className="text-base font-extrabold text-[#1F7A4D]">{a}</strong>
                  {saved > 0 ? (
                    <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-bold text-[#1F7A4D]">−{saved}u</span>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </figure>
  );
}

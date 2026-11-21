import { Activity, Droplet } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import type { DonorDTO } from "../../../../shared/api";
import { formatDate } from "../copy";

/** Visual donation history & cumulative impact chart — airy, unboxed layout. */
export function ImpactCard({ donor }: { donor: DonorDTO }) {
  const { unitsDonated } = donor.impact;

  const chartData = useMemo(() => {
    return [...donor.donations]
      .reverse()
      .map((d, idx) => ({
        label: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short", year: "2-digit" }).format(d.at),
        site: d.siteName,
        cumulative: idx + 1,
      }));
  }, [donor.donations]);

  return (
    <section aria-labelledby="impact-title" className="d-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <Activity className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="impact-title" className="d-display text-sm font-bold text-[#171717]">
              Donation history
            </h2>
            <p className="text-[11px] text-[#737373]">Cumulative recorded units over time</p>
          </div>
        </div>
        <span className="d-num rounded-full bg-[#FCEBED] px-2.5 py-0.5 text-[11px] font-bold text-[#A82436]">
          {unitsDonated} {unitsDonated === 1 ? "unit" : "units"}
        </span>
      </div>

      {chartData.length > 0 ? (
        <div className="mt-5 h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -26, bottom: 0 }}>
              <defs>
                <linearGradient id="donorCumulativeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C93245" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#C93245" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#737373", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis
                allowDecimals={false}
                domain={[0, Math.max(3, chartData.length)]}
                tick={{ fill: "#737373", fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #EAE6E3",
                  borderRadius: "10px",
                  fontSize: "12px",
                  boxShadow: "0 6px 20px -8px rgba(23,23,23,0.12)",
                }}
                formatter={(val: unknown, _name: unknown, item: { payload?: { site?: string } }) => [
                  `${val} total · ${item?.payload?.site ?? ""}`,
                  "Cumulative",
                ]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#C93245"
                strokeWidth={2.25}
                fill="url(#donorCumulativeFill)"
                dot={{ r: 4, fill: "#FFFFFF", stroke: "#C93245", strokeWidth: 2.25 }}
                activeDot={{ r: 5.5, fill: "#C93245", stroke: "#FFFFFF", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {donor.donations.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[#FAF9F6] px-4 py-5 text-center text-xs text-[#737373]">
          No donations recorded yet — your first visit will appear here.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#EAE6E3] border-t border-[#EAE6E3]" aria-label="Donation history">
          {donor.donations.map((d) => (
            <li key={`${d.at}-${d.siteName}`} className="flex items-center gap-3 py-3 last:pb-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#FFF5F5] text-[#C93245]">
                <Droplet className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[#171717]">{d.siteName}</span>
                <span className="d-num block text-xs text-[#737373]">{formatDate(d.at)}</span>
              </span>
              <span className="d-num shrink-0 text-xs font-bold text-[#A82436]">+1 unit</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

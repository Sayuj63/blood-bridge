import { motion, useReducedMotion } from "motion/react";
import { AlarmClock, ArrowRight, Droplet, Hourglass, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { OutcomeSummary } from "../../../shared/forecast";
import { formatHours } from "../../lib/format";

interface Item {
  icon: ReactNode;
  label: string;
  before: string;
  now: string;
  worse: boolean;
}

const hours = (h: number | null) => (h === null ? "none" : h < 1 / 60 ? "now" : formatHours(h));

/**
 * What the surge did to the city, at a glance: a normal day → now, for the four numbers that matter.
 * Shown under the scenario bar while a surge runs, so starting one visibly changes the picture.
 */
export function ImpactStrip({ baseline, current }: { baseline: OutcomeSummary; current: OutcomeSummary }) {
  const reduced = useReducedMotion();
  const items: Item[] = [
    {
      icon: <AlarmClock aria-hidden />,
      label: "First stock-out",
      before: hours(baseline.earliestStockoutHours),
      now: hours(current.earliestStockoutHours),
      worse: (current.earliestStockoutHours ?? Infinity) < (baseline.earliestStockoutHours ?? Infinity),
    },
    {
      icon: <TriangleAlert aria-hidden />,
      label: "Stock lines out <24h",
      before: String(baseline.cellsAtRisk),
      now: String(current.cellsAtRisk),
      worse: current.cellsAtRisk > baseline.cellsAtRisk,
    },
    {
      icon: <Droplet aria-hidden />,
      label: "Unmet in 24h",
      before: `${baseline.shortfall24h}`,
      now: `${current.shortfall24h}`,
      worse: current.shortfall24h > baseline.shortfall24h,
    },
    {
      icon: <Hourglass aria-hidden />,
      label: "Unmet over 72h",
      before: `${baseline.shortfall}`,
      now: `${current.shortfall}`,
      worse: current.shortfall > baseline.shortfall,
    },
  ];

  return (
    <motion.section
      aria-label="Surge impact: normal day compared with now"
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-2 gap-px border-b border-line bg-line lg:grid-cols-4"
    >
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-3 bg-surface px-3 py-2">
          <span className={`grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4 ${it.worse ? "bg-critical-soft text-critical" : "bg-surface-2 text-ink-muted"}`}>
            {it.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[11px] text-ink-faint">{it.label}</div>
            <div className="flex items-center gap-1.5 font-numeric">
              <span className="text-sm text-ink-muted line-through decoration-ink-faint/60">{it.before}</span>
              <ArrowRight className="size-3 text-ink-faint" aria-label="now" />
              <motion.span
                key={it.now}
                initial={reduced ? false : { opacity: 0, scale: 1.25 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: reduced ? 0 : 0.15 + i * 0.08 }}
                className={`text-lg font-bold ${it.worse ? "text-critical" : "text-ink"}`}
              >
                {it.now}
              </motion.span>
            </div>
          </div>
        </div>
      ))}
    </motion.section>
  );
}

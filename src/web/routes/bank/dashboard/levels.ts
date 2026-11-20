import type { StockLevel } from "../../../../shared/api";

interface LevelStyle {
  label: string;
  /** Tinted background + text for the on-hand cell. */
  cell: string;
  /** Solid swatch for the legend and the cell's edge marker. */
  swatch: string;
}

/** Stock level colours. Surplus uses the transfer colour: it is stock that could move. */
export const LEVEL_STYLE: Record<StockLevel, LevelStyle> = {
  critical: { label: "Critical", cell: "bg-critical-soft text-critical", swatch: "bg-critical" },
  low: { label: "Low", cell: "bg-warn-soft text-warn", swatch: "bg-warn" },
  ok: { label: "OK", cell: "bg-ok-soft text-ok", swatch: "bg-ok" },
  surplus: { label: "Surplus", cell: "bg-bridge-soft text-bridge", swatch: "bg-bridge" },
};

export const LEVEL_ORDER: readonly StockLevel[] = ["critical", "low", "ok", "surplus"];

/** Lower = more urgent, for picking the group a donor drive should target. */
export const LEVEL_RANK: Record<StockLevel, number> = { critical: 0, low: 1, ok: 2, surplus: 3 };

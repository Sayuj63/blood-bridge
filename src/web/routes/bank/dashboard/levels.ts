import type { StockLevel } from "../../../../shared/api";

interface LevelStyle {
  label: string;
  /** Tinted background + text for the on-hand cell. */
  cell: string;
  /** Solid swatch for the legend and proportion strip. */
  swatch: string;
}

/** Unified healthcare stock-level colours matching Hospital Command & Donor Portal. */
export const LEVEL_STYLE: Record<StockLevel, LevelStyle> = {
  critical: { label: "Critical", cell: "bg-[#FCEBED] text-[#A82436]", swatch: "bg-[#C93245]" },
  low: { label: "Low", cell: "bg-[#FFF7ED] text-[#B45309]", swatch: "bg-[#D97706]" },
  ok: { label: "OK", cell: "bg-[#ECFDF3] text-[#1F7A4D]", swatch: "bg-[#1F7A4D]" },
  surplus: { label: "Surplus", cell: "bg-[#EEF4FF] text-[#1D5FB8]", swatch: "bg-[#3B82F6]" },
};

export const LEVEL_ORDER: readonly StockLevel[] = ["critical", "low", "ok", "surplus"];

/** Lower = more urgent, for picking the group a donor drive should target. */
export const LEVEL_RANK: Record<StockLevel, number> = { critical: 0, low: 1, ok: 2, surplus: 3 };

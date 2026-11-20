import type { StockCell } from "../../../../shared/api";
import { LEVEL_RANK } from "../dashboard/levels";

/**
 * The group a donor drive should target: the whole-blood cell with the worst
 * level, then the fewest days of cover, then the fewest units on hand.
 */
export function suggestDriveGroup(cells: readonly StockCell[]): StockCell | null {
  const whole = cells.filter((c) => c.component === "whole_blood");
  const cover = (c: StockCell) => c.daysOfCover ?? Number.POSITIVE_INFINITY;
  return (
    [...whole].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || cover(a) - cover(b) || a.onHand - b.onHand)[0] ?? null
  );
}

import type { StockCell } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { cn } from "../../../lib/cn";
import { spokenGroup } from "../../../lib/format";
import { LEVEL_STYLE } from "./levels";

const coverText = (days: number | null): string => (days === null ? "no demand" : `${days}d cover`);

function Count({ value, tone, label }: { value: number; tone?: string; label: string }) {
  return (
    <td className="b-num px-2.5 py-2 text-right text-xs" aria-label={`${value} ${label}`}>
      <span className={value > 0 ? cn("font-bold", tone) : "text-[#B5ADA8]"}>{value}</span>
    </td>
  );
}

/** The four cells for one group × component: level-coloured on-hand with days of cover, then the counts. */
export function StockCellRow({ cell }: { cell: StockCell }) {
  const style = LEVEL_STYLE[cell.level];
  return (
    <>
      <td className="border-l border-[#EAE6E3] px-2 py-2">
        <div
          className={cn("flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5", style.cell)}
          title={`${spokenGroup(cell.bloodGroup)} ${COMPONENT_LABEL[cell.component]}: ${style.label}, ${coverText(cell.daysOfCover)}`}
        >
          <span className="text-[10px] font-bold opacity-90">{style.label}</span>
          <span className="b-num text-sm leading-none font-extrabold">{cell.onHand}</span>
        </div>
        <div className="b-num mt-0.5 pr-0.5 text-right text-[10px] text-[#737373]">{coverText(cell.daysOfCover)}</div>
      </td>
      <Count value={cell.reserved} tone="text-[#1D5FB8]" label="reserved" />
      <Count value={cell.expiring48h} tone="text-[#C93245]" label="expiring within 48 hours" />
      <Count value={cell.expiring7d} tone="text-[#B45309]" label="expiring within 7 days" />
    </>
  );
}

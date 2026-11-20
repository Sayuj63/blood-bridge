import type { StockCell } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { cn } from "../../../lib/cn";
import { spokenGroup } from "../../../lib/format";
import { LEVEL_STYLE } from "./levels";

const coverText = (days: number | null): string => (days === null ? "no demand" : `${days}d cover`);

function Count({ value, tone, label }: { value: number; tone?: string; label: string }) {
  return (
    <td className="px-2 py-1.5 text-right font-numeric" aria-label={`${value} ${label}`}>
      <span className={value > 0 ? cn("font-semibold", tone) : "text-ink-faint"}>{value}</span>
    </td>
  );
}

/** The four cells for one group × component: level-coloured on-hand with days of cover, then the counts. */
export function StockCellRow({ cell }: { cell: StockCell }) {
  const style = LEVEL_STYLE[cell.level];
  return (
    <>
      <td className="border-l border-line px-1.5 py-1.5">
        <div
          className={cn("flex items-baseline justify-between gap-2 rounded-(--radius-chip) px-2 py-1", style.cell)}
          title={`${spokenGroup(cell.bloodGroup)} ${COMPONENT_LABEL[cell.component]}: ${style.label}, ${coverText(cell.daysOfCover)}`}
        >
          <span className="font-label text-2xs opacity-90">{style.label}</span>
          <span className="font-numeric text-base leading-none font-bold">{cell.onHand}</span>
        </div>
        <div className="mt-0.5 text-right font-label text-2xs text-ink-faint">{coverText(cell.daysOfCover)}</div>
      </td>
      <Count value={cell.reserved} tone="text-info" label="reserved" />
      <Count value={cell.expiring48h} tone="text-critical" label="expiring within 48 hours" />
      <Count value={cell.expiring7d} tone="text-warn" label="expiring within 7 days" />
    </>
  );
}

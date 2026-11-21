import { cn } from "../../../lib/cn";
import { LEVEL_ORDER, LEVEL_STYLE } from "./levels";

/** Key for the stock-level colours, so colour is never the only cue. */
export function LevelLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#737373]", className)} aria-label="Stock level key">
      {LEVEL_ORDER.map((level) => (
        <li key={level} className="inline-flex items-center gap-1.5 font-medium text-[#525252]">
          <span aria-hidden className={cn("size-2.5 rounded-full", LEVEL_STYLE[level].swatch)} />
          {LEVEL_STYLE[level].label}
        </li>
      ))}
      <li className="ml-auto text-[11px] text-[#737373]">Days of cover = on hand ÷ baseline daily demand</li>
    </ul>
  );
}

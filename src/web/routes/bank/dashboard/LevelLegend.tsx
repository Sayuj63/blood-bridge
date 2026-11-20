import { cn } from "../../../lib/cn";
import { LEVEL_ORDER, LEVEL_STYLE } from "./levels";

/** Key for the stock-level colours, so colour is never the only cue. */
export function LevelLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted", className)} aria-label="Stock level key">
      {LEVEL_ORDER.map((level) => (
        <li key={level} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-sm", LEVEL_STYLE[level].swatch)} />
          {LEVEL_STYLE[level].label}
        </li>
      ))}
      <li className="text-ink-faint">Days of cover = on hand ÷ baseline daily demand</li>
    </ul>
  );
}

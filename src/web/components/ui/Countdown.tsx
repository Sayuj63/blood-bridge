import { cn } from "../../lib/cn";
import { formatClock, formatHours } from "../../lib/format";
import { useNow } from "../../lib/useNow";

export interface CountdownProps {
  /** Epoch ms the countdown reaches zero. */
  target: number;
  /** Shown when the target has passed. */
  doneLabel?: string;
  /** `clock` ticks seconds (for windows under an hour); `hours` shows "2d 4h". */
  format?: "clock" | "hours";
  /** Thresholds in ms: below `criticalBelow` turns red, below `warnBelow` amber. */
  criticalBelow?: number;
  warnBelow?: number;
  /** Accessible name, e.g. "O negative red cells run out in". */
  label: string;
  /** Announce minute changes politely to screen readers. Turn off for all but the most important timer on a screen. */
  announce?: boolean;
  className?: string;
}

/**
 * Live countdown. The visible digits tick every second; screen readers get a
 * polite announcement at most once a minute so the page doesn't chatter.
 */
export function Countdown({ target, doneLabel = "now", format = "clock", criticalBelow, warnBelow, label, announce = true, className }: CountdownProps) {
  const now = useNow(format === "clock" ? 1000 : 30_000);
  const left = target - now;
  const done = left <= 0;
  const text = done ? doneLabel : format === "clock" ? formatClock(left) : formatHours(left / 3_600_000);
  const minuteText = done ? doneLabel : formatHours(Math.ceil(left / 60_000) / 60);
  const tone =
    done || (criticalBelow !== undefined && left < criticalBelow)
      ? "text-critical"
      : warnBelow !== undefined && left < warnBelow
        ? "text-warn"
        : undefined;

  return (
    <span role="timer" className={cn("font-numeric", tone, className)}>
      <span aria-hidden>{text}</span>
      <span className="sr-only" aria-live={announce ? "polite" : "off"} aria-atomic>
        {`${label} ${minuteText}`}
      </span>
    </span>
  );
}

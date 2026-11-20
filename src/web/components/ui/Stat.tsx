import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { Tone } from "../../styles/tokens";

const VALUE_TONE: Record<Tone, string> = {
  neutral: "text-ink",
  accent: "text-accent",
  bridge: "text-bridge",
  critical: "text-critical",
  warn: "text-warn",
  ok: "text-ok",
  info: "text-info",
};

export interface StatProps {
  /** What the number counts, in plain words. */
  label: ReactNode;
  value: ReactNode;
  /** Unit after the value, e.g. "units". */
  unit?: ReactNode;
  /** Secondary line under the value, e.g. a comparison. */
  hint?: ReactNode;
  tone?: Tone;
  /** `xl` is sized for a projector. */
  size?: "md" | "lg" | "xl";
  className?: string;
}

/** KPI tile: label, big tabular number, optional unit and hint. */
export function Stat({ label, value, unit, hint, tone = "neutral", size = "md", className }: StatProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-sm text-ink-muted">{label}</div>
      <div className={cn("mt-1 flex items-baseline gap-1.5 font-numeric font-bold leading-none", VALUE_TONE[tone])}>
        <span className={cn(size === "md" && "text-3xl", size === "lg" && "text-4xl", size === "xl" && "text-6xl")}>{value}</span>
        {unit ? <span className="text-sm font-medium text-ink-muted">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1.5 text-xs text-ink-muted">{hint}</div> : null}
    </div>
  );
}

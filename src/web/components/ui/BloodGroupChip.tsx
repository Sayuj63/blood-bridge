import type { BloodGroup } from "../../../shared/domain";
import { cn } from "../../lib/cn";
import { spokenGroup } from "../../lib/format";
import { BLOOD_GROUP_HEX, BLOOD_GROUP_ON } from "../../styles/tokens";

export interface BloodGroupChipProps {
  group: BloodGroup;
  /**
   * `label` — modelled on the ABO/Rh quadrant of a blood-bag label: big ABO letters, Rh spelled out.
   * `solid` — compact filled chip (tables, lists). `dot` — colour dot + text (legends).
   */
  variant?: "label" | "solid" | "dot";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const LABEL_SIZE = {
  sm: { box: "h-9 min-w-9 px-1.5", abo: "text-lg", rh: "text-[0.5rem]" },
  md: { box: "h-12 min-w-12 px-2", abo: "text-2xl", rh: "text-[0.5625rem]" },
  lg: { box: "h-16 min-w-16 px-2.5", abo: "text-4xl", rh: "text-[0.6875rem]" },
  xl: { box: "h-24 min-w-24 px-3", abo: "text-6xl", rh: "text-sm" },
} as const;

/** A blood group, coloured by group (same hue = same ABO, lighter = Rh negative). */
export function BloodGroupChip({ group, variant = "solid", size = "md", className }: BloodGroupChipProps) {
  const abo = group.slice(0, -1);
  const neg = group.endsWith("-");
  const color = BLOOD_GROUP_HEX[group];

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-label text-sm", className)} aria-label={spokenGroup(group)}>
        <span aria-hidden className={cn("size-2.5 rounded-full", neg && "ring-2 ring-current/25")} style={{ background: color }} />
        <span aria-hidden>{group}</span>
      </span>
    );
  }

  if (variant === "solid") {
    return (
      <span
        role="img"
        aria-label={spokenGroup(group)}
        className={cn(
          "inline-flex items-center justify-center rounded-(--radius-chip) font-numeric font-bold leading-none",
          size === "sm" ? "h-5 min-w-8 px-1 text-xs" : size === "md" ? "h-6 min-w-10 px-1.5 text-sm" : "h-8 min-w-12 px-2 text-base",
          className,
        )}
        style={{ background: color, color: BLOOD_GROUP_ON[group] }}
      >
        {group.replace("-", "−")}
      </span>
    );
  }

  const s = LABEL_SIZE[size];
  return (
    <span
      role="img"
      aria-label={spokenGroup(group)}
      className={cn("inline-flex flex-col items-center justify-center rounded-(--radius-chip) border-2 bg-surface leading-none", s.box, className)}
      style={{ borderColor: color }}
    >
      <span className={cn("font-display tracking-tight text-ink", s.abo)}>{abo}</span>
      <span
        className={cn("mt-0.5 w-full rounded-[2px] px-0.5 text-center font-label uppercase tracking-wide", s.rh)}
        style={{ background: color, color: BLOOD_GROUP_ON[group] }}
      >
        Rh {neg ? "neg" : "pos"}
      </span>
    </span>
  );
}

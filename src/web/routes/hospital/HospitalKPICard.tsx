import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type KpiTone = "default" | "accent" | "ok" | "warn" | "orange" | "critical";

const TONE_ACCENT: Record<KpiTone, { iconBg: string; iconColor: string; bar: string; valueColor: string }> = {
  default: { iconBg: "bg-[#F5F3EF]", iconColor: "text-[#525252]", bar: "bg-[#D6CFC9]", valueColor: "text-[#171717]" },
  accent: { iconBg: "bg-[#FCEBED]", iconColor: "text-[#C93245]", bar: "bg-[#C93245]", valueColor: "text-[#171717]" },
  ok: { iconBg: "bg-[#ECFDF3]", iconColor: "text-[#15803D]", bar: "bg-[#15803D]", valueColor: "text-[#171717]" },
  warn: { iconBg: "bg-[#FEFCE8]", iconColor: "text-[#A16207]", bar: "bg-[#CA8A04]", valueColor: "text-[#171717]" },
  orange: { iconBg: "bg-[#FFF7ED]", iconColor: "text-[#C2410C]", bar: "bg-[#EA580C]", valueColor: "text-[#171717]" },
  critical: { iconBg: "bg-[#FEF2F2]", iconColor: "text-[#991B1B]", bar: "bg-[#C93245]", valueColor: "text-[#991B1B]" },
};

export interface HospitalKPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  icon: ReactNode;
  tone?: KpiTone;
  onClick?: () => void;
  className?: string;
}

/** Compact operational KPI tile with tabular numerals and subtle status accent. */
export function HospitalKPICard({ label, value, unit, sublabel, icon, tone = "default", onClick, className }: HospitalKPICardProps) {
  const styles = TONE_ACCENT[tone];
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "h-card relative flex flex-col justify-between overflow-hidden p-4 text-left",
        onClick && "h-card-interactive focus-ring cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[#737373]">{label}</span>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", styles.iconBg, styles.iconColor)} aria-hidden>
          {icon}
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className={cn("h-num text-2xl font-semibold tracking-tight", styles.valueColor)}>
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </span>
        {unit ? <span className="text-xs font-medium text-[#737373]">{unit}</span> : null}
      </div>
      {sublabel ? <p className="mt-1 truncate text-xs text-[#737373]">{sublabel}</p> : null}
      <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-0.5 opacity-80", styles.bar)} />
    </Comp>
  );
}

import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-(--radius-chip) font-label leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-ink-muted",
        accent: "bg-accent/12 text-accent",
        bridge: "bg-bridge-soft text-bridge",
        critical: "bg-critical-soft text-critical",
        warn: "bg-warn-soft text-warn",
        ok: "bg-ok-soft text-ok",
        info: "bg-info-soft text-info",
      },
      size: {
        sm: "h-5 px-1.5 text-2xs",
        md: "h-6 px-2 text-xs",
        lg: "h-8 px-2.5 text-sm",
      },
      outline: { true: "border border-current/30", false: "" },
    },
    defaultVariants: { tone: "neutral", size: "md", outline: false },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/** Small status label. `tone` carries meaning: critical, warn, ok, info, bridge (transfers), accent (brand). */
export function Badge({ tone, size, outline, className, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size, outline }), className)} {...rest} />;
}

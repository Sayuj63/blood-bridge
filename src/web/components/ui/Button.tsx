import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cn } from "../../lib/cn";

/** Shared class recipe, exported so links and other elements can look like buttons. */
export const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,border-color,color,transform] duration-(--duration-fast) ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** The one action that matters on this surface. */
        primary: "bg-accent text-accent-ink hover:bg-accent-hover",
        /** Default for everything else. */
        secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        /** Destructive or surge-related actions. */
        danger: "bg-critical text-white hover:brightness-110 command:text-[#1a0207]",
        /** Actions that move blood between sites. */
        bridge: "bg-bridge text-white hover:brightness-110 command:text-[#03201d]",
      },
      size: {
        sm: "h-8 rounded-(--radius-control) px-3 text-sm",
        md: "h-10 rounded-(--radius-control) px-4 text-[0.9375rem]",
        lg: "h-12 rounded-(--radius-control) px-5 text-base",
        xl: "h-14 rounded-(--radius-control) px-7 text-lg",
        icon: "size-9 rounded-(--radius-control)",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Icon rendered before the label. */
  icon?: ReactNode;
}

/** Button with variants `primary | secondary | ghost | danger | bridge` and sizes `sm | md | lg | xl | icon`. */
export function Button({ variant, size, loading = false, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** A react-router Link styled as a button. */
export function LinkButton({ variant, size, icon, className, children, ...rest }: LinkProps & ButtonVariantProps & { icon?: ReactNode }) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

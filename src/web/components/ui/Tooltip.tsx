import { useId, useState, type ReactElement, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element (button, link) or any inline content. */
  children: ReactElement | ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Lightweight tooltip shown on hover and keyboard focus, linked with aria-describedby.
 * Escape dismisses it. For essential information, show it inline instead.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      aria-describedby={id}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs leading-snug text-ink shadow-panel",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          open ? "block" : "hidden",
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}

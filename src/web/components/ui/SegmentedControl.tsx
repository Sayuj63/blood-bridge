import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group. */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}

/** Single-choice toggle (radiogroup). Arrow keys move the selection. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, size = "md", className }: SegmentedControlProps<T>) {
  const name = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step || enabled.length === 0) return;
    e.preventDefault();
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + step + enabled.length) % enabled.length];
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("inline-flex rounded-(--radius-control) border border-line bg-surface-2 p-0.5", className)}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            name={name}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-ring flex-1 whitespace-nowrap rounded-[calc(var(--radius-control)-2px)] font-medium transition-colors duration-(--duration-fast) disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              checked ? "bg-surface text-ink shadow-sm command:bg-surface-3" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

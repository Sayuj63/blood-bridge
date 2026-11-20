import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
  /** Spoken name when the visible label is terse, e.g. "O negative" for "O−". */
  ariaLabel?: string;
  /** Colour stripe along the bottom edge, e.g. the blood-group colour. */
  stripe?: string;
}

interface ChoiceGridProps<T extends string> {
  label: string;
  /** Visible label element id, when the group has one. */
  labelledBy?: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  columns: 2 | 4;
}

const COLS = { 2: "grid-cols-2", 4: "grid-cols-4" } as const;

/**
 * Single-choice grid (radiogroup) with big hit targets. Arrow keys move
 * left/right and up/down by a row; only the checked option is in the tab order.
 */
export function ChoiceGrid<T extends string>({ label, labelledBy, choices, value, onChange, columns }: ChoiceGridProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const i = choices.findIndex((c) => c.value === value);
    const next = (i + step + choices.length) % choices.length;
    onChange(choices[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={cn("grid gap-1.5", COLS[columns])}
    >
      {choices.map((c, i) => {
        const checked = c.value === value;
        return (
          <button
            key={c.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={c.ariaLabel}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(c.value)}
            className={cn(
              "focus-ring relative h-11 overflow-hidden rounded-(--radius-control) border px-2 text-sm font-semibold transition-colors duration-(--duration-fast)",
              checked
                ? "border-ink bg-ink text-canvas"
                : "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
            )}
          >
            {c.label}
            {c.stripe ? (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-1" style={{ background: c.stripe }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

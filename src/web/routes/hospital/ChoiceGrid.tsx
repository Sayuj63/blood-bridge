import { Check } from "lucide-react";
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
 * Single-choice grid (radiogroup) with large hit targets, pointer affordance,
 * visible checked indicator (non-color cue), and full Arrow / Home / End navigation.
 */
export function ChoiceGrid<T extends string>({ label, labelledBy, choices, value, onChange, columns }: ChoiceGridProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    const i = choices.findIndex((c) => c.value === value);
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = choices.length - 1;
    else {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[e.key];
      if (step !== undefined) next = (i + step + choices.length) % choices.length;
    }
    if (next === null) return;
    e.preventDefault();
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
              "focus-ring relative inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-2 text-sm font-semibold transition-all duration-(--duration-fast)",
              checked
                ? "border-[#C93245] bg-[#C93245] text-white shadow-xs"
                : "border-[#EAE6E3] bg-white text-[#171717] hover:border-[#C93245]/45 hover:bg-[#FFF5F5]",
            )}
          >
            {checked ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
            <span>{c.label}</span>
            {c.stripe ? (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-1" style={{ background: c.stripe }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

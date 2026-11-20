import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../../lib/cn";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** Small count or status after the label. */
  badge?: ReactNode;
}

export interface TabsProps<T extends string> {
  label: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
  className?: string;
}

/** WAI-ARIA tabs with roving focus (arrow keys, Home, End). Renders only the active panel. */
export function Tabs<T extends string>({ label, tabs, value, onChange, children, className }: TabsProps<T>) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));

  const onKeyDown = (e: KeyboardEvent) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {tabs.map((t, i) => {
          const selected = i === index;
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${base}-tab-${t.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.value)}
              className={cn(
                "focus-ring -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                selected ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${tabs[index]?.value}`} tabIndex={0} className="focus-ring pt-4">
        {children}
      </div>
    </div>
  );
}

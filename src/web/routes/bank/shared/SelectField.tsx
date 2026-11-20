import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { cn } from "../../../lib/cn";

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
}

/** Labelled native select, styled with tokens. */
export function SelectField<T extends string>({ label, value, options, onChange, className, hideLabel = false }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "block text-sm font-medium"}>
        {label}
      </label>
      <div className={cn("relative", !hideLabel && "mt-1.5")}>
        <select
          id={id}
          value={value}
          onChange={(e) => {
            const next = options.find((o) => o.value === e.target.value);
            if (next) onChange(next.value);
          }}
          className="focus-ring h-9 w-full appearance-none rounded-(--radius-control) border border-line-strong bg-surface pr-8 pl-3 text-sm"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      </div>
    </div>
  );
}

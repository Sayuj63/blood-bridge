import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { Button } from "../../../components/ui/Button";

export interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Labelled integer input with − / + buttons, clamped to [min, max]. */
export function NumberStepper({ label, value, min, max, onChange, hint }: NumberStepperProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <Button size="icon" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1, min, max))}>
          <Minus className="size-4" aria-hidden />
        </Button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange(clamp(n, min, max));
          }}
          className="focus-ring h-9 w-20 rounded-(--radius-control) border border-line-strong bg-surface text-center font-numeric text-lg font-bold"
        />
        <Button size="icon" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1, min, max))}>
          <Plus className="size-4" aria-hidden />
        </Button>
        {hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

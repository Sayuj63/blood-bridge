import { Minus, Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { MAX_UNITS } from "./formModel";

/** Units needed: − / number / +, clamped to 1..MAX_UNITS. The number field accepts typing and arrow keys. */
export function UnitsStepper({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(MAX_UNITS, Math.max(1, Math.round(n) || 1)));
  return (
    <div className="flex h-11 items-stretch overflow-hidden rounded-(--radius-control) border border-line bg-surface">
      <Button
        variant="ghost"
        className="h-full rounded-none px-3"
        aria-label="One unit fewer"
        onClick={() => set(value - 1)}
        disabled={value <= 1}
        icon={<Minus className="size-4" aria-hidden />}
      />
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_UNITS}
        value={value}
        onChange={(e) => set(e.target.valueAsNumber)}
        onFocus={(e) => e.target.select()}
        className="focus-ring w-full min-w-0 border-x border-line bg-transparent text-center font-numeric text-lg font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Button
        variant="ghost"
        className="h-full rounded-none px-3"
        aria-label="One unit more"
        onClick={() => set(value + 1)}
        disabled={value >= MAX_UNITS}
        icon={<Plus className="size-4" aria-hidden />}
      />
    </div>
  );
}

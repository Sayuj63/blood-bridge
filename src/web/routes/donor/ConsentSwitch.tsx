import { useId } from "react";
import { cn } from "../../lib/cn";
import { CONSENTS, type ConsentKey } from "./copy";

interface ConsentSwitchProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

/** A full-row switch: the whole row is a 56px+ mobile touch target. */
export function ConsentSwitch({ title, description, checked, onChange, disabled }: ConsentSwitchProps) {
  const titleId = useId();
  const descId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={titleId}
      aria-describedby={descId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-ring flex min-h-14 w-full items-start gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-[#FFF5F5]/60 disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span id={titleId} className="block text-sm font-bold leading-snug text-[#171717]">
          {title}
        </span>
        <span id={descId} className="mt-0.5 block text-xs leading-snug text-[#737373]">
          {description}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200",
          checked ? "border-[#C93245] bg-[#C93245]" : "border-[#D8CECA] bg-[#EAE6E3]",
        )}
      >
        <span
          className={cn(
            "absolute size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

export type ConsentValues = Record<ConsentKey, boolean>;

/** Three independent consent switches with plain-language explanations. */
export function ConsentList({
  values,
  onChange,
  disabled,
}: {
  values: ConsentValues;
  onChange: (key: ConsentKey, next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="divide-y divide-[#EAE6E3]">
      {CONSENTS.map((c) => (
        <li key={c.key}>
          <ConsentSwitch
            title={c.title}
            description={c.body}
            checked={values[c.key]}
            onChange={(next) => onChange(c.key, next)}
            disabled={disabled}
          />
        </li>
      ))}
      {values.consentAlerts && !values.consentLocation ? (
        <li className="py-3 text-xs font-medium text-[#B45309]">
          Alerts need your approximate area to find banks near you, so none will arrive until location is on.
        </li>
      ) : null}
    </ul>
  );
}

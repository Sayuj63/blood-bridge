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

/** A full-row switch: the whole row is the touch target, named by its title and described by its one-liner. */
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
      className="focus-ring flex min-h-14 w-full items-start gap-3 rounded-(--radius-control) px-1 py-3 text-left disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span id={titleId} className="block font-semibold leading-snug text-ink">
          {title}
        </span>
        <span id={descId} className="mt-0.5 block text-sm leading-snug text-ink-muted">
          {description}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-(--duration-base)",
          checked ? "border-ok bg-ok" : "border-line-strong bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute size-5 rounded-full bg-surface shadow-sm transition-transform duration-(--duration-base) ease-(--ease-out-expo)",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

export type ConsentValues = Record<ConsentKey, boolean>;

/** The three separate consents, each with its own switch and plain-language explanation. */
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
    <ul className="divide-y divide-line">
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
        <li className="py-3 text-sm text-warn">
          Alerts need your approximate area to find banks near you, so none will arrive until location is on.
        </li>
      ) : null}
    </ul>
  );
}

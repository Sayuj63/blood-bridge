import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import type { AreaDTO } from "../../../../shared/api";
import { BLOOD_GROUPS, LANGUAGES, LANGUAGE_LABEL, type BloodGroup, type Language } from "../../../../shared/domain";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { cn } from "../../../lib/cn";
import { spokenGroup } from "../../../lib/format";

const controlClass =
  "focus-ring h-12 w-full rounded-(--radius-control) border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint aria-[invalid=true]:border-critical";

/** Label, control, hint and error, wired together for assistive tech. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className={controlClass} {...input} />
      )}
    </Field>
  );
}

export function AreaSelect({
  areas,
  value,
  onChange,
  error,
}: {
  areas: AreaDTO[];
  value: string;
  onChange: (areaId: string) => void;
  error?: string;
}) {
  return (
    <Field label="Your neighbourhood" hint="Only the neighbourhood is stored, never your address." error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={controlClass}
        >
          <option value="" disabled>
            Choose an area
          </option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Eight large tiles in a radiogroup: big enough to tap without zooming. */
export function BloodGroupPicker({
  value,
  onChange,
  error,
}: {
  value: BloodGroup | null;
  onChange: (group: BloodGroup) => void;
  error?: string;
}) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  return (
    <div className="space-y-1.5">
      <p id={labelId} className="text-sm font-semibold text-ink">
        Blood group
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        className="grid grid-cols-4 gap-2"
      >
        {BLOOD_GROUPS.map((g) => {
          const checked = value === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={spokenGroup(g)}
              onClick={() => onChange(g)}
              className={cn(
                "focus-ring h-14 rounded-(--radius-control) border font-numeric text-lg font-bold transition-colors duration-(--duration-fast)",
                checked ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink hover:bg-surface-2",
              )}
            >
              {g.replace("-", "−")}
            </button>
          );
        })}
      </div>
      <p id={hintId} className="text-sm text-ink-muted">
        Self-declared. It's verified at your first donation.
      </p>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LanguagePicker({ value, onChange }: { value: Language; onChange: (language: Language) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-ink" aria-hidden>
        Alert language
      </p>
      <SegmentedControl
        label="Alert language"
        value={value}
        onChange={onChange}
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
        className="flex w-full [&_button]:h-11 [&_button]:text-base"
      />
    </div>
  );
}

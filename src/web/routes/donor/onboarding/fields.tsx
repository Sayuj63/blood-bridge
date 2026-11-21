import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import type { AreaDTO } from "../../../../shared/api";
import { BLOOD_GROUPS, LANGUAGES, LANGUAGE_LABEL, type BloodGroup, type Language } from "../../../../shared/domain";
import { cn } from "../../../lib/cn";
import { spokenGroup } from "../../../lib/format";

const controlClass =
  "focus-ring h-12 w-full rounded-xl border border-[#EAE6E3] bg-[#FAF9F6] px-3.5 text-base text-[#171717] placeholder:text-[#737373]/70 transition-colors focus:border-[#C93245] focus:bg-white aria-[invalid=true]:border-[#C93245]";

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
      <label htmlFor={id} className="block text-sm font-bold text-[#171717]">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-xs text-[#737373]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-[#C93245]">
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

/** Eight large tiles in a radiogroup: big enough to tap cleanly on mobile without zooming. */
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
      <p id={labelId} className="text-sm font-bold text-[#171717]">
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
                "d-num focus-ring h-14 rounded-xl border text-lg font-extrabold transition-all",
                checked
                  ? "border-[#C93245] bg-[#C93245] text-white shadow-sm"
                  : "border-[#EAE6E3] bg-[#FAF9F6] text-[#171717] hover:border-[#F2D7DB] hover:bg-[#FFF5F5]",
              )}
            >
              {g.replace("-", "−")}
            </button>
          );
        })}
      </div>
      <p id={hintId} className="text-xs text-[#737373]">
        Self-declared. Verified at your first donation.
      </p>
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-[#C93245]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LanguagePicker({ value, onChange }: { value: Language; onChange: (language: Language) => void }) {
  const labelId = useId();
  return (
    <div className="space-y-1.5">
      <p id={labelId} className="text-sm font-bold text-[#171717]">
        Alert language
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-2">
        {LANGUAGES.map((l) => {
          const active = value === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(l)}
              className={cn(
                "focus-ring flex h-12 touch-manipulation items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-[0.98]",
                active
                  ? "border-[#C93245] bg-[#C93245] text-white shadow-xs"
                  : "border-[#EAE6E3] bg-[#FAF9F6] text-[#171717] hover:border-[#F2D7DB] hover:bg-[#FFF5F5]",
              )}
            >
              {LANGUAGE_LABEL[l]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

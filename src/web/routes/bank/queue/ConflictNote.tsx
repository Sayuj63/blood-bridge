import { errorMessage } from "../../../lib/api";
import { isConflict } from "../shared/useAction";

/** Inline note when an action lost a race (409): someone else changed the reservation or units first. */
export function ConflictNote({ errors }: { errors: readonly unknown[] }) {
  const conflict = errors.find(isConflict);
  if (!conflict) return null;
  return (
    <p role="alert" className="mb-2 rounded-(--radius-chip) bg-critical-soft px-2 py-1.5 text-xs font-semibold text-critical">
      Conflicting reservation: {errorMessage(conflict)}
    </p>
  );
}

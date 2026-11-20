import type { ReservationDTO } from "../../../../shared/api";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { ExpiryBadge } from "../../../components/ui/ExpiryBadge";

/** The units the system picked for this request (soonest-expiring compatible first). */
export function SuggestedUnits({ units }: { units: ReservationDTO["units"] }) {
  if (units.length === 0) return null;
  return (
    <div className="mt-2.5">
      <p className="font-label text-2xs text-ink-faint uppercase">Suggested units · pull these</p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {units.map((u) => (
          <li key={u.id} className="inline-flex items-center gap-2 rounded-(--radius-chip) bg-surface-2 py-1 pr-1 pl-1.5">
            <BloodGroupChip group={u.bloodGroup} size="sm" />
            <code className="font-mono text-xs">{u.id}</code>
            <ExpiryBadge expiresAt={u.expiresAt} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}

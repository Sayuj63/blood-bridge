import type { BloodGroup, Component } from "../../../shared/domain";
import { COMPONENT_SHORT } from "../../../shared/domain";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";

/** "2 × O− PLT  1 × O+ PLT" — allocated units grouped by blood group. */
export function AllocationChips({ units }: { units: readonly { bloodGroup: BloodGroup; component: Component }[] }) {
  const counts = new Map<string, { group: BloodGroup; component: Component; n: number }>();
  for (const u of units) {
    const key = `${u.bloodGroup}:${u.component}`;
    const entry = counts.get(key) ?? { group: u.bloodGroup, component: u.component, n: 0 };
    entry.n += 1;
    counts.set(key, entry);
  }
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {[...counts.values()].map((c) => (
        <li key={`${c.group}:${c.component}`} className="inline-flex items-center gap-1.5">
          <span className="font-numeric text-lg font-bold leading-none">{c.n}</span>
          <span className="text-ink-faint" aria-hidden>
            ×
          </span>
          <BloodGroupChip group={c.group} size="md" />
          <span className="font-label text-xs text-ink-muted">{COMPONENT_SHORT[c.component]}</span>
        </li>
      ))}
    </ul>
  );
}

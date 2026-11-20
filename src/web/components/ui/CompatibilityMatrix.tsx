import { useState } from "react";
import { compatibilityMatrix } from "../../../shared/compatibility";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, type Component } from "../../../shared/domain";
import { cn } from "../../lib/cn";
import { spokenGroup } from "../../lib/format";
import { Badge } from "./Badge";
import { BloodGroupChip } from "./BloodGroupChip";
import { SegmentedControl } from "./SegmentedControl";

/**
 * The compatibility table the ranking uses, per component. Always labelled
 * demo logic: it is simplified and not clinical guidance.
 */
export function CompatibilityMatrix({ initial = "red_cells", className }: { initial?: Component; className?: string }) {
  const [component, setComponent] = useState<Component>(initial);
  const matrix = compatibilityMatrix(component);

  return (
    <figure className={cn("min-w-0", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Component"
          size="sm"
          value={component}
          onChange={setComponent}
          options={COMPONENTS.map((c) => ({ value: c, label: COMPONENT_LABEL[c] }))}
          className="max-w-full overflow-x-auto"
        />
        <Badge tone="warn" outline>
          Demo logic · not clinical guidance
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-separate border-spacing-0.5 text-center text-sm">
          <caption className="sr-only">
            {COMPONENT_LABEL[component]} compatibility. Rows are the patient's group, columns the donor unit's group.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-1 pb-1 text-left font-label text-2xs font-normal text-ink-faint">
                Patient ↓ · Unit →
              </th>
              {BLOOD_GROUPS.map((d) => (
                <th key={d} scope="col" className="pb-1">
                  <BloodGroupChip group={d} size="sm" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BLOOD_GROUPS.map((r) => (
              <tr key={r}>
                <th scope="row" className="pr-1 text-left">
                  <BloodGroupChip group={r} size="sm" />
                </th>
                {BLOOD_GROUPS.map((d) => {
                  const ok = matrix[r][d];
                  const exact = r === d;
                  return (
                    <td
                      key={d}
                      className={cn(
                        "h-7 rounded-sm font-label text-xs",
                        ok ? (exact ? "bg-ok text-white command:text-[#03170d]" : "bg-ok-soft text-ok") : "bg-surface-2 text-ink-faint",
                      )}
                      aria-label={`${spokenGroup(d)} unit for ${spokenGroup(r)} patient: ${ok ? (exact ? "exact match" : "compatible") : "not compatible"}`}
                    >
                      {ok ? (exact ? "=" : "✓") : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-xs text-ink-muted">
        “=” exact group · “✓” compatible, flagged for clinician confirmation · “·” not compatible.
      </figcaption>
    </figure>
  );
}

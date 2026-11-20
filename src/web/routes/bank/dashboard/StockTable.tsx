import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, COMPONENT_SHORT } from "../../../../shared/domain";
import type { StockCell } from "../../../../shared/api";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { StockCellRow } from "./StockCellRow";
import { LevelLegend } from "./LevelLegend";

const SUB_COLUMNS = [
  { key: "onHand", label: "On hand", title: "Available units on the shelf" },
  { key: "reserved", label: "Rsv", title: "Reserved for a hospital request" },
  { key: "48h", label: "≤48h", title: "Available units expiring within 48 hours" },
  { key: "7d", label: "≤7d", title: "Available units expiring within 7 days" },
] as const;

/** Blood group (rows) × component (column groups): on hand, reserved, expiring 48h, expiring 7d. */
export function StockTable({ cells }: { cells: StockCell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.bloodGroup}|${c.component}`, c]));

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto rounded-(--radius-control) border border-line">
        <table className="w-full min-w-[54rem] border-collapse text-sm">
          <caption className="sr-only">
            Stock by blood group and component. Each component shows units on hand with stock level and days of cover,
            reserved units, and units expiring within 48 hours and 7 days.
          </caption>
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" rowSpan={2} className="sticky left-0 z-10 w-16 bg-surface-2 px-3 text-left font-label text-xs text-ink-muted">
                Group
              </th>
              {COMPONENTS.map((c) => (
                <th key={c} scope="colgroup" colSpan={4} className="border-l border-line px-2 pt-2 pb-1 text-left">
                  <span className="font-label text-sm text-ink">{COMPONENT_LABEL[c]}</span>
                  <span className="ml-1.5 font-label text-2xs text-ink-faint">{COMPONENT_SHORT[c]}</span>
                </th>
              ))}
            </tr>
            <tr>
              {COMPONENTS.map((c) =>
                SUB_COLUMNS.map((s, i) => (
                  <th
                    key={`${c}-${s.key}`}
                    scope="col"
                    title={s.title}
                    className={`px-2 pb-2 text-right font-label text-2xs font-normal text-ink-faint ${i === 0 ? "border-l border-line" : ""}`}
                  >
                    {s.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {BLOOD_GROUPS.map((g) => (
              <tr key={g} className="border-t border-line">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left">
                  <BloodGroupChip group={g} size="md" />
                </th>
                {COMPONENTS.map((c) => {
                  const cell = byKey.get(`${g}|${c}`);
                  return cell ? <StockCellRow key={c} cell={cell} /> : <td key={c} colSpan={4} className="border-l border-line" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LevelLegend className="mt-3" />
    </div>
  );
}

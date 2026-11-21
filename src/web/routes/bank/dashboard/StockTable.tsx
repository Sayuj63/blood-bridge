import { Table2 } from "lucide-react";
import { useState } from "react";
import type { StockCell } from "../../../../shared/api";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, COMPONENT_SHORT, type Component } from "../../../../shared/domain";
import { cn } from "../../../lib/cn";
import { LevelLegend } from "./LevelLegend";
import { StockCellRow } from "./StockCellRow";

const SUB_COLUMNS = [
  { key: "onHand", label: "On hand", title: "Available units on the shelf" },
  { key: "reserved", label: "Rsv", title: "Reserved for a hospital request" },
  { key: "48h", label: "≤48h", title: "Available units expiring within 48 hours" },
  { key: "7d", label: "≤7d", title: "Available units expiring within 7 days" },
] as const;

/** Blood group (rows) × component (column groups): interactive component filter + warm ivory matrix. */
export function StockTable({ cells }: { cells: StockCell[] }) {
  const [filterComp, setFilterComp] = useState<"ALL" | Component>("ALL");
  const byKey = new Map(cells.map((c) => [`${c.bloodGroup}|${c.component}`, c]));
  const visibleComponents = filterComp === "ALL" ? COMPONENTS : ([filterComp] as const);

  return (
    <section aria-label="Blood stock matrix" className="b-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <Table2 className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="b-display text-sm font-bold text-[#171717]">Stock ledger by group &amp; component</h2>
            <p className="text-[11px] text-[#737373]">On hand, reserved holds, and 48h / 7d expiry watch counts</p>
          </div>
        </div>

        {/* Component Filter Pills */}
        <div role="radiogroup" aria-label="Filter by component" className="flex flex-wrap items-center gap-1 rounded-xl bg-[#FAF9F6] p-1 ring-1 ring-[#EAE6E3]">
          <button
            type="button"
            role="radio"
            aria-checked={filterComp === "ALL"}
            onClick={() => setFilterComp("ALL")}
            className={cn(
              "focus-ring rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              filterComp === "ALL" ? "bg-[#C93245] text-white shadow-2xs" : "text-[#737373] hover:text-[#171717]",
            )}
          >
            All
          </button>
          {COMPONENTS.map((c) => {
            const active = filterComp === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFilterComp(c)}
                className={cn(
                  "focus-ring rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  active ? "bg-[#C93245] text-white shadow-2xs" : "text-[#737373] hover:text-[#171717]",
                )}
              >
                {COMPONENT_SHORT[c]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-xl border border-[#EAE6E3]">
        <table className={cn("w-full border-collapse text-sm", filterComp === "ALL" ? "min-w-[52rem]" : "min-w-[24rem]")}>
          <caption className="sr-only">
            Stock by blood group and component. Each component shows units on hand with stock level and days of cover,
            reserved units, and units expiring within 48 hours and 7 days.
          </caption>
          <thead className="bg-[#FAF9F6]">
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className="sticky left-0 z-10 w-18 bg-[#FAF9F6] px-3.5 text-left text-[11px] font-bold tracking-wider text-[#737373] uppercase"
              >
                Group
              </th>
              {visibleComponents.map((c) => (
                <th key={c} scope="colgroup" colSpan={4} className="border-l border-[#EAE6E3] px-3 pt-2.5 pb-1 text-left">
                  <span className="b-display text-xs font-bold text-[#171717]">{COMPONENT_LABEL[c]}</span>
                  <span className="ml-1.5 rounded bg-[#FCEBED] px-1.5 py-0.5 text-[10px] font-bold text-[#A82436]">
                    {COMPONENT_SHORT[c]}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {visibleComponents.map((c) =>
                SUB_COLUMNS.map((s, i) => (
                  <th
                    key={`${c}-${s.key}`}
                    scope="col"
                    title={s.title}
                    className={cn(
                      "px-2.5 pb-2.5 text-right text-[10px] font-semibold tracking-wider text-[#737373] uppercase",
                      i === 0 && "border-l border-[#EAE6E3]",
                    )}
                  >
                    {s.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE6E3] bg-white">
            {BLOOD_GROUPS.map((g) => (
              <tr key={g} className="transition-colors hover:bg-[#FFF5F5]/45">
                <th scope="row" className="sticky left-0 z-10 bg-white px-3.5 py-2 text-left">
                  <span className="b-num inline-grid h-8 w-11 place-items-center rounded-lg bg-[#FCEBED] text-xs font-extrabold text-[#A82436]">
                    {g.replace("-", "−")}
                  </span>
                </th>
                {visibleComponents.map((c) => {
                  const cell = byKey.get(`${g}|${c}`);
                  return cell ? <StockCellRow key={c} cell={cell} /> : <td key={c} colSpan={4} className="border-l border-[#EAE6E3]" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LevelLegend className="mt-3.5" />
    </section>
  );
}

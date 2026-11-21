import { PackagePlus, Refrigerator } from "lucide-react";
import type { SiteStockDTO } from "../../../../shared/api";
import { ActivityFeed } from "./ActivityFeed";
import { AddUnitsForm } from "./AddUnitsForm";
import { ConnectedSystems } from "./ConnectedSystems";
import { UnitList } from "./UnitList";

/** Add units, mark units used or removed, find a unit by scan, and watch the audit trail update. */
export function UpdateStockPanel({ stock }: { stock: SiteStockDTO }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-6">
        <ConnectedSystems siteId={stock.site.id} />

        <section aria-labelledby="add-units-title" className="b-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <PackagePlus className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="add-units-title" className="b-display text-sm font-bold text-[#171717]">
                Add units to fridge
              </h2>
              <p className="text-[11px] text-[#737373]">Record newly collected or received blood bags</p>
            </div>
          </div>
          <AddUnitsForm siteId={stock.site.id} />
        </section>

        <section aria-labelledby="units-title" className="b-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <Refrigerator className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="units-title" className="b-display text-sm font-bold text-[#171717]">
                Units on the shelf
              </h2>
              <p className="text-[11px] text-[#737373]">Filter, scan barcode, or mark units used/removed</p>
            </div>
          </div>
          <UnitList units={stock.units} />
        </section>
      </div>

      <div className="b-card p-5">
        <ActivityFeed siteId={stock.site.id} />
      </div>
    </div>
  );
}

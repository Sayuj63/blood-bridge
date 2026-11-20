import type { SiteStockDTO } from "../../../../shared/api";
import { ActivityFeed } from "./ActivityFeed";
import { AddUnitsForm } from "./AddUnitsForm";
import { UnitList } from "./UnitList";

/** Add units, mark units used or removed, find a unit by scan, and watch the audit trail update. */
export function UpdateStockPanel({ stock }: { stock: SiteStockDTO }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <section aria-labelledby="add-units-title">
          <h3 id="add-units-title" className="mb-3 font-semibold">
            Add units
          </h3>
          <AddUnitsForm siteId={stock.site.id} />
        </section>
        <section aria-labelledby="units-title">
          <h3 id="units-title" className="mb-3 font-semibold">
            Units on the shelf
          </h3>
          <UnitList units={stock.units} />
        </section>
      </div>
      <ActivityFeed siteId={stock.site.id} />
    </div>
  );
}

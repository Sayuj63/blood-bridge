import type { StockCell } from "../../../../shared/api";
import { DonorDriveControls } from "./DonorDriveControls";
import { IncomingDonors } from "./IncomingDonors";

/** Donor drive: targeted alerts with a consent-aware preview, and the donors who said yes. */
export function DonorDrivePanel({ siteId, cells }: { siteId: string; cells: readonly StockCell[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="drive-title">
        <h3 id="drive-title" className="font-semibold">
          Start a donor drive
        </h3>
        <p className="mt-1 mb-3 text-sm text-ink-muted">Preview first: nothing is sent until you confirm.</p>
        <DonorDriveControls siteId={siteId} cells={cells} />
      </section>
      <IncomingDonors siteId={siteId} />
    </div>
  );
}

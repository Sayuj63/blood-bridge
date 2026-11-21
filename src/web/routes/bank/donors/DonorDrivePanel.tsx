import { Megaphone } from "lucide-react";
import type { StockCell } from "../../../../shared/api";
import { DonorDriveControls } from "./DonorDriveControls";
import { IncomingDonors } from "./IncomingDonors";

/** Donor drive: targeted alerts with a consent-aware preview, and the donors who said yes. */
export function DonorDrivePanel({ siteId, cells }: { siteId: string; cells: readonly StockCell[] }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section aria-labelledby="drive-title" className="b-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <Megaphone className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="drive-title" className="b-display text-sm font-bold text-[#171717]">
              Start a donor drive
            </h2>
            <p className="text-[11px] text-[#737373]">Preview first: nothing is sent until you confirm.</p>
          </div>
        </div>
        <DonorDriveControls siteId={siteId} cells={cells} />
      </section>

      <div className="b-card p-5 sm:p-6">
        <IncomingDonors siteId={siteId} />
      </div>
    </div>
  );
}

import { useSearchParams } from "react-router";
import type { SiteDTO } from "../../../shared/api";
import { POLICY } from "../../../shared/domain";
import { ErrorState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { useForecast, useTransferBoard } from "../../lib/queries";
import { useNow } from "../../lib/useNow";
import { BankLayout, isBankTab, type BankTab } from "./BankLayout";
import { KpiTiles } from "./dashboard/KpiTiles";
import { StaleStockPrompt } from "./dashboard/StaleStockPrompt";
import { StockCharts } from "./dashboard/StockCharts";
import { StockTable } from "./dashboard/StockTable";
import { SurgeForecast } from "./dashboard/SurgeForecast";
import { DonorDrivePanel } from "./donors/DonorDrivePanel";
import { useIncomingDonors, useQueue, useSiteStock } from "./hooks";
import { RequestQueue } from "./queue/RequestQueue";
import { isOpen } from "./queue/status";
import { UpdateStockPanel } from "./stock/UpdateStockPanel";
import { TransfersPanel } from "./transfers/TransfersPanel";

export interface BankWorkspaceProps {
  site: SiteDTO;
  banks: readonly SiteDTO[];
  onSelectSite: (siteId: string) => void;
  embed: boolean;
}

/**
 * Blood Bank operational desk.
 * Sidebar switches between Stock (charts + matrix), Update stock, Transfers, and Donor drive
 * while keeping the live Incoming Requests queue pinned on wide viewports.
 */
export function BankWorkspace({ site, banks, onSelectSite, embed }: BankWorkspaceProps) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: BankTab = isBankTab(raw) ? raw : "stock";

  const stock = useSiteStock(site.id);
  const forecast = useForecast();
  const transfers = useTransferBoard(site.id).data;
  const incoming = useIncomingDonors(site.id).data;
  const queue = useQueue(site.id).data;
  const now = useNow(30_000);

  const stale = stock.data ? now - stock.data.site.lastSyncAt > POLICY.staleAfterMinutes * 60_000 : false;
  const pendingTransfers = (transfers?.suggestions.length ?? 0) + (transfers?.active.filter((t) => t.status === "approved").length ?? 0);
  const openRequests = queue ? queue.filter(isOpen).length : 0;

  const setTab = (next: BankTab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  return (
    <BankLayout
      site={site}
      banks={banks}
      onSelectSite={onSelectSite}
      tab={tab}
      onTab={setTab}
      embed={embed}
      pendingTransfers={pendingTransfers}
      incomingDonors={incoming?.length ?? 0}
      openRequests={openRequests}
    >
      {stock.data && stale ? <StaleStockPrompt siteId={site.id} lastSyncAt={stock.data.site.lastSyncAt} /> : null}
      {forecast.data?.surge ? <SurgeForecast forecast={forecast.data} siteId={site.id} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,24rem)] xl:items-start">
        {/* Live Incoming Requests Queue — pinned on desktop, surfaces first on narrow viewports */}
        <div className="xl:sticky xl:top-20 xl:col-start-2 xl:row-start-1 xl:max-h-[calc(100dvh-6rem)] xl:overflow-hidden xl:[&>section]:max-h-[inherit]">
          <RequestQueue siteId={site.id} />
        </div>

        {/* Main Workspace Column */}
        <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-1">
          {stock.isPending ? (
            <div className="b-card p-6">
              <SkeletonRows rows={8} />
            </div>
          ) : null}
          {stock.isError ? (
            <div className="b-card p-6">
              <ErrorState what="this bank's stock" error={stock.error} onRetry={() => void stock.refetch()} />
            </div>
          ) : null}

          {stock.data ? (
            <>
              {tab === "stock" ? (
                <>
                  <KpiTiles stock={stock.data} />
                  <StockCharts stock={stock.data} />
                  <StockTable cells={stock.data.cells} />
                </>
              ) : null}
              {tab === "update" ? <UpdateStockPanel stock={stock.data} /> : null}
              {tab === "transfers" ? <TransfersPanel siteId={site.id} units={stock.data.units} /> : null}
              {tab === "donors" ? <DonorDrivePanel siteId={site.id} cells={stock.data.cells} /> : null}
            </>
          ) : null}
        </div>
      </div>
    </BankLayout>
  );
}

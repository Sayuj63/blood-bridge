import { POLICY } from "../../../shared/domain";
import { ErrorState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { useForecast } from "../../lib/queries";
import { useNow } from "../../lib/useNow";
import { BankTabs } from "./BankTabs";
import { KpiTiles } from "./dashboard/KpiTiles";
import { StaleStockPrompt } from "./dashboard/StaleStockPrompt";
import { SurgeForecast } from "./dashboard/SurgeForecast";
import { useSiteStock } from "./hooks";
import { RequestQueue } from "./queue/RequestQueue";

/**
 * Wide screens: work tabs on the left, the live queue pinned on the right.
 * Narrow screens (the /stage iframe): the queue comes first.
 */
export function BankWorkspace({ siteId }: { siteId: string }) {
  const stock = useSiteStock(siteId);
  const forecast = useForecast();
  const now = useNow(30_000);
  const stale = stock.data ? now - stock.data.site.lastSyncAt > POLICY.staleAfterMinutes * 60_000 : false;

  return (
    <div className="space-y-4">
      {stock.data && stale ? <StaleStockPrompt siteId={siteId} lastSyncAt={stock.data.site.lastSyncAt} /> : null}
      {forecast.data?.surge ? <SurgeForecast forecast={forecast.data} siteId={siteId} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] xl:items-start">
        <div className="xl:sticky xl:top-20 xl:col-start-2 xl:row-start-1 xl:max-h-[calc(100dvh-6rem)] xl:overflow-hidden xl:[&>section]:max-h-[inherit]">
          <RequestQueue siteId={siteId} />
        </div>
        <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-start-1">
          {stock.isPending ? <SkeletonRows rows={8} /> : null}
          {stock.isError ? <ErrorState what="this bank's stock" error={stock.error} onRetry={() => void stock.refetch()} /> : null}
          {stock.data ? (
            <>
              <KpiTiles stock={stock.data} />
              <BankTabs stock={stock.data} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

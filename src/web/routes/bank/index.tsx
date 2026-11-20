import { Building2 } from "lucide-react";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Skeleton, SkeletonRows } from "../../components/ui/Skeleton";
import { BankHeader } from "./BankHeader";
import { BankWorkspace } from "./BankWorkspace";
import { BankSiteContext, actorFor, useActingBank } from "./shared/useBankSite";

/** Blood bank operator view (/bank): confirm requests, keep stock honest, move expiring units, call donors. */
export default function BloodbankView() {
  const { sites, banks, site, selectSite } = useActingBank();

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-4 px-3 py-4 sm:px-5 sm:py-5">
      {sites.isPending ? <LoadingShell /> : null}
      {sites.isError ? <ErrorState what="blood banks" error={sites.error} onRetry={() => void sites.refetch()} /> : null}
      {sites.isSuccess && !site ? (
        <EmptyState icon={<Building2 />} title="No blood banks yet" description="Reset the demo from the command view to load Mumbai's blood banks." />
      ) : null}
      {site ? (
        <BankSiteContext.Provider value={{ site, actor: actorFor(site.id) }}>
          <BankHeader site={site} banks={banks} onSelect={selectSite} />
          <BankWorkspace key={site.id} siteId={site.id} />
        </BankSiteContext.Provider>
      ) : null}
    </div>
  );
}

function LoadingShell() {
  return (
    <div aria-busy className="space-y-4">
      <span className="sr-only">Loading blood bank view</span>
      <Skeleton className="h-16 w-full max-w-xl" />
      <Skeleton className="h-24 w-full" />
      <SkeletonRows rows={6} />
    </div>
  );
}

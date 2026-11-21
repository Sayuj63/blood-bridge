import { Building2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Skeleton, SkeletonRows } from "../../components/ui/Skeleton";
import "./bank.css";
import { BankWorkspace } from "./BankWorkspace";
import { BankSiteContext, actorFor, useActingBank } from "./shared/useBankSite";

/** Blood bank operator view (/bank): confirm requests, keep stock honest, move expiring units, call donors. */
export default function BloodbankView() {
  const { sites, banks, site, selectSite } = useActingBank();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";

  if (sites.isPending) {
    return (
      <div className="bank-theme flex flex-1 flex-col p-6">
        <LoadingShell />
      </div>
    );
  }

  if (sites.isError) {
    return (
      <div className="bank-theme flex flex-1 flex-col items-center justify-center p-6">
        <ErrorState what="blood banks" error={sites.error} onRetry={() => void sites.refetch()} />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="bank-theme flex flex-1 flex-col items-center justify-center p-6">
        <EmptyState
          icon={<Building2 />}
          title="No blood banks yet"
          description="Reset the demo from the command view to load Mumbai's blood banks."
        />
      </div>
    );
  }

  return (
    <BankSiteContext.Provider value={{ site, actor: actorFor(site.id) }}>
      <BankWorkspace key={site.id} site={site} banks={banks} onSelectSite={selectSite} embed={embed} />
    </BankSiteContext.Provider>
  );
}

function LoadingShell() {
  return (
    <div aria-busy className="mx-auto w-full max-w-[80rem] space-y-5">
      <span className="sr-only">Loading blood bank view</span>
      <Skeleton className="h-14 w-full max-w-xl rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <SkeletonRows rows={6} />
    </div>
  );
}

import { Hospital } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { CompatibilityDialog } from "./CompatibilityDialog";
import { HospitalHeader } from "./HospitalHeader";
import { DEFAULT_FORM, type RequestFormValues } from "./formModel";
import { RequestWorkspace } from "./RequestWorkspace";
import { StockPanel } from "./StockPanel";
import { SurgeNotice } from "./SurgeNotice";
import { useHospitalView } from "./useHospitalView";

/**
 * Hospital desk: request blood, reserve the best compatible in-date option in one
 * tap, and track it live until it reaches the ward. Secondary tab: own stock.
 */
export default function HospitalView() {
  const { sites, hospitals, hospital, requestId, tab, selectHospital, openRequest, setTab } = useHospitalView();
  const [formValues, setFormValues] = useState<RequestFormValues>(DEFAULT_FORM);
  const [compatOpen, setCompatOpen] = useState(false);

  if (sites.isPending) {
    return (
      <div className="mx-auto w-full max-w-[100rem] space-y-4 px-3 py-4 sm:px-5" aria-busy>
        <Skeleton className="h-14 w-72" />
        <div className="grid gap-4 lg:grid-cols-[23rem_1fr]">
          <Skeleton className="h-[34rem] rounded-(--radius-panel)" />
          <Skeleton className="h-[34rem] rounded-(--radius-panel)" />
        </div>
      </div>
    );
  }
  if (sites.isError) {
    return <ErrorState className="m-auto" what="the list of facilities" error={sites.error} onRetry={() => void sites.refetch()} />;
  }
  if (!hospital) {
    return (
      <EmptyState
        className="m-auto"
        icon={<Hospital />}
        title="No hospitals registered"
        description="Load the demo data from the command view to add Mumbai hospitals and blood banks."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-4 px-3 py-4 sm:px-5">
      <HospitalHeader
        hospital={hospital}
        hospitals={hospitals}
        onSelectHospital={selectHospital}
        tab={tab}
        onTab={setTab}
        onOpenCompatibility={() => setCompatOpen(true)}
      />
      <SurgeNotice />
      {tab === "request" ? (
        <RequestWorkspace
          key={hospital.id}
          hospital={hospital}
          requestId={requestId}
          openRequest={openRequest}
          formValues={formValues}
          onFormChange={setFormValues}
        />
      ) : (
        <StockPanel key={hospital.id} hospital={hospital} />
      )}
      <CompatibilityDialog open={compatOpen} onClose={() => setCompatOpen(false)} component={formValues.component} />
    </div>
  );
}

import { useMemo, useState } from "react";
import type { CreateRequestInput, SiteDTO } from "../../../shared/api";
import { COMPONENT_LABEL } from "../../../shared/domain";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/cn";
import { plural } from "../../lib/format";
import { RequestDetail } from "./RequestDetail";
import { RequestForm } from "./RequestForm";
import { RequestsList } from "./RequestsList";
import { ResultsPanel } from "./ResultsPanel";
import { toCreateInput, toSearchInput, type RequestFormValues } from "./formModel";
import { useHospitalMutations } from "./useHospitalMutations";
import { WorkspaceIntro } from "./WorkspaceIntro";

interface RequestWorkspaceProps {
  hospital: SiteDTO;
  requestId: string | null;
  openRequest: (id: string | null) => void;
  formValues: RequestFormValues;
  onFormChange: (values: RequestFormValues) => void;
}

/**
 * Request tab. Wide: form and today's requests on the left, results or the
 * tracker on the right. Narrow: form, then results/tracker (tracker first when open), then the list.
 */
export function RequestWorkspace({ hospital, requestId, openRequest, formValues, onFormChange }: RequestWorkspaceProps) {
  const [submitted, setSubmitted] = useState<CreateRequestInput | null>(null);
  const [donorsAlerted, setDonorsAlerted] = useState<Record<string, number>>({});
  const { createAndReserve, reserve, reserveSplit, critical } = useHospitalMutations(hospital.id, { openRequest });

  const search = useMemo(() => (submitted ? toSearchInput(submitted) : null), [submitted]);
  const reservingSiteId = createAndReserve.isPending
    ? createAndReserve.variables.bankSiteId
    : reserve.isPending
      ? reserve.variables.bankSiteId
      : null;

  const raiseCritical = (target: { requestId: string } | { input: CreateRequestInput }) =>
    critical.mutate(target, {
      onSuccess: ({ requestId: id, sent }) => setDonorsAlerted((prev) => ({ ...prev, [id]: sent })),
    });

  const findBlood = (values: RequestFormValues) => {
    setSubmitted(toCreateInput(values, hospital.id, Date.now()));
    openRequest(null);
  };

  let main;
  if (requestId) {
    main = (
      <RequestDetail
        key={requestId}
        requestId={requestId}
        hospital={hospital}
        reservingSiteId={reservingSiteId}
        onReserve={(request, option) => reserve.mutate({ requestId: request.id, bankSiteId: option.siteId })}
        onCritical={(id) => raiseCritical({ requestId: id })}
        criticalPending={critical.isPending}
        onReserveSplit={(id) => reserveSplit.mutate({ requestId: id })}
        splitPending={reserveSplit.isPending}
        donorsAlerted={donorsAlerted[requestId]}
      />
    );
  } else if (submitted && search) {
    main = (
      <ResultsPanel
        autoFocus
        hospital={hospital}
        search={search}
        title={`${plural(search.unitsNeeded, "unit")} of ${search.bloodGroup.replace("-", "−")} ${COMPONENT_LABEL[search.component].toLowerCase()}`}
        reservingSiteId={reservingSiteId}
        onReserve={(option) => createAndReserve.mutate({ input: submitted, bankSiteId: option.siteId }, { onSuccess: () => setSubmitted(null) })}
        onCritical={() => raiseCritical({ input: { ...submitted, urgency: "critical" } })}
        criticalPending={critical.isPending}
        onReserveSplit={() => reserveSplit.mutate({ input: submitted }, { onSuccess: () => setSubmitted(null) })}
        splitPending={reserveSplit.isPending}
      />
    );
  } else {
    main = <WorkspaceIntro hospital={hospital} />;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(20rem,23rem)_minmax(0,1fr)]">
      <Card className="lg:col-start-1 lg:row-start-1">
        <RequestForm
          values={formValues}
          onChange={onFormChange}
          onSearch={findBlood}
          onCritical={(values) => raiseCritical({ input: toCreateInput(values, hospital.id, Date.now()) })}
          criticalPending={critical.isPending}
        />
      </Card>
      <div className={cn("min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1", requestId && "order-first lg:order-none")}>{main}</div>
      <Card className="lg:col-start-1 lg:row-start-2">
        <RequestsList hospitalId={hospital.id} selectedId={requestId} onSelect={openRequest} />
      </Card>
    </div>
  );
}

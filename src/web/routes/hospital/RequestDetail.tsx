import { useQuery } from "@tanstack/react-query";
import { CircleSlash, PartyPopper } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { RequestDTO, SiteDTO } from "../../../shared/api";
import type { RankedOption } from "../../../shared/ranking";
import { ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { plural } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { RequestSummary } from "./RequestSummary";
import { ReservationTracker } from "./ReservationTracker";
import { RerouteBanner, RerouteHistory } from "./RerouteHistory";
import { ResultsPanel } from "./ResultsPanel";
import { closedReason, isLive, unitsHeld } from "./statusMeta";

interface RequestDetailProps {
  requestId: string;
  hospital: SiteDTO;
  onReserve: (request: RequestDTO, option: RankedOption) => void;
  reservingSiteId: string | null;
  onCritical: (requestId: string) => void;
  criticalPending: boolean;
  donorsAlerted?: number;
}

/** One request: live tracker(s), reroute history, and — while units are still uncovered — the ranked options. */
export function RequestDetail({ requestId, hospital, onReserve, reservingSiteId, onCritical, criticalPending, donorsAlerted }: RequestDetailProps) {
  const headingRef = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: ({ signal }) => api.requests.get(requestId, signal),
  });
  const request = query.data;

  useEffect(() => {
    headingRef.current?.focus();
  }, [requestId]);

  const remaining = request ? request.unitsNeeded - unitsHeld(request) : 0;
  const search = useMemo(
    () =>
      request && remaining > 0
        ? {
            hospitalId: request.hospitalId,
            bloodGroup: request.bloodGroup,
            component: request.component,
            unitsNeeded: remaining,
            urgency: request.urgency,
            neededBy: request.neededBy,
          }
        : null,
    [request, remaining],
  );

  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-24 rounded-(--radius-panel)" />
        <Skeleton className="h-80 rounded-(--radius-panel)" />
      </div>
    );
  }
  if (query.isError) return <ErrorState what="this request" error={query.error} onRetry={() => void query.refetch()} />;

  const r = query.data;
  const live = r.reservations.filter(isLive);
  const lastClosed = r.reservations.find((x) => !isLive(x));
  const canAlert = r.urgency === "critical" && r.criticalBroadcastAt === null;

  return (
    <div ref={headingRef} tabIndex={-1} className="space-y-4 outline-none" aria-label={`Request ${r.id}`}>
      <RequestSummary request={r} onCritical={() => onCritical(r.id)} criticalPending={criticalPending} donorsAlerted={donorsAlerted} />
      {r.status === "fulfilled" ? (
        <p role="status" className="flex items-center gap-2 rounded-(--radius-panel) bg-ok-soft p-4 font-semibold text-ok">
          <PartyPopper className="size-5" aria-hidden />
          Fulfilled: all {plural(r.unitsNeeded, "unit")} delivered to {r.ward}.
        </p>
      ) : null}
      <RerouteBanner request={r} />
      {live.map((res) => (
        <ReservationTracker key={res.id} reservation={res} hospital={hospital} />
      ))}
      {r.status === "open" && live.length === 0 && lastClosed ? (
        <div role="alert" className="flex items-start gap-3 rounded-(--radius-panel) border border-critical/30 bg-critical-soft p-4">
          <CircleSlash className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden />
          <p className="text-sm text-ink">
            <span className="font-semibold">{lastClosed.bankName}: {closedReason(lastClosed)}.</span> No other bank could be reserved automatically. Pick
            another bank below{canAlert ? " or raise a critical alert" : ""}.
          </p>
        </div>
      ) : null}
      {r.status === "open" && search ? (
        <ResultsPanel
          hospital={hospital}
          search={search}
          title={live.length > 0 ? `Cover the remaining ${plural(remaining, "unit")}` : "Choose a blood bank"}
          reservingSiteId={reservingSiteId}
          onReserve={(option) => onReserve(r, option)}
          onCritical={canAlert ? () => onCritical(r.id) : undefined}
          criticalPending={criticalPending}
        />
      ) : null}
      <RerouteHistory request={r} />
    </div>
  );
}

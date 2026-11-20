import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateRequestInput, RequestDTO } from "../../../shared/api";
import { POLICY } from "../../../shared/domain";
import { ApiError, api, errorMessage } from "../../lib/api";
import { plural } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { actAs } from "./useHospitalView";

/** The id of the already-open request a 409 `duplicate_request` points at. */
function duplicateRequestId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== "duplicate_request") return null;
  const details = error.details;
  if (typeof details === "object" && details !== null && "requestId" in details && typeof details.requestId === "string") {
    return details.requestId;
  }
  return null;
}

interface Handlers {
  /** Open a request in the tracker. */
  openRequest: (requestId: string) => void;
}

/** Shared write-side behaviour for the hospital desk: cache priming, error toasts and conflict recovery. */
export function useHospitalMutations(hospitalId: string, { openRequest }: Handlers) {
  const queryClient = useQueryClient();

  const prime = (request: RequestDTO) => {
    queryClient.setQueryData(queryKeys.request(request.id), request);
    void queryClient.invalidateQueries({ queryKey: queryKeys.requests(hospitalId) });
  };

  const onWriteError = (error: unknown) => {
    const existing = duplicateRequestId(error);
    if (existing) {
      toast.warning("This ward already has the same request open", {
        description: "Open it to track or re-reserve instead of creating a duplicate.",
        action: { label: "Open request", onClick: () => openRequest(existing) },
      });
      return;
    }
    if (error instanceof ApiError && error.code === "conflicting_reservation") {
      toast.warning("Those units were just taken", { description: "Another hospital reserved them first. Results refreshed with live stock." });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
      return;
    }
    toast.error("Couldn't complete that", { description: errorMessage(error) });
    void queryClient.invalidateQueries({ queryKey: ["search"] });
  };

  /** New request + reservation in one tap. */
  const createAndReserve = useMutation({
    mutationFn: async ({ input, bankSiteId }: { input: CreateRequestInput; bankSiteId: string }) => {
      actAs(hospitalId);
      const created = await api.requests.create(input);
      prime(created);
      return api.requests.reserve(created.id, { bankSiteId });
    },
    onSuccess: (request) => {
      prime(request);
      openRequest(request.id);
    },
    onError: onWriteError,
  });

  /** Reserve (more) units for an existing request, e.g. after a decline with no automatic reroute. */
  const reserve = useMutation({
    mutationFn: ({ requestId, bankSiteId }: { requestId: string; bankSiteId: string }) => {
      actAs(hospitalId);
      return api.requests.reserve(requestId, { bankSiteId });
    },
    onSuccess: prime,
    onError: onWriteError,
  });

  /** Alert every bank and eligible nearby donors. Creates the request first when there is none yet. */
  const critical = useMutation({
    mutationFn: async (target: { requestId: string } | { input: CreateRequestInput }) => {
      actAs(hospitalId);
      let requestId: string;
      if ("requestId" in target) {
        requestId = target.requestId;
      } else {
        const created = await api.requests.create(target.input);
        prime(created);
        openRequest(created.id);
        requestId = created.id;
      }
      const result = await api.requests.critical(requestId);
      return { requestId, sent: result.sent };
    },
    onSuccess: ({ requestId, sent }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
      toast.success(`Critical alert sent · ${plural(sent, "donor")} alerted`, {
        description: "Every blood bank in the city has been notified.",
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) {
        toast.warning("Critical alert limit reached", {
          description: `Each hospital can raise ${POLICY.criticalAlertsPerHour} critical alerts per hour, so donors aren't flooded. Phone the nearest blood bank directly.`,
        });
        return;
      }
      onWriteError(error);
    },
  });

  return { createAndReserve, reserve, critical };
}

/** Phone check, pickup and delivery for one reservation. */
export function useTrackerActions(hospitalId: string, requestId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.requests(hospitalId) });
  };
  const onError = (error: unknown) => toast.error("Couldn't update the reservation", { description: errorMessage(error) });

  const advance = useMutation({
    mutationFn: ({ reservationId, to }: { reservationId: string; to: "picked_up" | "delivered" }) => {
      actAs(hospitalId);
      return api.reservations.advance(reservationId, { to });
    },
    onSuccess: (request) => {
      queryClient.setQueryData(queryKeys.request(request.id), request);
      refresh();
    },
    onError,
  });

  const phoneConfirm = useMutation({
    mutationFn: (reservationId: string) => {
      actAs(hospitalId);
      return api.reservations.phoneConfirm(reservationId);
    },
    onSuccess: () => {
      toast.success("Stock confirmed by phone");
      refresh();
    },
    onError,
  });

  return { advance, phoneConfirm };
}

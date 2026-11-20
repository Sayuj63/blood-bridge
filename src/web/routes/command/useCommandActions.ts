import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApproveTransferInput, DismissTransferInput, StartSurgeInput } from "../../../shared/api";
import { api, errorMessage } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";

/** Command mutations. Each refetches forecast and transfers immediately; realtime refreshes other views. */
export function useCommandActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.forecast() });
    void qc.invalidateQueries({ queryKey: ["transfers"] });
  };
  const onError = (action: string) => (e: unknown) => toast.error(`${action} failed`, { description: errorMessage(e) });

  const startSurge = useMutation({
    mutationFn: (input: StartSurgeInput) => api.surge.start(input),
    onSuccess: (s) => {
      toast.warning(`Surge started: ${s.label} near ${s.areaName}`);
      refresh();
    },
    onError: onError("Starting the surge"),
  });

  const endSurge = useMutation({
    mutationFn: () => api.surge.end(),
    onSuccess: () => {
      toast.success("Surge ended");
      refresh();
    },
    onError: onError("Ending the surge"),
  });

  const approve = useMutation({
    mutationFn: (input: ApproveTransferInput) => api.transfers.approve(input),
    onSuccess: (t) => {
      toast.success(`Transfer approved: ${t.quantity} × ${t.bloodGroup} to ${t.toName}`);
      refresh();
    },
    onError: onError("Approving the transfer"),
  });

  const dismiss = useMutation({
    mutationFn: (input: DismissTransferInput) => api.transfers.dismiss(input),
    onSuccess: refresh,
    onError: onError("Dismissing the suggestion"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => api.transfers.complete(id),
    onSuccess: (t) => {
      toast.success(`Delivered to ${t.toName}`);
      refresh();
    },
    onError: onError("Marking the transfer delivered"),
  });

  return { startSurge, endSurge, approve, dismiss, complete };
}

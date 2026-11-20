/**
 * Donor-view data hooks. Queries refresh live: realtime events invalidate the
 * ["donors"] and ["alerts"] families, so these refetch without polling.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AlertResponseInput, DonorAlertDTO, DonorDTO, DonorPreferencesInput } from "../../../shared/api";
import { ApiError, api, errorMessage, setActor, type DonorSignupBody } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";

/**
 * Stamp the audit actor right before each write. The app shell resets the
 * actor to plain "donor" in its own mount effect (which runs after ours), so
 * setting it once on mount is not enough.
 */
const asDonor = (donorId: string): void => setActor(`donor:${donorId}`);

export const usePersonas = () =>
  useQuery({ queryKey: queryKeys.personas(), queryFn: ({ signal }) => api.donors.personas(signal), staleTime: 30_000 });

export const useDonor = (donorId: string) =>
  useQuery({ queryKey: queryKeys.donor(donorId), queryFn: ({ signal }) => api.donors.get(donorId, signal) });

export const useDonorAlerts = (donorId: string) =>
  useQuery({
    queryKey: queryKeys.donorAlerts(donorId),
    queryFn: ({ signal }) => api.donors.alerts(donorId, signal),
    // Safety net for a dropped socket; realtime normally refreshes this instantly.
    refetchInterval: 30_000,
  });

/** The demo default: the first eligible O− persona who hasn't opted out. */
export function defaultPersona(personas: DonorDTO[]): DonorDTO | undefined {
  return personas.find((p) => p.bloodGroup === "O-" && p.eligible && p.optedOutAt === null) ?? personas[0];
}

/** Consent and preference changes apply instantly, then reconcile with the server. */
export function useUpdatePreferences(donorId: string) {
  const qc = useQueryClient();
  const key = queryKeys.donor(donorId);
  return useMutation({
    mutationFn: (input: DonorPreferencesInput) => {
      asDonor(donorId);
      return api.donors.update(donorId, input);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DonorDTO>(key);
      if (previous) qc.setQueryData<DonorDTO>(key, { ...previous, ...input });
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error(`Couldn't save that change. ${errorMessage(error)}`);
    },
    onSuccess: (donor) => qc.setQueryData(key, donor),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.personas() }),
  });
}

export function useOptOut(donorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optOut: boolean) => {
      asDonor(donorId);
      return api.donors.optOut(donorId, optOut);
    },
    onSuccess: (donor) => {
      qc.setQueryData(queryKeys.donor(donorId), donor);
      void qc.invalidateQueries({ queryKey: queryKeys.donorAlerts(donorId) });
      void qc.invalidateQueries({ queryKey: queryKeys.personas() });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

const replaceAlert = (alerts: DonorAlertDTO[] | undefined, next: DonorAlertDTO) =>
  alerts?.map((a) => (a.id === next.id ? next : a));

export function useRespond(donorId: string) {
  const qc = useQueryClient();
  const key = queryKeys.donorAlerts(donorId);
  return useMutation({
    mutationFn: ({ alertId, response }: { alertId: string } & AlertResponseInput) => {
      asDonor(donorId);
      return api.alerts.respond(alertId, { response });
    },
    onSuccess: (alert) => qc.setQueryData<DonorAlertDTO[]>(key, (alerts) => replaceAlert(alerts, alert)),
    onError: (error, { alertId }) => {
      // Someone else filled the last spot first: show the warm thank-you, not an error.
      if (error instanceof ApiError && error.code === "already_fulfilled") {
        qc.setQueryData<DonorAlertDTO[]>(key, (alerts) =>
          alerts?.map((a) => (a.id === alertId ? { ...a, status: "fulfilled" } : a)),
        );
        return;
      }
      toast.error(errorMessage(error));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DonorSignupBody) => api.donors.signup(input),
    onSuccess: (donor) => {
      qc.setQueryData(queryKeys.donor(donor.id), donor);
      void qc.invalidateQueries({ queryKey: queryKeys.personas() });
    },
  });
}

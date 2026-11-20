import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, errorMessage, setActor } from "../../../lib/api";
import { useBankSite } from "./useBankSite";

/** Query families every bank action can touch. Realtime also invalidates these; doing it here keeps the acting tab instant. */
const BANK_ROOTS = ["queue", "stock", "sites", "transfers", "forecast", "audit", "incoming-donors", "requests"] as const;

export interface ActionOptions<TVars, TResult> {
  run: (vars: TVars) => Promise<TResult>;
  /** Toast on success; return null to stay quiet. */
  success?: (result: TResult, vars: TVars) => string | null;
  onDone?: (result: TResult) => void;
}

/** True for 409s: someone else changed the record first (reservation conflict, unit already moved). */
export const isConflict = (error: unknown): boolean => error instanceof ApiError && error.status === 409;

/**
 * Mutation with the bank view's conventions: success toast, error toast that
 * names conflicts plainly, and a refetch of everything the action could affect.
 */
export function useAction<TVars, TResult>({ run, success, onDone }: ActionOptions<TVars, TResult>) {
  const queryClient = useQueryClient();
  const { actor } = useBankSite();
  return useMutation({
    // The shell sets a generic actor after child effects run, so pin ours on every write.
    mutationFn: (vars: TVars) => {
      setActor(actor);
      return run(vars);
    },
    onSuccess: (result, vars) => {
      const message = success?.(result, vars);
      if (message) toast.success(message);
      onDone?.(result);
    },
    onError: (error) => {
      if (isConflict(error)) toast.error("Someone got there first", { description: errorMessage(error) });
      else toast.error(errorMessage(error));
    },
    onSettled: () => {
      BANK_ROOTS.forEach((root) => void queryClient.invalidateQueries({ queryKey: [root] }));
    },
  });
}

/** Shared React Query hooks for city-wide data that several views read. */
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { queryKeys } from "./queryKeys";

/** City metadata: areas, policy, eligibility rules. Rarely changes. */
export const useMeta = () =>
  useQuery({ queryKey: queryKeys.meta(), queryFn: ({ signal }) => api.meta(signal), staleTime: 10 * 60_000 });

/** All sites with available units by group, for map markers. */
export const useSites = () =>
  useQuery({ queryKey: queryKeys.sites(), queryFn: ({ signal }) => api.sites.list(signal), staleTime: 30_000 });

/** City forecast, including the active surge (if any). Refetched on realtime events. */
export const useForecast = () =>
  useQuery({ queryKey: queryKeys.forecast(), queryFn: ({ signal }) => api.forecast(signal), staleTime: 15_000 });

/** Transfer suggestions and active transfers, city-wide or for one site. */
export const useTransferBoard = (siteId?: string) =>
  useQuery({
    queryKey: queryKeys.transfers(siteId),
    queryFn: ({ signal }) => api.transfers.board(siteId, signal),
    staleTime: 15_000,
  });

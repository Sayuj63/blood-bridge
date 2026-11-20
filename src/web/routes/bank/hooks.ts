/** React Query reads for the blood bank view. Realtime events invalidate these by key root. */
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";

export const AUDIT_FEED_LIMIT = 25;

export const useSiteStock = (siteId: string) =>
  useQuery({ queryKey: queryKeys.stock(siteId), queryFn: ({ signal }) => api.sites.stock(siteId, signal) });

/** Polled as a safety net: the confirm window is only 90 seconds, so the queue must never sit stale. */
export const useQueue = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.queue(siteId),
    queryFn: ({ signal }) => api.sites.queue(siteId, signal),
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

export const useIncomingDonors = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.incomingDonors(siteId),
    queryFn: ({ signal }) => api.sites.incomingDonors(siteId, signal),
  });

export const useSiteAudit = (siteId: string) => {
  const query = { siteId, limit: AUDIT_FEED_LIMIT };
  return useQuery({ queryKey: queryKeys.audit(query), queryFn: ({ signal }) => api.audit.list(query, signal) });
};

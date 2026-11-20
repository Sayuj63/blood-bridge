/**
 * React Query keys. The first segment of each key is its invalidation root, so
 * realtime topics can invalidate a whole family with one prefix
 * (e.g. every ["stock", siteId] via ["stock"]).
 */
import type { Topic } from "../../shared/events";
import type { BloodGroup } from "../../shared/domain";
import type { AuditQuery } from "./api";

export const queryKeys = {
  meta: () => ["meta"] as const,
  sites: () => ["sites"] as const,
  stock: (siteId: string) => ["stock", siteId] as const,
  queue: (siteId: string) => ["queue", siteId] as const,
  incomingDonors: (siteId: string) => ["incoming-donors", siteId] as const,
  requests: (hospitalId: string) => ["requests", "list", hospitalId] as const,
  request: (requestId: string) => ["requests", "detail", requestId] as const,
  search: (params: unknown) => ["search", params] as const,
  forecast: () => ["forecast"] as const,
  transfers: (siteId?: string) => ["transfers", siteId ?? "city"] as const,
  surgeBrief: (surgeId: string) => ["surge-brief", surgeId] as const,
  personas: () => ["donors", "personas"] as const,
  donor: (donorId: string) => ["donors", "detail", donorId] as const,
  donorAlerts: (donorId: string) => ["alerts", donorId] as const,
  drivePreview: (bankSiteId: string, bloodGroup: BloodGroup) => ["drive-preview", bankSiteId, bloodGroup] as const,
  audit: (query: AuditQuery = {}) => ["audit", "list", query] as const,
  auditVerify: () => ["audit", "verify"] as const,
} as const;

type Root = readonly [string];

/** Which query families each realtime topic makes stale. */
export const TOPIC_INVALIDATES: Record<Topic, readonly Root[]> = {
  sites: [["sites"]],
  stock: [["sites"], ["stock"], ["search"], ["forecast"], ["transfers"]],
  requests: [["requests"], ["queue"]],
  reservations: [["requests"], ["queue"], ["stock"], ["sites"]],
  transfers: [["transfers"], ["forecast"], ["stock"]],
  donors: [["donors"], ["drive-preview"]],
  alerts: [["alerts"], ["incoming-donors"], ["donors"]],
  surge: [["forecast"], ["transfers"], ["surge-brief"]],
  audit: [["audit"]],
  messaging: [["messaging"]],
};

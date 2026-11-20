/**
 * HTTP API contract: Zod schemas for every request body, and DTO types for
 * every response. The Worker validates with these schemas; the web client
 * imports the same types, so the two sides cannot drift.
 * All timestamps are epoch milliseconds.
 */
import { z } from "zod";
import {
  BLOOD_GROUPS,
  COMPONENTS,
  CONTACT_CHANNELS,
  LANGUAGES,
  MESSAGE_CHANNELS,
  SURGE_KINDS,
  URGENCIES,
  type AlertStatus,
  type BloodGroup,
  type Component,
  type ContactChannel,
  type Language,
  type MessageChannel,
  type RequestStatus,
  type ReservationStatus,
  type SiteKind,
  type SurgeKind,
  type TransferStatus,
  type UnitStatus,
  type Urgency,
} from "./domain";
import type { GroupOutlook, OutcomeSummary } from "./forecast";
import type { RankedOption } from "./ranking";
import type { SkipReason } from "./eligibility";
import type { TransferProposal } from "./transfers";

const bloodGroup = z.enum(BLOOD_GROUPS);
const component = z.enum(COMPONENTS);
const id = z.string().min(1).max(64);

/* ───────────────────────────── Request bodies ───────────────────────────── */

export const searchSchema = z.object({
  hospitalId: id,
  bloodGroup,
  component,
  unitsNeeded: z.number().int().min(1).max(20),
  urgency: z.enum(URGENCIES),
  neededBy: z.number().int().positive(),
});
export type SearchInput = z.infer<typeof searchSchema>;

export const createRequestSchema = searchSchema.extend({
  ward: z.string().trim().min(1).max(60),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const reserveSchema = z.object({ bankSiteId: id });
export type ReserveInput = z.infer<typeof reserveSchema>;

export const confirmSchema = z.object({
  /** Omit to confirm the full allocation; a smaller number is a partial confirm. */
  units: z.number().int().min(1).max(20).optional(),
});
export type ConfirmInput = z.infer<typeof confirmSchema>;

export const declineSchema = z.object({ reason: z.string().trim().min(2).max(200) });
export type DeclineInput = z.infer<typeof declineSchema>;

export const advanceSchema = z.object({ to: z.enum(["picked_up", "delivered"]) });
export type AdvanceInput = z.infer<typeof advanceSchema>;

export const addUnitsSchema = z.object({
  bloodGroup,
  component,
  count: z.number().int().min(1).max(50),
  /** Days until expiry; defaults to the component's demo shelf life. */
  expiresInDays: z.number().min(0.1).max(400).optional(),
});
export type AddUnitsInput = z.infer<typeof addUnitsSchema>;

export const unitActionSchema = z.object({ action: z.enum(["use", "remove", "discard"]) });
export type UnitActionInput = z.infer<typeof unitActionSchema>;

export const offerUnitsSchema = z.object({ unitIds: z.array(id).min(1).max(50) });
export type OfferUnitsInput = z.infer<typeof offerUnitsSchema>;

export const approveTransferSchema = z.object({
  fromSiteId: id,
  toSiteId: id,
  bloodGroup,
  component,
  /** Operators may modify the suggested quantity. */
  quantity: z.number().int().min(1).max(50),
});
export type ApproveTransferInput = z.infer<typeof approveTransferSchema>;

export const dismissTransferSchema = z.object({ fromSiteId: id, toSiteId: id, bloodGroup, component });
export type DismissTransferInput = z.infer<typeof dismissTransferSchema>;

export const startSurgeSchema = z.object({
  kind: z.enum(SURGE_KINDS),
  /** Named area preset (see /api/meta areas); defaults to the scenario's preset. */
  areaId: z.string().max(40).optional(),
});
export type StartSurgeInput = z.infer<typeof startSurgeSchema>;

export const donorSignupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, "Enter a valid phone number"),
  bloodGroup,
  areaId: z.string().max(40),
  language: z.enum(LANGUAGES).default("en"),
  consentAlerts: z.boolean(),
  consentLocation: z.boolean(),
  consentEligibility: z.boolean(),
  lastDonationAt: z.number().int().positive().nullable().default(null),
  /** Optional off-app alerts. Anything but `none` needs a phone number and an explicit consent tick. */
  contactChannel: z.enum(CONTACT_CHANNELS).default("none"),
  contactPhone: z.string().trim().max(24).optional(),
  contactConsent: z.boolean().default(false),
}).superRefine((v, ctx) => {
  if (v.contactChannel === "none") return;
  if (!v.contactPhone) ctx.addIssue({ code: "custom", path: ["contactPhone"], message: "Enter the number to alert" });
  if (!v.contactConsent) ctx.addIssue({ code: "custom", path: ["contactConsent"], message: "Tick the consent box to get alerts on this number" });
});
export type DonorSignupInput = z.infer<typeof donorSignupSchema>;

export const donorPreferencesSchema = z
  .object({
    consentAlerts: z.boolean(),
    consentLocation: z.boolean(),
    consentEligibility: z.boolean(),
    language: z.enum(LANGUAGES),
    quietHoursStart: z.number().int().min(0).max(23).nullable(),
    quietHoursEnd: z.number().int().min(0).max(23).nullable(),
    maxAlertsPerWeek: z.number().int().min(1).max(7),
  })
  .partial();
export type DonorPreferencesInput = z.infer<typeof donorPreferencesSchema>;

export const donorDriveSchema = z.object({
  bankSiteId: id,
  bloodGroup,
  component: component.default("whole_blood"),
  urgency: z.enum(URGENCIES).default("urgent"),
  /** Once this many donors accept, remaining alerts close with a thank-you. */
  donorsNeeded: z.number().int().min(1).max(20).default(3),
});
export type DonorDriveInput = z.infer<typeof donorDriveSchema>;

export const alertResponseSchema = z.object({ response: z.enum(["accept", "decline"]) });
export type AlertResponseInput = z.infer<typeof alertResponseSchema>;

/* ── Messaging gateway (Bearer GATEWAY_TOKEN) ── */

const messageChannel = z.enum(MESSAGE_CHANNELS);
const gatewayId = z.string().trim().min(1).max(64).regex(/^[\w.:-]+$/, "Use letters, digits, . : _ -");

export const gatewayClaimSchema = z.object({
  gatewayId,
  /** Only channels this gateway can deliver on right now. */
  channels: z.array(messageChannel).min(1).max(2),
  limit: z.number().int().min(1).max(20).default(10),
});
export type GatewayClaimInput = z.infer<typeof gatewayClaimSchema>;

export const gatewayAckSchema = z.object({
  leaseToken: z.string().min(8).max(64),
  status: z.enum(["sent", "failed"]),
  error: z.string().max(500).optional(),
  /** False for permanent failures (e.g. number not on WhatsApp): skip retries. */
  retryable: z.boolean().default(true),
  providerMessageId: z.string().max(200).optional(),
});
export type GatewayAckInput = z.infer<typeof gatewayAckSchema>;

export const gatewayInboundSchema = z.object({
  channel: messageChannel,
  /** E.164 number (or a WhatsApp group id ending @g.us). */
  from: z.string().trim().min(3).max(64),
  text: z.string().max(2000),
  messageId: z.string().trim().min(1).max(200),
  at: z.number().int().positive(),
});
export type GatewayInboundInput = z.infer<typeof gatewayInboundSchema>;

export const GATEWAY_CHANNEL_STATES = ["starting", "needs_qr", "online", "offline"] as const;
export type GatewayChannelState = (typeof GATEWAY_CHANNEL_STATES)[number];

export const gatewayHeartbeatSchema = z.object({
  gatewayId,
  version: z.string().max(32).optional(),
  channels: z
    .array(
      z.object({
        channel: messageChannel,
        adapter: z.string().trim().min(1).max(40),
        state: z.enum(GATEWAY_CHANNEL_STATES),
        detail: z.string().max(200).optional(),
      }),
    )
    .max(4),
});
export type GatewayHeartbeatInput = z.infer<typeof gatewayHeartbeatSchema>;

/* ───────────────────────────── Response DTOs ───────────────────────────── */

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface SiteDTO {
  id: string;
  kind: SiteKind;
  name: string;
  shortName: string;
  areaId: string;
  areaName: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  lastSyncAt: number;
  freshnessMinutes: number;
  stale: boolean;
  verified: boolean;
  /** Available units by group, all components — for map markers. */
  availableByGroup: Partial<Record<BloodGroup, number>>;
  totalAvailable: number;
}

export interface UnitDTO {
  id: string;
  siteId: string;
  bloodGroup: BloodGroup;
  component: Component;
  collectedAt: number;
  expiresAt: number;
  status: UnitStatus;
  reservationId: string | null;
  offered: boolean;
  updatedAt: number;
}

export type StockLevel = "critical" | "low" | "ok" | "surplus";

export interface StockCell {
  bloodGroup: BloodGroup;
  component: Component;
  onHand: number;
  reserved: number;
  expiring48h: number;
  expiring7d: number;
  /** Days of cover at baseline demand. */
  daysOfCover: number | null;
  level: StockLevel;
}

export interface SiteStockDTO {
  site: SiteDTO;
  cells: StockCell[];
  units: UnitDTO[];
  totals: { onHand: number; reserved: number; expiring48h: number; expiring7d: number };
}

export interface SearchResultDTO {
  options: RankedOption[];
  /** Populated when nothing matches: compatible alternatives and transfer hints. */
  noMatch: null | { nearestAnyStockSiteIds: string[]; hint: string };
  searchedAt: number;
}

export interface TimelineStep {
  step: "requested" | "confirmed" | "reserved" | "picked_up" | "delivered";
  at: number | null;
}

export interface ReservationDTO {
  id: string;
  requestId: string;
  bankSiteId: string;
  bankName: string;
  status: ReservationStatus;
  unitsCount: number;
  units: Pick<UnitDTO, "id" | "bloodGroup" | "component" | "expiresAt">[];
  matchType: RankedOption["matchType"];
  needsClinicianConfirmation: boolean;
  requiresPhoneConfirm: boolean;
  phoneConfirmedAt: number | null;
  declineReason: string | null;
  etaMinutes: number;
  /** Bank must confirm before this, else the next-best option is offered. */
  confirmBy: number;
  /** Reserved units return to stock after this if not collected. */
  holdExpiresAt: number | null;
  timeline: TimelineStep[];
  createdAt: number;
  updatedAt: number;
}

export interface RequestDTO {
  id: string;
  hospitalId: string;
  hospitalName: string;
  bloodGroup: BloodGroup;
  component: Component;
  unitsNeeded: number;
  urgency: Urgency;
  neededBy: number;
  ward: string;
  status: RequestStatus;
  criticalBroadcastAt: number | null;
  createdAt: number;
  reservations: ReservationDTO[];
  /** The live reservation, if any (most recent not declined/expired/released). */
  active: ReservationDTO | null;
}

export interface QueueItemDTO {
  reservation: ReservationDTO;
  request: Omit<RequestDTO, "reservations" | "active">;
  hospital: Pick<SiteDTO, "id" | "name" | "lat" | "lng">;
}

export interface TransferDTO {
  id: string;
  fromSiteId: string;
  toSiteId: string;
  fromName: string;
  toName: string;
  bloodGroup: BloodGroup;
  component: Component;
  quantity: number;
  status: TransferStatus;
  rescuedFromExpiry: number;
  reason: string;
  etaMinutes: number;
  createdAt: number;
  decidedAt: number | null;
  completedAt: number | null;
}

export interface TransferSuggestionDTO extends TransferProposal {
  key: string;
  fromName: string;
  toName: string;
}

export interface TransferBoardDTO {
  suggestions: TransferSuggestionDTO[];
  active: TransferDTO[];
  before: OutcomeSummary;
  after: OutcomeSummary;
}

export interface SurgeDTO {
  id: string;
  kind: SurgeKind;
  label: string;
  areaId: string;
  areaName: string;
  epicenter: { lat: number; lng: number };
  radiusKm: number;
  multipliers: Record<string, number>;
  startedAt: number;
}

export interface SiteRiskDTO {
  siteId: string;
  name: string;
  /** Earliest stockout across this site's cells, hours. */
  earliestStockoutHours: number | null;
  worst: { bloodGroup: BloodGroup; component: Component } | null;
  expectedWaste: number;
  surgeInfluence: number;
}

export interface ForecastDTO {
  generatedAt: number;
  horizonHours: number;
  surge: SurgeDTO | null;
  outlook: GroupOutlook[];
  sites: SiteRiskDTO[];
  /** Outcome with approved transfers only vs. with all suggestions applied. */
  current: OutcomeSummary;
  withPlan: OutcomeSummary;
  /** Baseline (no surge) for comparison. */
  baseline: OutcomeSummary;
}

export interface SurgeBriefDTO {
  text: string;
  source: "workers-ai" | "template";
  generatedAt: number;
}

export interface DonorDTO {
  id: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  areaId: string;
  areaName: string;
  language: Language;
  consentAlerts: boolean;
  consentLocation: boolean;
  consentEligibility: boolean;
  optedOutAt: number | null;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  maxAlertsPerWeek: number;
  lastDonationAt: number | null;
  eligible: boolean;
  eligibleFrom: number | null;
  donations: { at: number; siteName: string }[];
  impact: { unitsDonated: number; requestsSupported: number };
  /** Off-app alerts: `none` unless the donor opted in to WhatsApp or SMS. */
  contactChannel: ContactChannel;
  contactOptedIn: boolean;
}

export interface DonorAlertDTO {
  id: string;
  donorId: string;
  bankSiteId: string;
  bankName: string;
  bloodGroup: BloodGroup;
  component: Component;
  urgency: Urgency;
  status: AlertStatus;
  distanceKm: number;
  message: string;
  messageLocalized: string | null;
  language: Language;
  /** Revealed only after the donor taps "I can come". */
  bankAddress: string | null;
  arrivalWindow: string | null;
  confirmationCode: string | null;
  createdAt: number;
  respondedAt: number | null;
}

/** What the bank sees about a responding donor — contact only after the donor said yes. */
export interface IncomingDonorDTO {
  alertId: string;
  donorName: string;
  donorPhone: string;
  bloodGroup: BloodGroup;
  confirmationCode: string;
  arrivalWindow: string;
  status: Extract<AlertStatus, "accepted" | "arrived">;
  respondedAt: number;
}

export interface DonorDrivePreviewDTO {
  bloodGroup: BloodGroup;
  eligibleCount: number;
  skipped: Record<SkipReason, number>;
  totalDonors: number;
}

export interface DonorDriveResultDTO {
  sent: number;
  alertIds: string[];
}

export interface AuditEntryDTO {
  seq: number;
  at: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  siteId: string | null;
  summary: string;
  prevHash: string;
  hash: string;
}

export interface AuditVerifyDTO {
  ok: boolean;
  checked: number;
  /** First sequence number where the chain breaks. */
  brokenAt: number | null;
  headHash: string | null;
}

export interface AreaDTO {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MetaDTO {
  city: string;
  policy: Record<string, number>;
  areas: AreaDTO[];
  /** Real documented flood spots where a simulated surge can be centred. */
  surgeZones: AreaDTO[];
  /** When the real e-RaktKosh stock snapshot behind the demo was taken. */
  stockSnapshotAt: number;
  eligibilityRules: { minDaysBetweenDonations: number };
  simulated: true;
}


/* ── Messaging ── */

/** One outbox row handed to the gateway by a claim. */
export interface OutboxMessageDTO {
  id: string;
  channel: MessageChannel;
  to: string;
  body: string;
  leaseToken: string;
  attempt: number;
}

export interface GatewayClaimDTO {
  messages: OutboxMessageDTO[];
  leaseMs: number;
}

export interface GatewayInboundDTO {
  ok: true;
  duplicate: boolean;
  intent: string;
  /** Replies are queued in the outbox; the gateway should claim straight away. */
  queued: number;
}

export interface MessagingChannelStatusDTO {
  channel: MessageChannel;
  online: boolean;
  state: GatewayChannelState;
  adapter: string | null;
  lastSeenAt: number | null;
}

/** Public: drives the "WhatsApp online" indicator. No addresses, no bodies. */
export interface MessagingStatusDTO {
  gatewayLastSeenAt: number | null;
  channels: MessagingChannelStatusDTO[];
  queue: { pending: number; claimed: number; sent24h: number; failed24h: number };
  checkedAt: number;
}

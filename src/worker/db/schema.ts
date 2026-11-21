import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type {
  AlertStatus,
  BloodGroup,
  Component,
  ContactChannel,
  Language,
  MessageChannel,
  OutboxStatus,
  RequestStatus,
  ReservationStatus,
  SiteKind,
  SurgeKind,
  TransferStatus,
  UnitStatus,
  Urgency,
} from "../../shared/domain";

/** Timestamps are stored as epoch milliseconds (integer) for cheap arithmetic. */

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<SiteKind>().notNull(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  areaId: text("area_id").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  verified: integer("verified", { mode: "boolean" }).notNull().default(true),
  lastSyncAt: integer("last_sync_at").notNull(),
});

export const units = sqliteTable(
  "units",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    bloodGroup: text("blood_group").$type<BloodGroup>().notNull(),
    component: text("component").$type<Component>().notNull(),
    collectedAt: integer("collected_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    status: text("status").$type<UnitStatus>().notNull().default("available"),
    reservationId: text("reservation_id"),
    transferId: text("transfer_id"),
    /** Set when a site offers the unit for transfer (e.g. a hospital with expiring stock). */
    offeredAt: integer("offered_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("units_site_status_idx").on(t.siteId, t.status),
    index("units_match_idx").on(t.component, t.bloodGroup, t.status),
    index("units_reservation_idx").on(t.reservationId),
    // The minute sweep ("available and past expiry") and every "in-date stock" read filter on these.
    index("units_status_expiry_idx").on(t.status, t.expiresAt),
    // A bank's shelf, soonest-expiring first (stock view, reconcile) without scanning other banks.
    index("units_site_status_expiry_idx").on(t.siteId, t.status, t.expiresAt),
  ],
);

/** Baseline demand (units/day) per site, group and component — feeds the rule-based forecast. */
export const demandBaseline = sqliteTable(
  "demand_baseline",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    bloodGroup: text("blood_group").$type<BloodGroup>().notNull(),
    component: text("component").$type<Component>().notNull(),
    unitsPerDay: real("units_per_day").notNull(),
  },
  (t) => [uniqueIndex("demand_pk").on(t.siteId, t.bloodGroup, t.component)],
);

export const requests = sqliteTable(
  "requests",
  {
    id: text("id").primaryKey(),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => sites.id),
    bloodGroup: text("blood_group").$type<BloodGroup>().notNull(),
    component: text("component").$type<Component>().notNull(),
    unitsNeeded: integer("units_needed").notNull(),
    urgency: text("urgency").$type<Urgency>().notNull(),
    neededBy: integer("needed_by").notNull(),
    ward: text("ward").notNull(),
    status: text("status").$type<RequestStatus>().notNull().default("open"),
    criticalBroadcastAt: integer("critical_broadcast_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("requests_hospital_idx").on(t.hospitalId, t.createdAt)],
);

export const reservations = sqliteTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id),
    bankSiteId: text("bank_site_id")
      .notNull()
      .references(() => sites.id),
    status: text("status").$type<ReservationStatus>().notNull(),
    unitsCount: integer("units_count").notNull(),
    matchType: text("match_type").$type<"exact" | "compatible" | "mixed">().notNull(),
    requiresPhoneConfirm: integer("requires_phone_confirm", { mode: "boolean" }).notNull().default(false),
    phoneConfirmedAt: integer("phone_confirmed_at"),
    declineReason: text("decline_reason"),
    etaMinutes: integer("eta_minutes").notNull(),
    confirmBy: integer("confirm_by").notNull(),
    holdExpiresAt: integer("hold_expires_at"),
    requestedAt: integer("requested_at").notNull(),
    confirmedAt: integer("confirmed_at"),
    reservedAt: integer("reserved_at"),
    pickedUpAt: integer("picked_up_at"),
    deliveredAt: integer("delivered_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("reservations_request_idx").on(t.requestId),
    index("reservations_bank_status_idx").on(t.bankSiteId, t.status),
  ],
);

export const transfers = sqliteTable(
  "transfers",
  {
    id: text("id").primaryKey(),
    /** Stable key of the suggestion this came from: from|to|group|component. */
    suggestionKey: text("suggestion_key").notNull(),
    fromSiteId: text("from_site_id")
      .notNull()
      .references(() => sites.id),
    toSiteId: text("to_site_id")
      .notNull()
      .references(() => sites.id),
    bloodGroup: text("blood_group").$type<BloodGroup>().notNull(),
    component: text("component").$type<Component>().notNull(),
    quantity: integer("quantity").notNull(),
    status: text("status").$type<TransferStatus>().notNull(),
    rescuedFromExpiry: integer("rescued_from_expiry").notNull().default(0),
    reason: text("reason").notNull(),
    etaMinutes: integer("eta_minutes").notNull(),
    createdAt: integer("created_at").notNull(),
    decidedAt: integer("decided_at"),
    completedAt: integer("completed_at"),
  },
  (t) => [index("transfers_status_idx").on(t.status)],
);

export const donors = sqliteTable(
  "donors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    bloodGroup: text("blood_group").$type<BloodGroup>().notNull(),
    areaId: text("area_id").notNull(),
    /** Approximate (~1 km) location only — never exact. */
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    language: text("language").$type<Language>().notNull().default("en"),
    consentAlerts: integer("consent_alerts", { mode: "boolean" }).notNull(),
    consentLocation: integer("consent_location", { mode: "boolean" }).notNull(),
    consentEligibility: integer("consent_eligibility", { mode: "boolean" }).notNull(),
    quietHoursStart: integer("quiet_hours_start"),
    quietHoursEnd: integer("quiet_hours_end"),
    maxAlertsPerWeek: integer("max_alerts_per_week").notNull().default(2),
    lastDonationAt: integer("last_donation_at"),
    optedOutAt: integer("opted_out_at"),
    /** Demo personas show up in the donor view's persona picker. */
    persona: integer("persona", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    /**
     * Off-app contact. A donor is messaged only when the channel is not `none` AND
     * contactOptInAt is set (explicit consent). Seeded synthetic donors stay `none`.
     */
    contactChannel: text("contact_channel").$type<ContactChannel>().notNull().default("none"),
    /** E.164 phone number, e.g. +919820012345. */
    contactAddress: text("contact_address"),
    contactOptInAt: integer("contact_opt_in_at"),
    /**
     * Single-use click-to-chat code from a web signup with WhatsApp ticked. The donor sends
     * "JOIN <code>" from WhatsApp, which opens the 24 h service window and links the sender's
     * number to this profile. Cleared once used. Never returned by public donor reads.
     */
    whatsappJoinCode: text("whatsapp_join_code"),
  },
  (t) => [
    index("donors_group_idx").on(t.bloodGroup),
    index("donors_contact_idx").on(t.contactAddress),
    uniqueIndex("donors_whatsapp_join_code_idx").on(t.whatsappJoinCode),
  ],
);

export const donations = sqliteTable(
  "donations",
  {
    id: text("id").primaryKey(),
    donorId: text("donor_id")
      .notNull()
      .references(() => donors.id),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    alertId: text("alert_id"),
    at: integer("at").notNull(),
  },
  (t) => [index("donations_donor_idx").on(t.donorId)],
);

export const donorAlerts = sqliteTable(
  "donor_alerts",
  {
    id: text("id").primaryKey(),
    donorId: text("donor_id")
      .notNull()
      .references(() => donors.id),
    bankSiteId: text("bank_site_id")
      .notNull()
      .references(() => sites.id),
    /** Alerts sent together share a drive; once enough donors accept, the rest see "already fulfilled". */
    driveId: text("drive_id").notNull(),
    driveNeeded: integer("drive_needed").notNull(),
    requestId: text("request_id"),
    bloodGroup: text("blood_group").$type<BloodGroup>().notNull(),
    component: text("component").$type<Component>().notNull(),
    urgency: text("urgency").$type<Urgency>().notNull(),
    status: text("status").$type<AlertStatus>().notNull(),
    distanceKm: real("distance_km").notNull(),
    message: text("message").notNull(),
    messageLocalized: text("message_localized"),
    language: text("language").$type<Language>().notNull(),
    confirmationCode: text("confirmation_code"),
    arrivalWindow: text("arrival_window"),
    createdAt: integer("created_at").notNull(),
    respondedAt: integer("responded_at"),
  },
  (t) => [
    index("alerts_donor_idx").on(t.donorId, t.createdAt),
    index("alerts_bank_idx").on(t.bankSiteId, t.status),
    index("alerts_drive_idx").on(t.driveId),
  ],
);

export const surgeEvents = sqliteTable("surge_events", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<SurgeKind>().notNull(),
  areaId: text("area_id").notNull(),
  epicenterLat: real("epicenter_lat").notNull(),
  epicenterLng: real("epicenter_lng").notNull(),
  radiusKm: real("radius_km").notNull(),
  multipliers: text("multipliers", { mode: "json" }).$type<Record<string, number>>().notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  brief: text("brief"),
});

/**
 * Tamper-evident activity log. Each row's hash covers the previous row's hash,
 * so editing any historic row breaks every hash after it (PRD §9 Auditability).
 * Appends are serialised through the CityHub Durable Object.
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    seq: integer("seq").primaryKey(),
    at: integer("at").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    siteId: text("site_id"),
    summary: text("summary").notNull(),
    payload: text("payload").notNull(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [index("audit_site_idx").on(t.siteId, t.seq), index("audit_action_idx").on(t.action, t.seq)],
);

/** Rate-limit buckets for anti-abuse (critical alerts per hospital per hour). */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [uniqueIndex("rate_limits_pk").on(t.key, t.windowStart)],
);


/* ───────────────────────────── Messaging (WhatsApp / SMS) ───────────────────────────── */

/**
 * Transactional outbox drained by the off-Worker messaging gateway.
 * pending → claimed (30 s lease, conditional update) → sent | failed; an expired
 * lease returns the row to the claimable pool, so a crashed gateway loses nothing.
 */
export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    channel: text("channel").$type<MessageChannel>().notNull(),
    /** E.164 phone number, or a WhatsApp group id (replies only). */
    to: text("to_address").notNull(),
    body: text("body").notNull(),
    /** alert = donor alert (opt-in required) · reply = answer to an inbound message · notice = consent/welcome/stop confirmations. */
    kind: text("kind").$type<"alert" | "reply" | "notice">().notNull(),
    status: text("status").$type<OutboxStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    alertId: text("alert_id"),
    donorId: text("donor_id"),
    /** Set on an SMS copy created after the WhatsApp original failed. */
    fallbackOf: text("fallback_of"),
    lastError: text("last_error"),
    /** Random token issued with each claim; an ack must present the current one. */
    leaseToken: text("lease_token"),
    claimedAt: integer("claimed_at"),
    claimedBy: text("claimed_by"),
    /** Earliest time the row may be claimed (retry backoff). */
    nextAttemptAt: integer("next_attempt_at").notNull(),
    /** Alerts go stale: never deliver a request for blood hours late. */
    expiresAt: integer("expires_at"),
    providerMessageId: text("provider_message_id"),
    /**
     * WhatsApp Cloud API only: when a business-initiated template went out because the
     * recipient was outside the 24 h window. The row then waits (pending, far nextAttemptAt)
     * and its own text is sent as soon as they reply.
     */
    templateSentAt: integer("template_sent_at"),
    /** Latest provider delivery receipt (Cloud API webhook): sent · delivered · read · failed. */
    deliveryStatus: text("delivery_status").$type<"sent" | "delivered" | "read" | "failed">(),
    sentAt: integer("sent_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("outbox_claim_idx").on(t.status, t.channel, t.nextAttemptAt),
    index("outbox_to_idx").on(t.to, t.createdAt),
    index("outbox_alert_idx").on(t.alertId),
    index("outbox_provider_msg_idx").on(t.providerMessageId),
  ],
);

/** Multi-step chat state per channel address (JOIN signup, follow-up questions, STOP suppression). */
export const conversations = sqliteTable(
  "conversations",
  {
    channel: text("channel").$type<MessageChannel>().notNull(),
    address: text("address").notNull(),
    step: text("step").notNull().default("idle"),
    context: text("context", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    language: text("language").$type<Language>().notNull().default("en"),
    /** Set by STOP: nothing but the STOP confirmation is ever sent to this address again until START. */
    suppressedAt: integer("suppressed_at"),
    lastInboundAt: integer("last_inbound_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("conversations_pk").on(t.channel, t.address)],
);

/** Inbound de-duplication: the gateway may retry a forward; each provider message is handled once. */
export const inboundMessages = sqliteTable(
  "inbound_messages",
  {
    channel: text("channel").$type<MessageChannel>().notNull(),
    messageId: text("message_id").notNull(),
    intent: text("intent").notNull(),
    receivedAt: integer("received_at").notNull(),
  },
  (t) => [uniqueIndex("inbound_messages_pk").on(t.channel, t.messageId)],
);

/** Gateway heartbeats, one row per gateway × channel — powers "WhatsApp online". */
export const gatewayChannels = sqliteTable(
  "gateway_channels",
  {
    gatewayId: text("gateway_id").notNull(),
    channel: text("channel").$type<MessageChannel>().notNull(),
    adapter: text("adapter").notNull(),
    state: text("state").$type<"starting" | "needs_qr" | "online" | "offline">().notNull(),
    detail: text("detail"),
    version: text("version"),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (t) => [uniqueIndex("gateway_channels_pk").on(t.gatewayId, t.channel)],
);

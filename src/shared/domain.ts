/**
 * Core domain vocabulary shared by the Worker, the web app and the tests.
 * Everything here is plain data — no I/O — so it can run anywhere.
 */

export const BLOOD_GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const COMPONENTS = ["whole_blood", "red_cells", "platelets", "plasma"] as const;
export type Component = (typeof COMPONENTS)[number];

export const COMPONENT_LABEL: Record<Component, string> = {
  whole_blood: "Whole blood",
  red_cells: "Packed red cells",
  platelets: "Platelets",
  plasma: "Plasma",
};

export const COMPONENT_SHORT: Record<Component, string> = {
  whole_blood: "WB",
  red_cells: "PRBC",
  platelets: "PLT",
  plasma: "FFP",
};

/**
 * Maximum storage life per the Drugs Rules amendment G.S.R. 166(E), 2020
 * (CPDA-1 whole blood 35 d, additive-solution red cells 42 d, platelets 5 d, FFP 1 yr).
 * Used to model per-unit expiry; not clinical guidance.
 */
export const DEMO_SHELF_LIFE_DAYS: Record<Component, number> = {
  whole_blood: 35,
  red_cells: 42,
  platelets: 5,
  plasma: 365,
};

export const URGENCIES = ["routine", "urgent", "critical"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const SITE_KINDS = ["blood_bank", "hospital"] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const UNIT_STATUSES = ["available", "reserved", "in_transit", "used", "expired", "discarded"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const REQUEST_STATUSES = ["open", "fulfilled", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Reservation lifecycle — mirrors the tracker timeline in the PRD (§6.1). */
export const RESERVATION_STATUSES = [
  "requested",
  "confirmed",
  "reserved",
  "picked_up",
  "delivered",
  "declined",
  "expired",
  "released",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const TRACKER_STEPS = ["requested", "confirmed", "reserved", "picked_up", "delivered"] as const;
export type TrackerStep = (typeof TRACKER_STEPS)[number];

export const TRANSFER_STATUSES = ["suggested", "approved", "dismissed", "completed"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const ALERT_STATUSES = ["sent", "accepted", "declined", "fulfilled", "arrived", "expired"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const SURGE_KINDS = ["flood", "mass_casualty"] as const;
export type SurgeKind = (typeof SURGE_KINDS)[number];

export const LANGUAGES = ["en", "hi", "mr"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_LABEL: Record<Language, string> = { en: "English", hi: "हिन्दी", mr: "मराठी" };

/** Messaging channels the gateway can deliver on. */
export const MESSAGE_CHANNELS = ["whatsapp", "sms"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
/** How a donor asked to be reached outside the app. `none` (the default) means never message them. */
export const CONTACT_CHANNELS = ["none", ...MESSAGE_CHANNELS] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export const OUTBOX_STATUSES = ["pending", "claimed", "sent", "failed"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Tunable thresholds. Kept in one place so judges can see them in the app. */
export const POLICY = {
  /**
   * Stock older than this is "unconfirmed" and the tracker asks for a phone check.
   * Real e-RaktKosh data for Mumbai banks was 4–22 hours old when we snapshotted it.
   */
  staleAfterMinutes: 180,
  /** A blood bank must confirm within this window, else the next-best option is offered. */
  confirmWindowSeconds: 90,
  /** A reserved unit returns to stock if not collected within this window. */
  reservationHoldMinutes: 45,
  /** Units expiring within this window are flagged as "expiring soon". */
  expiringSoonHours: 48,
  /** Forecast horizon for shortage / waste calculations. */
  forecastHorizonHours: 72,
  /** Average urban travel speed used for ETA estimates (km/h). */
  cityTravelSpeedKmh: 22,
  /** Fixed handling overhead added to every ETA (minutes). */
  handlingMinutes: 6,
  /** Critical-alert rate limit per hospital per hour (anti-abuse). */
  criticalAlertsPerHour: 3,
  /** Default donor alert radius (km). */
  donorAlertRadiusKm: 12,
} as const;

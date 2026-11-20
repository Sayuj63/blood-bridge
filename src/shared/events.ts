/**
 * Realtime events pushed from the CityHub Durable Object to every open view.
 * Events carry *what changed*, not full state: clients refetch via the API,
 * so the API stays the single source of truth.
 */

export const TOPICS = [
  "sites",
  "stock",
  "requests",
  "reservations",
  "transfers",
  "donors",
  "alerts",
  "surge",
  "audit",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface RealtimeEvent {
  /** Monotonic per hub instance. */
  seq: number;
  at: number;
  topics: Topic[];
  /** Short human-readable headline for toasts and the live activity ticker. */
  headline?: string;
  tone?: "info" | "success" | "warning" | "critical";
  /** Site IDs this event concerns, so views can decide whether to toast. */
  siteIds?: string[];
  /** Donor IDs this event concerns (alerts reach only these phones). */
  donorIds?: string[];
}

export type ClientMessage = { type: "ping" };
export type ServerMessage = { type: "event"; event: RealtimeEvent } | { type: "hello"; seq: number } | { type: "pong" };

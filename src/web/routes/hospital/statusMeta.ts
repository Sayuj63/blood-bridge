import type { RequestDTO, ReservationDTO } from "../../../shared/api";
import type { ReservationStatus } from "../../../shared/domain";

type ChipTone = "neutral" | "info" | "ok" | "warn" | "critical" | "bridge";

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; tone: ChipTone }> = {
  requested: { label: "Awaiting bank", tone: "warn" },
  confirmed: { label: "Bank confirmed", tone: "info" },
  reserved: { label: "Reserved", tone: "info" },
  picked_up: { label: "In transit", tone: "bridge" },
  delivered: { label: "Delivered", tone: "ok" },
  declined: { label: "Declined", tone: "critical" },
  expired: { label: "Timed out", tone: "critical" },
  released: { label: "Released", tone: "neutral" },
};

/** Reservations that hold or have consumed units for the request. */
const LIVE: ReadonlySet<ReservationStatus> = new Set(["requested", "confirmed", "reserved", "picked_up", "delivered"]);
export const isLive = (r: ReservationDTO): boolean => LIVE.has(r.status);

/** Units already held or delivered for a request. */
export const unitsHeld = (request: RequestDTO): number =>
  request.reservations.filter(isLive).reduce((n, r) => n + r.unitsCount, 0);

/** One chip that sums up where a request stands. */
export function requestStatus(request: RequestDTO): { label: string; tone: ChipTone } {
  if (request.status === "fulfilled") return { label: "Fulfilled", tone: "ok" };
  if (request.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  if (request.active) return RESERVATION_STATUS[request.active.status];
  if (request.reservations.length > 0) return { label: "Needs a bank", tone: "critical" };
  return { label: "Open", tone: "neutral" };
}

/** Why a reservation closed, in plain words. */
export function closedReason(r: ReservationDTO): string {
  if (r.status === "expired") return r.declineReason ?? "didn't confirm in time";
  if (r.status === "declined") return r.declineReason ? `declined: ${r.declineReason}` : "declined";
  return r.declineReason ?? "released";
}

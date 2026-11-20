import type { ReservationStatus } from "../../../../shared/domain";
import type { QueueItemDTO } from "../../../../shared/api";

type Tone = "neutral" | "info" | "ok" | "warn" | "critical" | "bridge";

/** How each reservation status reads on a queue card. */
export const STATUS_COPY: Record<ReservationStatus, { label: string; tone: Tone }> = {
  requested: { label: "Awaiting your confirmation", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "ok" },
  reserved: { label: "Reserved · awaiting pickup", tone: "info" },
  picked_up: { label: "Picked up · on the way", tone: "bridge" },
  delivered: { label: "Delivered", tone: "ok" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Timed out · rerouted", tone: "neutral" },
  released: { label: "Released", tone: "neutral" },
};

const OPEN: ReadonlySet<ReservationStatus> = new Set(["requested", "reserved", "picked_up"]);
export const isOpen = (item: QueueItemDTO): boolean => OPEN.has(item.reservation.status);

const URGENCY_RANK = { critical: 0, urgent: 1, routine: 2 } as const;
const STATUS_RANK: Partial<Record<ReservationStatus, number>> = { requested: 0, reserved: 1, picked_up: 2 };

/** Critical first, then what needs action now, then the nearest deadline. */
export function sortQueue(items: readonly QueueItemDTO[]): QueueItemDTO[] {
  return [...items].sort(
    (a, b) =>
      URGENCY_RANK[a.request.urgency] - URGENCY_RANK[b.request.urgency] ||
      (STATUS_RANK[a.reservation.status] ?? 9) - (STATUS_RANK[b.reservation.status] ?? 9) ||
      a.request.neededBy - b.request.neededBy,
  );
}

import type { QueueItemDTO } from "../../../../shared/api";
import { RequestedActions } from "./RequestedActions";
import { ReservedActions } from "./ReservedActions";

/** Status-appropriate actions for an open queue card. */
export function QueueCardActions({ item }: { item: QueueItemDTO }) {
  const status = item.reservation.status;
  return (
    <div className="mt-3 border-t border-line pt-3">
      {status === "requested" ? <RequestedActions item={item} /> : null}
      {status === "reserved" ? <ReservedActions item={item} /> : null}
      {status === "picked_up" ? <p className="text-xs text-ink-muted">With the courier. The hospital marks it delivered on arrival.</p> : null}
    </div>
  );
}

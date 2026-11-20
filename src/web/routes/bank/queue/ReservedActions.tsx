import { PackageCheck, Phone } from "lucide-react";
import { useState } from "react";
import type { QueueItemDTO } from "../../../../shared/api";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../shared/useAction";
import { ConflictNote } from "./ConflictNote";
import { DeclineDialog } from "./DeclineDialog";

/** Reserved units: hand over to the courier, or release them. Stale-stock holds need a phone check first. */
export function ReservedActions({ item }: { item: QueueItemDTO }) {
  const { reservation: res, hospital } = item;
  const [releasing, setReleasing] = useState(false);
  const pickup = useAction({
    run: () => api.reservations.advance(res.id, { to: "picked_up" }),
    success: () => `Marked picked up by ${hospital.name}`,
  });
  const phone = useAction({ run: () => api.reservations.phoneConfirm(res.id), success: () => "Availability confirmed by phone" });
  const needsPhone = res.requiresPhoneConfirm && !res.phoneConfirmedAt;

  return (
    <>
      <ConflictNote errors={[pickup.error, phone.error]} />
      {needsPhone ? <p className="mb-2 text-xs text-warn">Stock was unconfirmed when reserved: confirm by phone before handover.</p> : null}
      <div className="flex flex-wrap gap-2">
        {needsPhone ? (
          <Button variant="primary" icon={<Phone className="size-4" aria-hidden />} loading={phone.isPending} onClick={() => phone.mutate(undefined)}>
            Confirm by phone
          </Button>
        ) : null}
        <Button
          variant={needsPhone ? "secondary" : "primary"}
          icon={<PackageCheck className="size-4" aria-hidden />}
          disabled={needsPhone}
          loading={pickup.isPending}
          onClick={() => pickup.mutate(undefined)}
        >
          Picked up
        </Button>
        <Button variant="ghost" onClick={() => setReleasing(true)}>
          Release
        </Button>
      </div>
      <DeclineDialog open={releasing} onClose={() => setReleasing(false)} item={item} />
    </>
  );
}

import { Check, X } from "lucide-react";
import { useState } from "react";
import type { QueueItemDTO } from "../../../../shared/api";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { plural } from "../../../lib/format";
import { useAction } from "../shared/useAction";
import { ConflictNote } from "./ConflictNote";
import { DeclineDialog } from "./DeclineDialog";
import { PartialConfirmDialog } from "./PartialConfirmDialog";

/** Confirm, partially confirm, or decline a request inside its confirm window. */
export function RequestedActions({ item }: { item: QueueItemDTO }) {
  const { reservation: res, hospital } = item;
  const [dialog, setDialog] = useState<"partial" | "decline" | null>(null);
  const close = () => setDialog(null);
  const confirm = useAction({
    run: (units: number | undefined) => api.reservations.confirm(res.id, units === undefined ? {} : { units }),
    success: (r) => `Confirmed ${plural(r.unitsCount, "unit")} for ${hospital.name}`,
    onDone: close,
  });

  return (
    <>
      <ConflictNote errors={[confirm.error]} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<Check className="size-4" aria-hidden />} loading={confirm.isPending} onClick={() => confirm.mutate(undefined)}>
          Confirm {plural(res.unitsCount, "unit")}
        </Button>
        {res.unitsCount > 1 ? <Button onClick={() => setDialog("partial")}>Partially confirm</Button> : null}
        <Button variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={() => setDialog("decline")}>
          Decline
        </Button>
      </div>
      <PartialConfirmDialog
        open={dialog === "partial"}
        onClose={close}
        allocated={res.unitsCount}
        pending={confirm.isPending}
        onConfirm={(units) => confirm.mutate(units)}
      />
      <DeclineDialog open={dialog === "decline"} onClose={close} item={item} />
    </>
  );
}

import { useId, useState } from "react";
import type { QueueItemDTO } from "../../../../shared/api";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/cn";
import { useAction } from "../shared/useAction";

const QUICK_REASONS = [
  "Units already issued to a walk-in",
  "Failed visual inspection",
  "Count mismatch on recount",
  "No courier or staff available",
  "Cold chain issue",
] as const;

/** Decline (or release) with a reason. The request reroutes to the next-best bank immediately. */
export function DeclineDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item: QueueItemDTO }) {
  const [reason, setReason] = useState("");
  const textId = useId();
  const releasing = item.reservation.status === "reserved";
  const decline = useAction({
    run: (text: string) => api.reservations.decline(item.reservation.id, { reason: text }),
    success: () => `${releasing ? "Released" : "Declined"} · ${item.hospital.name} is being rerouted`,
    onDone: onClose,
  });
  const valid = reason.trim().length >= 2;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={releasing ? "Release reserved units" : "Decline request"}
      description={`${item.hospital.name} is offered the next-best bank straight away. Your reason goes to the audit log.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!valid} loading={decline.isPending} onClick={() => decline.mutate(reason.trim())}>
            {releasing ? "Release units" : "Decline"}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="text-sm font-medium">Quick reasons</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "focus-ring rounded-full border px-3 py-1 text-sm transition-colors",
                reason === r ? "border-ink bg-ink text-surface" : "border-line-strong hover:bg-surface-2",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <label htmlFor={textId} className="mt-4 block text-sm font-medium">
        Reason
      </label>
      <textarea
        id={textId}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="Or type your own"
        className="focus-ring mt-1.5 w-full rounded-(--radius-control) border border-line-strong bg-surface px-3 py-2 text-sm"
      />
    </Dialog>
  );
}

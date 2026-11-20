import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { TransferSuggestionDTO } from "../../../../shared/api";
import { COMPONENT_SHORT } from "../../../../shared/domain";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { plural } from "../../../lib/format";
import { NumberStepper } from "../shared/NumberStepper";
import { useAction } from "../shared/useAction";

const MAX_TRANSFER = 50;

/** Approve (optionally with a modified quantity) or dismiss a transfer suggestion. */
export function SuggestionActions({ suggestion: s }: { suggestion: TransferSuggestionDTO }) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(s.quantity);
  const cell = { fromSiteId: s.fromSiteId, toSiteId: s.toSiteId, bloodGroup: s.bloodGroup, component: s.component };
  const approve = useAction({
    run: () => api.transfers.approve({ ...cell, quantity }),
    success: (t) => `Transfer approved: ${t.quantity} × ${t.bloodGroup} ${COMPONENT_SHORT[t.component]} to ${t.toName}`,
  });
  const dismiss = useAction({ run: () => api.transfers.dismiss(cell), success: () => "Suggestion dismissed" });
  const busy = approve.isPending || dismiss.isPending;

  return (
    <div className="mt-3 border-t border-line pt-3">
      {editing ? (
        <div className="mb-3">
          <NumberStepper label="Units to transfer" value={quantity} min={1} max={MAX_TRANSFER} onChange={setQuantity} hint={`suggested ${s.quantity}`} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="bridge" icon={<Check className="size-4" aria-hidden />} loading={approve.isPending} disabled={busy} onClick={() => approve.mutate(undefined)}>
          Approve {plural(quantity, "unit")}
        </Button>
        {!editing ? (
          <Button icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(true)} disabled={busy}>
            Modify quantity
          </Button>
        ) : null}
        <Button variant="ghost" icon={<X className="size-4" aria-hidden />} loading={dismiss.isPending} disabled={busy} onClick={() => dismiss.mutate(undefined)}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

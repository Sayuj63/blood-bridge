import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { plural } from "../../../lib/format";
import { NumberStepper } from "../shared/NumberStepper";

export interface PartialConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Units the system allocated; a partial confirm keeps fewer. */
  allocated: number;
  pending: boolean;
  onConfirm: (units: number) => void;
}

/** Confirm fewer units than allocated; the rest return to stock and the request reroutes for the remainder. */
export function PartialConfirmDialog({ open, onClose, allocated, pending, onConfirm }: PartialConfirmDialogProps) {
  const [units, setUnits] = useState(Math.max(1, allocated - 1));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Partially confirm"
      description={`How many of the ${plural(allocated, "suggested unit")} can you send? The rest go back on the shelf and the hospital is offered another bank for the remainder.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} onClick={() => onConfirm(units)}>
            Confirm {plural(units, "unit")}
          </Button>
        </>
      }
    >
      <NumberStepper label="Units to confirm" value={units} min={1} max={Math.max(1, allocated - 1)} onChange={setUnits} />
    </Dialog>
  );
}

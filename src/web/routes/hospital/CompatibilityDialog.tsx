import type { Component } from "../../../shared/domain";
import { CompatibilityMatrix } from "../../components/ui/CompatibilityMatrix";
import { Dialog } from "../../components/ui/Dialog";

/** The compatibility table the ranking uses, always framed as demo logic. */
export function CompatibilityDialog({ open, onClose, component }: { open: boolean; onClose: () => void; component: Component }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Compatibility table"
      description="Demo logic. Clinicians confirm every non-exact match."
      className="sm:w-[min(40rem,calc(100vw-2rem))]"
    >
      {/* Remount per open so the table starts on the component being requested. */}
      {open ? <CompatibilityMatrix key={component} initial={component} /> : null}
    </Dialog>
  );
}

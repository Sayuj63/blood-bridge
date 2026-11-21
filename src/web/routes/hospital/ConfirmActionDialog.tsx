import type { ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";

interface ConfirmActionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger" | "bridge";
  pending?: boolean;
  children?: ReactNode;
}

/**
 * Explicit operator confirmation dialog before triggering transfers or simulated surges.
 * Uses the native <dialog> primitive in components/ui/Dialog.tsx.
 */
export function ConfirmActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  pending = false,
  children,
}: ConfirmActionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

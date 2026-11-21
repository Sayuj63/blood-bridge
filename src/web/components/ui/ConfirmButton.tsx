import { useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "./Button";
import { Dialog } from "./Dialog";

export interface ConfirmButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Question in the dialog title, e.g. "End the surge?". */
  confirmTitle: ReactNode;
  /** One sentence on what will happen. */
  confirmDescription?: ReactNode;
  /** Label of the confirming action. */
  confirmLabel: string;
  onConfirm: () => void;
}

/** A button for global or destructive actions: asks once before calling `onConfirm`. */
export function ConfirmButton({ confirmTitle, confirmDescription, confirmLabel, onConfirm, loading, ...button }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...button} loading={loading} onClick={() => setOpen(true)} />
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={confirmTitle}
          description={confirmDescription}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                loading={loading}
                onClick={() => {
                  onConfirm();
                  setOpen(false);
                }}
              >
                {confirmLabel}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}

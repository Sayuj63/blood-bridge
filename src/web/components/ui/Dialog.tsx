import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One sentence on what this dialog is for. */
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, right-aligned. */
  footer?: ReactNode;
  /** `center` is a modal dialog; `right` and `bottom` are sheets. */
  side?: "center" | "right" | "bottom";
  className?: string;
}

/**
 * Modal dialog / sheet on the native <dialog> element: focus is trapped,
 * Escape closes, and focus returns to the opener — all by the browser.
 */
export function Dialog({ open, onClose, title, description, children, footer, side = "center", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-0 max-h-none max-w-none border border-line bg-surface p-0 text-ink shadow-panel backdrop:bg-scrim open:flex open:flex-col",
        side === "center" && "fixed inset-0 m-auto h-fit max-h-[90dvh] w-[min(34rem,calc(100vw-2rem))] rounded-(--radius-panel)",
        side === "right" && "fixed inset-y-0 right-0 left-auto h-dvh w-[min(28rem,100vw)] rounded-l-(--radius-panel)",
        side === "bottom" && "fixed inset-x-0 bottom-0 top-auto max-h-[85dvh] w-full rounded-t-(--radius-panel)",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id={titleId} className="text-lg font-semibold leading-tight">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="mt-1 text-sm text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
    </dialog>
  );
}

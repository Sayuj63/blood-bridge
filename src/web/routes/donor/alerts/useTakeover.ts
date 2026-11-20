import { useCallback, useState } from "react";
import type { DonorAlertDTO } from "../../../../shared/api";
import type { AlertStatus } from "../../../../shared/domain";

/** Statuses the takeover can show; anything else (declined, expired) closes it. */
const SHOWABLE: ReadonlySet<AlertStatus> = new Set(["sent", "accepted", "arrived", "fulfilled"]);

/**
 * Decides which alert, if any, takes over the screen.
 * - A new unanswered alert opens automatically (unless the donor chose "decide later").
 * - Once shown, the takeover follows that alert through its live status changes.
 * - When the bank records a donation the donor said yes to, the thank-you opens.
 */
export function useTakeover(alerts: DonorAlertDTO[] | undefined) {
  const [shownId, setShownId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [seen, setSeen] = useState(alerts);

  // Adjust state while rendering when the alert list changes (React's recommended pattern over an effect).
  if (alerts !== seen) {
    setSeen(alerts);
    const before = new Map((seen ?? []).map((a) => [a.id, a.status]));
    const completed = alerts?.find((a) => a.status === "arrived" && before.get(a.id) === "accepted");
    if (completed) setShownId(completed.id);
  }

  const shown = alerts?.find((a) => a.id === shownId);
  const current = shown && SHOWABLE.has(shown.status) ? shown : null;

  const incoming = alerts?.find((a) => a.status === "sent" && !dismissed.has(a.id));
  if (current === null && incoming && incoming.id !== shownId) setShownId(incoming.id);

  const close = useCallback(() => {
    if (shownId) setDismissed((d) => new Set(d).add(shownId));
    setShownId(null);
  }, [shownId]);

  const open = useCallback((alertId: string) => setShownId(alertId), []);

  return { current, open, close };
}

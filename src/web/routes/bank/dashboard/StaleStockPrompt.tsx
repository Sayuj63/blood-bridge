import { ClipboardCheck, TriangleAlert } from "lucide-react";
import { api } from "../../../lib/api";
import { formatHours } from "../../../lib/format";
import { useNow } from "../../../lib/useNow";
import { Button } from "../../../components/ui/Button";
import { useAction } from "../shared/useAction";

/**
 * Shown when this bank's last stock sync is older than the policy window.
 * Hospitals see stale stock as "unconfirmed" and must phone before pickup, so this is the bank's cue to recount.
 */
export function StaleStockPrompt({ siteId, lastSyncAt }: { siteId: string; lastSyncAt: number }) {
  const now = useNow(30_000);
  const sync = useAction({ run: () => api.sites.sync(siteId), success: () => "Stock count confirmed" });

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-(--radius-panel) border-2 border-warn bg-warn-soft px-4 py-3 sm:flex-row sm:items-center">
      <TriangleAlert className="size-6 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Stock not confirmed for {formatHours((now - lastSyncAt) / 3_600_000)}</p>
        <p className="text-sm text-ink-muted">
          Hospitals see your counts as unconfirmed and must phone before collecting. Recount the fridge, then confirm.
        </p>
      </div>
      <Button
        variant="primary"
        icon={<ClipboardCheck className="size-4" aria-hidden />}
        loading={sync.isPending}
        onClick={() => sync.mutate(undefined)}
      >
        Update stock / confirm count
      </Button>
    </div>
  );
}

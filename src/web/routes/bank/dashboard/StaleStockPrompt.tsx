import { ClipboardCheck, TriangleAlert } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { formatHours } from "../../../lib/format";
import { useNow } from "../../../lib/useNow";
import { useAction } from "../shared/useAction";

/**
 * Shown when this bank's last stock sync is older than the policy window.
 * Hospitals see stale stock as "unconfirmed" and must phone before pickup, so this is the bank's cue to recount.
 */
export function StaleStockPrompt({ siteId, lastSyncAt }: { siteId: string; lastSyncAt: number }) {
  const now = useNow(30_000);
  const sync = useAction({ run: () => api.sites.sync(siteId), success: () => "Stock count confirmed" });

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-[#F5D0A9] bg-[#FFF8F1] px-4 py-3.5 shadow-2xs sm:flex-row sm:items-center sm:px-5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FEF0DC] text-[#B45309]">
        <TriangleAlert className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="b-display text-sm font-bold text-[#171717]">
          Stock not confirmed for {formatHours((now - lastSyncAt) / 3_600_000)}
        </p>
        <p className="mt-0.5 text-xs text-[#737373]">
          Hospitals see your counts as unconfirmed and must phone before collecting. Recount the fridge, then confirm.
        </p>
      </div>
      <Button
        variant="primary"
        className="shrink-0 rounded-xl bg-[#C93245] font-bold hover:bg-[#A82436]"
        icon={<ClipboardCheck className="size-4" aria-hidden />}
        loading={sync.isPending}
        onClick={() => sync.mutate(undefined)}
      >
        Confirm count
      </Button>
    </div>
  );
}

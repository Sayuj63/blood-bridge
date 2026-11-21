import { ArrowLeftRight, Truck } from "lucide-react";
import type { UnitDTO } from "../../../../shared/api";
import { EmptyState, ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { useTransferBoard } from "../../../lib/queries";
import { ActiveTransferRow } from "./ActiveTransferRow";
import { OutcomeMeter } from "./OutcomeMeter";
import { SuggestionCard } from "./SuggestionCard";

/** Expiry-aware transfer suggestions for this bank, plus transfers already moving. */
export function TransfersPanel({ siteId, units }: { siteId: string; units: readonly UnitDTO[] }) {
  const board = useTransferBoard(siteId);

  if (board.isPending) {
    return (
      <div className="b-card p-6">
        <SkeletonRows rows={4} />
      </div>
    );
  }
  if (board.isError) {
    return (
      <div className="b-card p-6">
        <ErrorState what="transfer suggestions" error={board.error} onRetry={() => void board.refetch()} />
      </div>
    );
  }
  const { suggestions, active, before, after } = board.data;

  return (
    <div className="space-y-6">
      <OutcomeMeter before={before} after={after} />

      <section aria-labelledby="suggestions-title" className="b-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <ArrowLeftRight className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="suggestions-title" className="b-display text-sm font-bold text-[#171717]">
                Suggested transfers for this bank
              </h2>
              <p className="text-[11px] text-[#737373]">Expiry-aware redistribution recommendations</p>
            </div>
          </div>
          <span className="b-num rounded-full bg-[#FCEBED] px-2.5 py-0.5 text-xs font-bold text-[#A82436]">
            {suggestions.length}
          </span>
        </div>

        {suggestions.length === 0 ? (
          <EmptyState
            compact
            icon={<ArrowLeftRight />}
            title="No transfers suggested"
            description="When units here would expire unused, or a nearby site is forecast short, a suggestion appears."
          />
        ) : (
          <div className="grid gap-4 2xl:grid-cols-2">
            {suggestions.map((s) => (
              <SuggestionCard key={s.key} suggestion={s} siteId={siteId} units={units} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="active-transfers-title" className="b-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <Truck className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="active-transfers-title" className="b-display text-sm font-bold text-[#171717]">
              In transit and recent
            </h2>
            <p className="text-[11px] text-[#737373]">Active &amp; completed transfers in the last 24 hours</p>
          </div>
        </div>

        {active.length === 0 ? (
          <p className="rounded-xl bg-[#FAF9F6] px-4 py-5 text-center text-xs text-[#737373]">
            No transfers involving this bank in the last 24 hours.
          </p>
        ) : (
          <ul className="divide-y divide-[#EAE6E3] overflow-hidden rounded-xl border border-[#EAE6E3]">
            {active.map((t) => (
              <ActiveTransferRow key={t.id} transfer={t} siteId={siteId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { ArrowLeftRight } from "lucide-react";
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

  if (board.isPending) return <SkeletonRows rows={4} />;
  if (board.isError) return <ErrorState what="transfer suggestions" error={board.error} onRetry={() => void board.refetch()} />;
  const { suggestions, active, before, after } = board.data;

  return (
    <div className="space-y-5">
      <OutcomeMeter before={before} after={after} />
      <section aria-labelledby="suggestions-title">
        <h3 id="suggestions-title" className="mb-2 font-semibold">
          Suggested for this bank <span className="font-numeric font-normal text-ink-muted">({suggestions.length})</span>
        </h3>
        {suggestions.length === 0 ? (
          <EmptyState
            compact
            icon={<ArrowLeftRight />}
            title="No transfers suggested"
            description="When units here would expire unused, or a nearby site is forecast short, a suggestion appears."
          />
        ) : (
          <div className="grid gap-3 2xl:grid-cols-2">
            {suggestions.map((s) => (
              <SuggestionCard key={s.key} suggestion={s} siteId={siteId} units={units} />
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="active-transfers-title">
        <h3 id="active-transfers-title" className="mb-2 font-semibold">
          In transit and recent
        </h3>
        {active.length === 0 ? (
          <p className="text-sm text-ink-muted">No transfers involving this bank in the last 24 hours.</p>
        ) : (
          <ul className="divide-y divide-line rounded-(--radius-control) border border-line">
            {active.map((t) => (
              <ActiveTransferRow key={t.id} transfer={t} siteId={siteId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

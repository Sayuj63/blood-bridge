import { Lock, UserRoundCheck } from "lucide-react";
import { EmptyState, ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { useIncomingDonors } from "../hooks";
import { IncomingDonorRow } from "./IncomingDonorRow";

/** Donors who answered "I can come". Contact details are shared only after that yes. */
export function IncomingDonors({ siteId }: { siteId: string }) {
  const donors = useIncomingDonors(siteId);

  return (
    <section aria-labelledby="incoming-donors-title">
      <h3 id="incoming-donors-title" className="font-semibold">
        Incoming donors
      </h3>
      <p className="mt-1 mb-3 flex items-start gap-1.5 text-xs text-ink-muted">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
        Name and phone are visible only because each donor said yes to this bank's alert. Others stay anonymous.
      </p>
      {donors.isPending ? <SkeletonRows rows={2} /> : null}
      {donors.isError ? <ErrorState compact what="incoming donors" error={donors.error} onRetry={() => void donors.refetch()} /> : null}
      {donors.data?.length === 0 ? (
        <EmptyState compact icon={<UserRoundCheck />} title="No donors on the way" description="Run a drive above. Donors who accept show up here with a confirmation code." />
      ) : null}
      {donors.data && donors.data.length > 0 ? (
        <ul className="divide-y divide-line rounded-(--radius-control) border border-line">
          {donors.data.map((d) => (
            <IncomingDonorRow key={d.alertId} donor={d} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

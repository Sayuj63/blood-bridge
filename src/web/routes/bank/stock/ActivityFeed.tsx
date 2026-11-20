import { History } from "lucide-react";
import { Link } from "react-router";
import { EmptyState, ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { formatIST, shortHash } from "../../../lib/format";
import { useSiteAudit } from "../hooks";

/** This bank's recent entries in the hash-chained audit ledger. Every stock change lands here. */
export function ActivityFeed({ siteId }: { siteId: string }) {
  const audit = useSiteAudit(siteId);

  return (
    <section aria-labelledby="activity-title" className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <History className="size-4 text-ink-muted" aria-hidden />
        <h3 id="activity-title" className="font-semibold">
          Recent activity
        </h3>
        <Link to="/ledger" className="focus-ring ml-auto rounded-sm text-xs text-info underline-offset-2 hover:underline">
          Full ledger
        </Link>
      </div>
      {audit.isPending ? <SkeletonRows rows={5} /> : null}
      {audit.isError ? <ErrorState compact what="recent activity" error={audit.error} onRetry={() => void audit.refetch()} /> : null}
      {audit.data?.length === 0 ? <EmptyState compact title="No activity yet" description="Stock changes, confirmations and transfers will be logged here." /> : null}
      {audit.data && audit.data.length > 0 ? (
        <ol className="space-y-0.5" aria-label="Audit entries, newest first">
          {audit.data.map((e) => (
            <li key={e.seq} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-(--radius-chip) px-2 py-1.5 hover:bg-surface-2">
              <time dateTime={new Date(e.at).toISOString()} className="pt-0.5 font-numeric text-xs text-ink-faint">
                {formatIST(e.at)}
              </time>
              <div className="min-w-0">
                <p className="text-sm leading-snug">{e.summary}</p>
                <p className="truncate font-mono text-2xs text-ink-faint">
                  #{e.seq} · {e.actor} · {shortHash(e.hash, 8)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

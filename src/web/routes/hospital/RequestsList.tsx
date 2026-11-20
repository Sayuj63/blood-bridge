import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { COMPONENT_SHORT } from "../../../shared/domain";
import { Badge } from "../../components/ui/Badge";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { useTick } from "./useTick";
import { requestStatus } from "./statusMeta";

interface RequestsListProps {
  hospitalId: string;
  selectedId: string | null;
  onSelect: (requestId: string | null) => void;
}

/** Today's requests from this hospital, newest first, each with a live status chip. */
export function RequestsList({ hospitalId, selectedId, onSelect }: RequestsListProps) {
  const now = useTick(30_000);
  const query = useQuery({
    queryKey: queryKeys.requests(hospitalId),
    queryFn: ({ signal }) => api.requests.list(hospitalId, signal),
  });

  return (
    <section aria-labelledby="my-requests" className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="my-requests" className="text-[0.9375rem] font-semibold">
          Today's requests
        </h2>
        {selectedId ? (
          <Button size="sm" variant="ghost" onClick={() => onSelect(null)} icon={<Plus className="size-4" aria-hidden />}>
            New request
          </Button>
        ) : null}
      </div>
      {query.isPending ? (
        <SkeletonRows rows={3} />
      ) : query.isError ? (
        <ErrorState compact what="today's requests" error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState compact icon={<ClipboardList />} title="No requests yet today" description="Requests you raise appear here so you can switch between them." />
      ) : (
        <ul className="-mx-1 max-h-[26rem] space-y-1 overflow-y-auto px-1">
          {query.data.map((r) => {
            const status = requestStatus(r);
            const selected = r.id === selectedId;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "focus-ring flex w-full items-center gap-3 rounded-(--radius-control) border px-2.5 py-2 text-left transition-colors",
                    selected ? "border-ink/40 bg-surface-2" : "border-transparent hover:bg-surface-2",
                  )}
                >
                  <BloodGroupChip group={r.bloodGroup} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.unitsNeeded} × {COMPONENT_SHORT[r.component]} · {r.ward}
                    </span>
                    <span className="block font-numeric text-xs text-ink-muted">
                      {r.urgency === "critical" ? <span className="font-semibold text-critical">Critical · </span> : null}
                      {relativeTime(r.createdAt, now)}
                      {r.active ? ` · ${r.active.bankName}` : ""}
                    </span>
                  </span>
                  <Badge tone={status.tone} size="sm">
                    {status.label}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

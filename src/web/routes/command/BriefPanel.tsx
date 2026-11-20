import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import type { SurgeDTO } from "../../../shared/api";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { formatIST } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { Panel } from "./Panel";

/** AI situation brief for the active surge, with its source shown plainly. */
export function BriefPanel({ surge }: { surge: SurgeDTO | null }) {
  const brief = useQuery({
    queryKey: queryKeys.surgeBrief(surge?.id ?? "none"),
    queryFn: ({ signal }) => api.surge.brief(signal),
    enabled: surge !== null,
    staleTime: 60_000,
  });

  return (
    <Panel
      id="brief"
      title="Situation brief"
      className="border-b"
      meta={brief.data ? formatIST(brief.data.generatedAt) : undefined}
      actions={
        surge ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Regenerate brief"
            onClick={() => void brief.refetch()}
            disabled={brief.isFetching}
            icon={<RefreshCw className={brief.isFetching ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />}
          />
        ) : null
      }
    >
      {!surge ? (
        <p className="p-3 text-sm text-ink-muted">
          The brief summarises a running scenario: what is short, where, and what to approve first. Start a scenario to generate one.
        </p>
      ) : brief.error ? (
        <ErrorState compact what="the situation brief" error={brief.error} onRetry={() => void brief.refetch()} />
      ) : !brief.data ? (
        <div className="space-y-2 p-3" aria-busy="true">
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ) : (
        <div className="p-3">
          <Badge tone={brief.data.source === "workers-ai" ? "bridge" : "neutral"} size="sm">
            <Sparkles className="size-3" aria-hidden />
            {brief.data.source === "workers-ai" ? "Workers AI · open model" : "Template (AI unavailable)"}
          </Badge>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink">{brief.data.text}</p>
          <p className="mt-2 text-2xs text-ink-faint">Generated from the forecast numbers on this screen. Check before acting.</p>
        </div>
      )}
    </Panel>
  );
}

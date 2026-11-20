import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SearchInput, SiteDTO } from "../../../shared/api";
import type { RankedOption } from "../../../shared/ranking";
import { COMPONENT_LABEL } from "../../../shared/domain";
import { ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { formatIST, plural } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { HospitalMap } from "./HospitalMap";
import { NoMatchState } from "./NoMatchState";
import { ResultCard } from "./ResultCard";

interface ResultsPanelProps {
  hospital: SiteDTO;
  search: SearchInput;
  title: ReactNode;
  onReserve: (option: RankedOption) => void;
  /** Bank whose reservation is in flight. */
  reservingSiteId: string | null;
  onCritical?: () => void;
  criticalPending?: boolean;
  /** Focus the heading whenever a new search is shown (after "Find blood"). */
  autoFocus?: boolean;
}

/**
 * Ranked results, split view: the map (hospital as origin, numbered banks) beside
 * the ranked cards. Stays live: stock events invalidate the search query.
 */
export function ResultsPanel({ hospital, search, title, onReserve, reservingSiteId, onCritical, criticalPending, autoFocus = false }: ResultsPanelProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const query = useQuery({
    queryKey: queryKeys.search(search),
    queryFn: () => api.search(search),
    placeholderData: (prev) => prev,
  });

  // Move focus to the results so keyboard and small-screen users land on them after "Find blood".
  const searchKey = JSON.stringify(search);
  useEffect(() => {
    if (autoFocus) headingRef.current?.focus();
  }, [autoFocus, searchKey]);

  const options = query.data?.options ?? [];
  const focusCard = (siteId: string) => {
    const el = document.getElementById(`result-${siteId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el?.focus({ preventScroll: true });
  };

  return (
    <section aria-labelledby="results-title" aria-busy={query.isFetching} className="@container">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="results-title" ref={headingRef} tabIndex={-1} className="font-display text-xl outline-none">
          {title}
        </h2>
        <p className="text-sm text-ink-muted" aria-live="polite">
          {query.data
            ? `${plural(options.length, "bank")} with compatible ${COMPONENT_LABEL[search.component].toLowerCase()} · searched ${formatIST(query.data.searchedAt, true)}`
            : "Searching every blood bank in the city…"}
        </p>
      </div>

      {query.isError ? (
        <ErrorState what="search results" error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data?.noMatch ? (
        <NoMatchState search={search} noMatch={query.data.noMatch} onCritical={onCritical} criticalPending={criticalPending} />
      ) : (
        <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
          <div className="h-64 overflow-hidden rounded-(--radius-panel) border border-line @3xl:sticky @3xl:top-20 @3xl:h-[min(36rem,calc(100dvh-7rem))]">
            <HospitalMap
              hospital={hospital}
              banks={options.map((o) => ({ siteId: o.siteId, rank: o.rank, label: `#${o.rank} ${o.name}`, stale: o.stale }))}
              focusId={hovered ?? options[0]?.siteId}
              onBankClick={focusCard}
              label={`Map of ranked blood banks around ${hospital.name}`}
              className="size-full"
            />
          </div>
          <ol className="space-y-3">
            {query.isPending
              ? Array.from({ length: 3 }, (_, i) => (
                  <li key={i}>
                    <Skeleton className="h-44 rounded-(--radius-panel)" />
                  </li>
                ))
              : options.map((o) => (
                  <li key={o.siteId}>
                    <ResultCard
                      option={o}
                      unitsNeeded={search.unitsNeeded}
                      highlighted={hovered === o.siteId}
                      reserving={reservingSiteId === o.siteId}
                      disabled={reservingSiteId !== null && reservingSiteId !== o.siteId}
                      onReserve={() => onReserve(o)}
                      onHover={setHovered}
                    />
                  </li>
                ))}
          </ol>
        </div>
      )}
    </section>
  );
}

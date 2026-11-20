import { ArrowRightLeft, SearchX, Siren } from "lucide-react";
import type { SearchInput, SearchResultDTO } from "../../../shared/api";
import { compatibleSources } from "../../../shared/compatibility";
import { COMPONENT_LABEL } from "../../../shared/domain";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";
import { Button, LinkButton } from "../../components/ui/Button";
import { useSites } from "../../lib/queries";

interface NoMatchStateProps {
  search: SearchInput;
  noMatch: NonNullable<SearchResultDTO["noMatch"]>;
  /** Raise a critical alert; omitted when this request can't alert (not critical, or already alerted). */
  onCritical?: () => void;
  criticalPending?: boolean;
}

/** Nothing compatible and in date: say so plainly, show what would be compatible, and offer the escalation paths. */
export function NoMatchState({ search, noMatch, onCritical, criticalPending = false }: NoMatchStateProps) {
  const sites = useSites().data ?? [];
  const sources = compatibleSources(search.bloodGroup, search.component);
  const holders = sites.filter((s) => noMatch.nearestAnyStockSiteIds.includes(s.id) && s.kind === "blood_bank");

  return (
    <div role="status" className="rounded-(--radius-panel) border border-critical/30 bg-critical-soft p-5">
      <div className="flex items-start gap-3">
        <SearchX className="mt-0.5 size-6 shrink-0 text-critical" aria-hidden />
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-critical">No compatible, in-date stock in the city</h3>
            <p className="mt-1 text-sm text-ink">{noMatch.hint}</p>
          </div>

          <div>
            <p className="font-label text-xs uppercase tracking-wider text-ink-muted">
              Compatible groups for {search.bloodGroup} {COMPONENT_LABEL[search.component].toLowerCase()}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <li key={s.group} className="inline-flex items-center gap-1">
                  <BloodGroupChip group={s.group} size="sm" />
                  <span className="text-xs text-ink-muted">{s.exact ? "exact" : "alternative"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-ink-muted">
              {holders.length > 0
                ? `${holders.length} bank${holders.length === 1 ? "" : "s"} hold ${COMPONENT_LABEL[search.component].toLowerCase()} of other groups (${holders.map((h) => h.shortName).join(", ")}), none of it compatible or in date in time.`
                : `No bank holds any ${COMPONENT_LABEL[search.component].toLowerCase()} right now.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {onCritical ? (
              <Button variant="danger" loading={criticalPending} onClick={onCritical} icon={<Siren className="size-4" aria-hidden />}>
                Raise critical alert
              </Button>
            ) : null}
            <LinkButton to="/command" variant="bridge" icon={<ArrowRightLeft className="size-4" aria-hidden />}>
              See transfer suggestions
            </LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

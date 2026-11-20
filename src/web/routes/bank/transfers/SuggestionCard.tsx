import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { TransferSuggestionDTO, UnitDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { ExpiryBadge } from "../../../components/ui/ExpiryBadge";
import { plural } from "../../../lib/format";
import { SuggestionActions } from "./SuggestionActions";

export interface SuggestionCardProps {
  suggestion: TransferSuggestionDTO;
  siteId: string;
  /** This bank's units, to show shelf life for units that would leave. */
  units: readonly UnitDTO[];
}

/** One expiry-aware transfer suggestion: why, how many, and the operator's decision. */
export function SuggestionCard({ suggestion: s, siteId, units }: SuggestionCardProps) {
  const outbound = s.fromSiteId === siteId;
  const leaving = outbound ? units.filter((u) => s.unitIds.includes(u.id)) : [];

  return (
    <article className="rounded-(--radius-panel) border border-line bg-surface p-3.5">
      <header className="flex flex-wrap items-center gap-2">
        <Badge tone="bridge" size="sm">
          {outbound ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownLeft className="size-3" aria-hidden />}
          {outbound ? `Send to ${s.toName}` : `Receive from ${s.fromName}`}
        </Badge>
        {s.rescuedFromExpiry > 0 ? (
          <Badge tone="warn" size="sm">
            Saves {plural(s.rescuedFromExpiry, "unit")} from expiry
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-ink-muted">ETA {s.etaMinutes} min</span>
      </header>
      <div className="mt-2.5 flex items-start gap-3">
        <BloodGroupChip group={s.bloodGroup} variant="label" size="sm" />
        <div className="min-w-0">
          <p className="text-sm leading-snug">{s.reason}</p>
          <p className="mt-1 font-semibold">
            Suggested transfer: {plural(s.quantity, "unit")} of {s.bloodGroup} {COMPONENT_LABEL[s.component].toLowerCase()}
          </p>
        </div>
      </div>
      {leaving.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Units that would leave">
          {leaving.map((u) => (
            <li key={u.id} className="inline-flex items-center gap-1.5 rounded-(--radius-chip) bg-surface-2 px-1.5 py-0.5">
              <code className="font-mono text-2xs">{u.id}</code>
              <ExpiryBadge expiresAt={u.expiresAt} size="sm" />
            </li>
          ))}
        </ul>
      ) : null}
      <SuggestionActions suggestion={s} />
    </article>
  );
}

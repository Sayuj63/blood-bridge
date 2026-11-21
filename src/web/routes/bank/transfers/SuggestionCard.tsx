import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";
import type { TransferSuggestionDTO, UnitDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
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
    <article className="rounded-2xl border border-[#EAE6E3] bg-[#FAF9F6] p-4 transition-colors hover:border-[#F2D7DB]">
      <header className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FCEBED] px-2.5 py-0.5 text-[11px] font-bold text-[#A82436]">
          {outbound ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownLeft className="size-3" aria-hidden />}
          {outbound ? `Send to ${s.toName}` : `Receive from ${s.fromName}`}
        </span>
        {s.rescuedFromExpiry > 0 ? (
          <span className="rounded-full bg-[#FFF7ED] px-2.5 py-0.5 text-[11px] font-bold text-[#B45309]">
            Saves {plural(s.rescuedFromExpiry, "unit")} from expiry
          </span>
        ) : null}
        <span className="b-num ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#737373]">
          <Clock className="size-3" aria-hidden />
          {s.etaMinutes} min
        </span>
      </header>

      <div className="mt-3 flex items-start gap-3">
        <span className="b-num grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sm font-extrabold text-[#A82436] ring-1 ring-[#F2D7DB]">
          {s.bloodGroup.replace("-", "−")}
        </span>
        <div className="min-w-0">
          <p className="text-xs leading-relaxed text-[#525252]">{s.reason}</p>
          <p className="b-display mt-1 text-sm font-bold text-[#171717]">
            {plural(s.quantity, "unit")} of {s.bloodGroup.replace("-", "−")} {COMPONENT_LABEL[s.component].toLowerCase()}
          </p>
        </div>
      </div>

      {leaving.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Units that would leave">
          {leaving.map((u) => (
            <li key={u.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAE6E3] bg-white px-2 py-1">
              <code className="font-mono text-[10px] font-semibold text-[#171717]">{u.id}</code>
              <ExpiryBadge expiresAt={u.expiresAt} size="sm" />
            </li>
          ))}
        </ul>
      ) : null}

      <SuggestionActions suggestion={s} />
    </article>
  );
}

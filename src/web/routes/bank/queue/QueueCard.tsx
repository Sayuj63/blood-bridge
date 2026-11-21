import { Clock, MapPin } from "lucide-react";
import type { QueueItemDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { UrgencyTag } from "../../../components/ui/UrgencyTag";
import { cn } from "../../../lib/cn";
import { formatIST, relativeTime } from "../../../lib/format";
import { useNow } from "../../../lib/useNow";
import { QueueCardActions } from "./QueueCardActions";
import { QueueTimer } from "./QueueTimer";
import { STATUS_COPY, isOpen } from "./status";
import { SuggestedUnits } from "./SuggestedUnits";

export interface QueueCardProps {
  item: QueueItemDTO;
  /** Just arrived over the live feed: highlight it. */
  fresh: boolean;
}

/** One incoming request for this bank: who, what, how fast, the units we'd send, and what to do. */
export function QueueCard({ item, fresh }: QueueCardProps) {
  const { reservation: res, request, hospital } = item;
  const now = useNow(30_000);
  const open = isOpen(item);
  const critical = request.urgency === "critical" && open;
  const status = STATUS_COPY[res.status];
  const titleId = `queue-${res.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "rounded-2xl border bg-white p-4 transition-[box-shadow,opacity] duration-300",
        critical ? "border-[#F2D7DB] border-l-4 border-l-[#C93245] bg-[#FFF5F5]/60" : "border-[#EAE6E3]",
        fresh && "ring-2 ring-[#C93245]",
        !open && "opacity-65",
      )}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        {fresh ? (
          <span className="rounded-full bg-[#C93245] px-2 py-0.5 text-[10px] font-bold text-white">New</span>
        ) : null}
        <UrgencyTag urgency={request.urgency} size="sm" />
        <Badge tone={status.tone} size="sm">
          {status.label}
        </Badge>
        <QueueTimer reservation={res} className="ml-auto" />
      </header>

      <div className="mt-3 flex items-start gap-3">
        <span className="b-num grid size-11 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-sm font-extrabold text-[#A82436]">
          {request.bloodGroup.replace("-", "−")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="b-display truncate text-sm font-bold leading-snug text-[#171717]">
            {hospital.name}
          </h3>
          <p className="mt-0.5 text-xs text-[#737373]">
            <span className="b-num font-bold text-[#171717]">{res.unitsCount}</span>
            {res.unitsCount < request.unitsNeeded ? <span className="b-num"> of {request.unitsNeeded}</span> : null} ×{" "}
            {COMPONENT_LABEL[request.component]} · {request.ward}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#737373]">
            <span className="b-num inline-flex items-center gap-1">
              <Clock className="size-3 text-[#C93245]" aria-hidden />
              By {formatIST(request.neededBy)}
            </span>
            <span className="b-num inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              ETA {res.etaMinutes}m
            </span>
            <span>{relativeTime(res.createdAt, now)}</span>
          </p>
        </div>
      </div>

      {res.needsClinicianConfirmation ? (
        <p className="mt-3 rounded-xl border border-[#F5D0A9] bg-[#FFF8F1] px-2.5 py-1.5 text-[11px] font-semibold text-[#B45309]">
          {res.matchType === "mixed" ? "Mixed exact + compatible groups" : "Compatible group, not exact"} · clinician confirmation required
        </p>
      ) : null}

      <SuggestedUnits units={res.units} />
      {res.declineReason && !open ? <p className="mt-2 text-xs text-[#737373]">Reason: {res.declineReason}</p> : null}
      {open ? <QueueCardActions item={item} /> : null}
    </article>
  );
}

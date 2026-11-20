import { Clock, MapPin } from "lucide-react";
import type { QueueItemDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
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
        "rounded-(--radius-panel) border bg-surface p-3.5 transition-[box-shadow,opacity] duration-(--duration-slow)",
        critical ? "border-critical border-l-[6px] bg-critical-soft/40" : "border-line",
        fresh && "shadow-[0_0_0_3px_var(--bb-accent)]",
        !open && "opacity-60",
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        {fresh ? (
          <Badge size="sm" className="bg-accent text-accent-ink">
            New
          </Badge>
        ) : null}
        <UrgencyTag urgency={request.urgency} size="sm" />
        <Badge tone={status.tone} size="sm">
          {status.label}
        </Badge>
        <QueueTimer reservation={res} className="ml-auto" />
      </header>

      <div className="mt-2.5 flex items-start gap-3">
        <BloodGroupChip group={request.bloodGroup} variant="label" size="md" />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="truncate font-semibold leading-tight">
            {hospital.name}
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            <span className="font-numeric font-bold text-ink">{res.unitsCount}</span>
            {res.unitsCount < request.unitsNeeded ? <span className="font-numeric"> of {request.unitsNeeded}</span> : null} ×{" "}
            {COMPONENT_LABEL[request.component]} · {request.ward}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              Needed by {formatIST(request.neededBy)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              Pickup ETA {res.etaMinutes} min
            </span>
            <span>{relativeTime(res.createdAt, now)}</span>
          </p>
        </div>
      </div>

      {res.needsClinicianConfirmation ? (
        <p className="mt-2.5 rounded-(--radius-chip) border border-warn/40 bg-warn-soft px-2 py-1 text-xs font-semibold text-warn">
          {res.matchType === "mixed" ? "Mixed exact + compatible groups" : "Compatible group, not exact"} · clinician confirmation required
        </p>
      ) : null}

      <SuggestedUnits units={res.units} />
      {res.declineReason && !open ? <p className="mt-2 text-xs text-ink-muted">Reason: {res.declineReason}</p> : null}
      {open ? <QueueCardActions item={item} /> : null}
    </article>
  );
}

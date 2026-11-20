import { AlertTriangle } from "lucide-react";
import type { ReservationDTO, SiteDTO } from "../../../shared/api";
import { Badge } from "../../components/ui/Badge";
import { ExpiryBadge } from "../../components/ui/ExpiryBadge";
import { AllocationChips } from "./AllocationChips";
import { ConfirmWindow } from "./ConfirmWindow";
import { HospitalMap } from "./HospitalMap";
import { PhoneCheck } from "./PhoneCheck";
import { RESERVATION_STATUS } from "./statusMeta";
import { TrackerStage } from "./TrackerStage";
import { TrackerTimeline } from "./TrackerTimeline";
import { useTrackerActions } from "./useHospitalMutations";

/**
 * The live tracker for one reservation. Every change arrives over the realtime
 * socket (the request query is invalidated), so it updates without a refresh.
 */
export function ReservationTracker({ reservation: r, hospital }: { reservation: ReservationDTO; hospital: SiteDTO }) {
  const { advance, phoneConfirm } = useTrackerActions(hospital.id, r.requestId);
  const status = RESERVATION_STATUS[r.status];
  const phoneCheckPending = r.requiresPhoneConfirm && r.phoneConfirmedAt === null;
  const soonest = r.units.length ? Math.min(...r.units.map((u) => u.expiresAt)) : null;

  return (
    <section aria-labelledby={`tracker-${r.id}`} className="@container overflow-hidden rounded-(--radius-panel) border border-line bg-surface shadow-panel">
      <p className="sr-only" aria-live="polite" aria-atomic>
        {`${r.bankName}: ${status.label}`}
      </p>
      <div className="grid @3xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="space-y-4 p-4 @lg:p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-label text-xs uppercase tracking-wider text-ink-muted">Reserved at</p>
              <h3 id={`tracker-${r.id}`} className="font-display text-xl leading-tight">
                {r.bankName}
              </h3>
            </div>
            <Badge tone={status.tone} size="lg">
              {status.label}
            </Badge>
          </header>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <AllocationChips units={r.units} />
            {soonest !== null && r.status !== "delivered" ? <ExpiryBadge expiresAt={soonest} /> : null}
          </div>

          {r.needsClinicianConfirmation ? (
            <p className="flex items-center gap-1.5 text-sm text-warn">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Compatible alternative group: <strong>clinician must confirm</strong> before transfusion.
            </p>
          ) : null}

          <TrackerTimeline steps={r.timeline} />

          {r.status === "requested" ? <ConfirmWindow bankName={r.bankName} confirmBy={r.confirmBy} /> : null}
          {r.requiresPhoneConfirm && r.status !== "delivered" ? (
            <PhoneCheck reservation={r} pending={phoneConfirm.isPending} onConfirm={() => phoneConfirm.mutate(r.id)} />
          ) : null}
          <TrackerStage
            reservation={r}
            phoneCheckPending={phoneCheckPending}
            advancing={advance.isPending}
            onAdvance={(to) => advance.mutate({ reservationId: r.id, to })}
          />
        </div>
        <div className="h-56 border-t border-line @3xl:h-auto @3xl:min-h-80 @3xl:border-t-0 @3xl:border-l">
          <HospitalMap
            hospital={hospital}
            banks={[{ siteId: r.bankSiteId, label: r.bankName }]}
            focusId={r.bankSiteId}
            arcState={r.status === "picked_up" ? "active" : "suggested"}
            label={`Route from ${r.bankName} to ${hospital.name}`}
            className="size-full"
          />
        </div>
      </div>
    </section>
  );
}

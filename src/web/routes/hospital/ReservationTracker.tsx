import { AlertTriangle, Clock } from "lucide-react";
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
    <section aria-labelledby={`tracker-${r.id}`} className="h-card @container overflow-hidden">
      <p className="sr-only" aria-live="polite" aria-atomic>
        {`${r.bankName}: ${status.label}`}
      </p>
      <div className="grid @3xl:grid-cols-[minmax(0,1fr)_minmax(16rem,21rem)]">
        <div className="space-y-4 p-5">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EAE6E3] pb-3.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#737373]">Fulfilling blood bank</p>
              <h3 id={`tracker-${r.id}`} className="mt-0.5 text-base font-semibold leading-tight text-[#171717]">
                {r.bankName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {r.status === "requested" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FEFCE8] px-2.5 py-1 text-xs font-semibold text-[#A16207]">
                  <Clock className="size-3.5" aria-hidden />
                  Pending bank
                </span>
              ) : null}
              <Badge tone={status.tone} size="md">
                {status.label}
              </Badge>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <AllocationChips units={r.units} />
            {soonest !== null && r.status !== "delivered" ? <ExpiryBadge expiresAt={soonest} /> : null}
          </div>

          {r.needsClinicianConfirmation ? (
            <div className="flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FEFCE8] px-3 py-2 text-xs text-[#A16207]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Compatible alternative group: <strong className="font-semibold">clinician must confirm</strong> before transfusion.
              </span>
            </div>
          ) : null}

          <div className="rounded-xl border border-[#EAE6E3] bg-[#FAF9F6]/70 p-4">
            <TrackerTimeline steps={r.timeline} />
          </div>

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
        <div className="h-56 border-t border-[#EAE6E3] @3xl:h-auto @3xl:min-h-80 @3xl:border-t-0 @3xl:border-l">
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

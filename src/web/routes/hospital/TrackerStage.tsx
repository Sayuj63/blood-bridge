import { CheckCircle2, PackageCheck, Truck } from "lucide-react";
import type { ReservationDTO } from "../../../shared/api";
import { Button } from "../../components/ui/Button";
import { Countdown } from "../../components/ui/Countdown";
import { formatIST } from "../../lib/format";

interface TrackerStageProps {
  reservation: ReservationDTO;
  /** Phone check still outstanding: pickup is blocked. */
  phoneCheckPending: boolean;
  onAdvance: (to: "picked_up" | "delivered") => void;
  advancing: boolean;
}

const MINUTE = 60_000;

/** What happens next once the bank has confirmed: hold expiry and pickup, transit ETA, or delivered. */
export function TrackerStage({ reservation: r, phoneCheckPending, onAdvance, advancing }: TrackerStageProps) {
  const pickedUpAt = r.timeline.find((s) => s.step === "picked_up")?.at ?? null;
  const deliveredAt = r.timeline.find((s) => s.step === "delivered")?.at ?? null;

  if (r.status === "reserved") {
    return (
      <div className="grid gap-3 @md:grid-cols-[1fr_auto] @md:items-end">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-ink-muted">Pickup to ward</dt>
            <dd className="font-numeric text-2xl font-bold">
              ~{r.etaMinutes} <span className="text-sm font-medium text-ink-muted">min</span>
            </dd>
          </div>
          {r.holdExpiresAt !== null ? (
            <div>
              <dt className="text-xs text-ink-muted">Hold expires in</dt>
              <dd className="text-2xl font-bold">
                <Countdown target={r.holdExpiresAt} label="Reserved units are held for" announce={false} warnBelow={15 * MINUTE} criticalBelow={5 * MINUTE} doneLabel="expired" />
              </dd>
              <dd className="font-numeric text-xs text-ink-muted">until {formatIST(r.holdExpiresAt)}</dd>
            </div>
          ) : null}
        </dl>
        <div>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => onAdvance("picked_up")}
            loading={advancing}
            disabled={phoneCheckPending}
            aria-describedby={phoneCheckPending ? `pickup-blocked-${r.id}` : undefined}
            icon={<Truck className="size-4" aria-hidden />}
          >
            Mark picked up
          </Button>
          {phoneCheckPending ? (
            <p id={`pickup-blocked-${r.id}`} className="mt-1 text-xs text-warn">
              Confirm by phone first
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (r.status === "picked_up") {
    return (
      <div className="grid gap-3 @md:grid-cols-[1fr_auto] @md:items-end">
        <div>
          <p className="text-xs text-ink-muted">In transit · arriving in</p>
          <p className="text-2xl font-bold text-bridge">
            {pickedUpAt !== null ? (
              <Countdown target={pickedUpAt + r.etaMinutes * MINUTE} label="Units arrive in" announce={false} doneLabel="arriving now" />
            ) : (
              `~${r.etaMinutes} min`
            )}
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => onAdvance("delivered")} loading={advancing} icon={<PackageCheck className="size-4" aria-hidden />}>
          Mark delivered
        </Button>
      </div>
    );
  }

  if (r.status === "delivered") {
    return (
      <p className="flex items-center gap-2 rounded-(--radius-control) bg-ok-soft p-3 text-sm font-semibold text-ok">
        <CheckCircle2 className="size-5" aria-hidden />
        Delivered to the ward{deliveredAt !== null ? ` at ${formatIST(deliveredAt)}` : ""}.
      </p>
    );
  }

  return null;
}

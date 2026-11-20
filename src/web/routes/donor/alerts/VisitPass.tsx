import { Clock, MapPin, Navigation } from "lucide-react";
import type { DonorAlertDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { cn } from "../../../lib/cn";

/** Everything the donor needs at the bank: address, arrival window and a code to read out at the desk. */
export function VisitPass({ alert, className }: { alert: DonorAlertDTO; className?: string }) {
  const code = alert.confirmationCode ?? "";
  return (
    <div className={cn("overflow-hidden rounded-(--radius-panel) border border-line bg-surface shadow-panel", className)}>
      <div className="border-b border-dashed border-line-strong bg-ok-soft px-4 py-5 text-center">
        <p className="font-label text-xs uppercase tracking-wider text-ok">Show this at the desk</p>
        <p
          className="mt-2 font-mono text-4xl font-bold tracking-[0.18em] text-ink"
          aria-label={`Confirmation code ${code.split("").join(" ")}`}
        >
          {code}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {alert.bloodGroup} · {COMPONENT_LABEL[alert.component]}
        </p>
      </div>
      <dl className="divide-y divide-line px-4">
        <div className="flex gap-3 py-3">
          <dt className="sr-only">Blood bank</dt>
          <MapPin className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
          <dd className="min-w-0">
            <span className="block font-semibold text-ink">{alert.bankName}</span>
            {alert.bankAddress ? <span className="block text-sm text-ink-muted">{alert.bankAddress}</span> : null}
          </dd>
        </div>
        {alert.arrivalWindow ? (
          <div className="flex gap-3 py-3">
            <dt className="sr-only">Suggested arrival</dt>
            <Clock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            <dd>
              <span className="block text-sm text-ink-muted">Suggested arrival</span>
              <span className="block font-numeric font-semibold text-ink">{alert.arrivalWindow}</span>
            </dd>
          </div>
        ) : null}
      </dl>
      {alert.bankAddress ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${alert.bankName}, ${alert.bankAddress}`)}`}
          target="_blank"
          rel="noreferrer"
          className="focus-ring flex min-h-12 items-center justify-center gap-2 border-t border-line text-sm font-semibold text-info hover:bg-surface-2"
        >
          <Navigation className="size-4" aria-hidden />
          Directions
        </a>
      ) : null}
    </div>
  );
}

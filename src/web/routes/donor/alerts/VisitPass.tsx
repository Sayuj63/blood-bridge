import { Check, Clock, MapPin, Navigation } from "lucide-react";
import type { DonorAlertDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { cn } from "../../../lib/cn";

const CHECKLIST = [
  "Eat a light meal and drink plenty of water",
  "Carry a valid photo ID",
  "Keep this code ready for the reception desk",
  "Tell clinical staff about any medicines you take",
] as const;

/** Everything the donor needs at the bank: address, arrival window and a code to read out at the desk. */
export function VisitPass({ alert, className }: { alert: DonorAlertDTO; className?: string }) {
  const code = alert.confirmationCode ?? "";
  return (
    <div className={cn("d-card overflow-hidden", className)}>
      {/* Crimson-tinted Boarding Pass Stub */}
      <div className="relative border-b border-dashed border-[#E6C5CA] bg-gradient-to-br from-[#FFF5F5] via-[#FCEBED]/75 to-[#FFF5F5] px-5 py-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#A82436] shadow-xs ring-1 ring-[#F2D7DB]">
          Show this at the desk
        </span>
        <p
          className="d-num mt-3 font-mono text-4xl font-extrabold tracking-[0.2em] text-[#171717]"
          aria-label={`Confirmation code ${code.split("").join(" ")}`}
        >
          {code}
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#C93245] px-3 py-1 text-xs font-bold text-white">
          <span className="d-num">{alert.bloodGroup.replace("-", "−")}</span>
          <span className="opacity-60">·</span>
          <span>{COMPONENT_LABEL[alert.component]}</span>
        </div>
      </div>

      {/* Bank & Arrival Info */}
      <dl className="divide-y divide-[#EAE6E3] px-4">
        <div className="flex items-start gap-3 py-3.5">
          <dt className="sr-only">Blood bank</dt>
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <MapPin className="size-4" aria-hidden />
          </span>
          <dd className="min-w-0">
            <span className="block text-sm font-bold text-[#171717]">{alert.bankName}</span>
            {alert.bankAddress ? <span className="mt-0.5 block text-xs text-[#737373]">{alert.bankAddress}</span> : null}
          </dd>
        </div>
        {alert.arrivalWindow ? (
          <div className="flex items-start gap-3 py-3.5">
            <dt className="sr-only">Suggested arrival</dt>
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <Clock className="size-4" aria-hidden />
            </span>
            <dd>
              <span className="block text-xs text-[#737373]">Suggested arrival window</span>
              <span className="d-num mt-0.5 block text-sm font-bold text-[#171717]">{alert.arrivalWindow}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {/* Before you go checklist */}
      <div className="border-t border-[#EAE6E3] bg-[#FAF9F6] px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#737373]">Before you go</p>
        <ul className="mt-2 space-y-1.5">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-[#171717]">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#ECFDF3] text-[#15803D]">
                <Check className="size-2.5" aria-hidden />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Directions CTA */}
      {alert.bankAddress ? (
        <div className="border-t border-[#EAE6E3] bg-white p-3">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${alert.bankName}, ${alert.bankAddress}`)}`}
            target="_blank"
            rel="noreferrer"
            className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C93245] text-sm font-bold text-white shadow-xs transition-colors hover:bg-[#A82436]"
          >
            <Navigation className="size-4" aria-hidden />
            Open Directions in Maps
          </a>
        </div>
      ) : null}
    </div>
  );
}

import { CheckCircle2, CircleSlash, ShieldCheck } from "lucide-react";
import type { DonorAlertDTO, DonorDTO } from "../../../../shared/api";
import { POLICY } from "../../../../shared/domain";
import { inQuietHours, localHour } from "../../../../shared/eligibility";
import { cn } from "../../../lib/cn";
import { DAY_MS, formatDate, hourLabel } from "../copy";
import { useClock } from "../useClock";

/**
 * The same rules the bank's targeting applies, shown from the donor's side,
 * so they can see exactly why they will (or won't) be alerted.
 */
export function AlertReach({ donor, alerts }: { donor: DonorDTO; alerts: DonorAlertDTO[] }) {
  const now = useClock(60_000);
  const quiet = inQuietHours(donor.quietHoursStart, donor.quietHoursEnd, localHour(now));
  const thisWeek = alerts.filter((a) => a.createdAt > now - 7 * DAY_MS).length;
  const hasQuietHours = donor.quietHoursStart !== null && donor.quietHoursEnd !== null;

  const rules = [
    { ok: donor.consentAlerts, label: donor.consentAlerts ? "Alerts are switched on" : "Alerts are switched off" },
    {
      ok: donor.consentLocation,
      label: donor.consentLocation
        ? "Approximate neighbourhood is shared"
        : "Area isn't shared, so nearby banks can't match you",
    },
    {
      ok: donor.eligible,
      label: donor.eligible
        ? "Eligible to donate right now"
        : `Resting until ${donor.eligibleFrom ? formatDate(donor.eligibleFrom) : "your next eligible date"}`,
    },
    {
      ok: !quiet,
      label: quiet
        ? `Quiet hours active (${hourLabel(donor.quietHoursStart ?? 0)}–${hourLabel(donor.quietHoursEnd ?? 0)})`
        : hasQuietHours
          ? `Outside quiet hours (${hourLabel(donor.quietHoursStart ?? 0)}–${hourLabel(donor.quietHoursEnd ?? 0)})`
          : "No quiet hours set",
    },
    { ok: thisWeek < donor.maxAlertsPerWeek, label: `${thisWeek} of ${donor.maxAlertsPerWeek} weekly alerts used` },
  ];

  const passed = rules.filter((r) => r.ok).length;
  const pct = Math.round((passed / rules.length) * 100);

  return (
    <section aria-labelledby="reach-title" className="d-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="reach-title" className="d-display text-sm font-bold text-[#171717]">
              Alert Eligibility Checks
            </h2>
            <p className="text-xs text-[#737373]">Within {POLICY.donorAlertRadiusKm} km &amp; all rules must pass</p>
          </div>
        </div>
        <span
          className={cn(
            "d-num shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold",
            passed === rules.length ? "bg-[#ECFDF3] text-[#15803D]" : "bg-[#FFF7ED] text-[#B45309]",
          )}
        >
          {passed}/{rules.length}
        </span>
      </div>

      {/* Visual Progress Bar */}
      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F4D3D8]/60">
        <div
          className={cn("h-full rounded-full transition-all duration-300", passed === rules.length ? "bg-[#15803D]" : "bg-[#C93245]")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-3.5 space-y-2">
        {rules.map((r) => (
          <li
            key={r.label}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium",
              r.ok ? "border-[#EAE6E3] bg-[#FAF9F6] text-[#171717]" : "border-[#F2D7DB] bg-[#FFF5F5] text-[#737373]",
            )}
          >
            {r.ok ? (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ECFDF3] text-[#15803D]">
                <CheckCircle2 className="size-3.5" aria-label="Yes" />
              </span>
            ) : (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#FCEBED] text-[#A82436]">
                <CircleSlash className="size-3.5" aria-label="No" />
              </span>
            )}
            <span className="leading-snug">{r.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

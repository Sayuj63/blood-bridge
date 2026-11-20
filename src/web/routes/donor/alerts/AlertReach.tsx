import { CheckCircle2, CircleSlash } from "lucide-react";
import type { DonorAlertDTO, DonorDTO } from "../../../../shared/api";
import { POLICY } from "../../../../shared/domain";
import { inQuietHours, localHour } from "../../../../shared/eligibility";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { useClock } from "../useClock";
import { DAY_MS, formatDate, hourLabel } from "../copy";

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
      label: donor.consentLocation ? "Your approximate area is shared" : "Your area isn't shared, so we can't tell which banks are near you",
    },
    {
      ok: donor.eligible,
      label: donor.eligible ? "You're eligible to donate" : `You're resting until ${donor.eligibleFrom ? formatDate(donor.eligibleFrom) : "your next eligible date"}`,
    },
    {
      ok: !quiet,
      label: quiet
        ? `Quiet hours now (${hourLabel(donor.quietHoursStart ?? 0)}–${hourLabel(donor.quietHoursEnd ?? 0)})`
        : hasQuietHours
          ? `Outside your quiet hours (${hourLabel(donor.quietHoursStart ?? 0)}–${hourLabel(donor.quietHoursEnd ?? 0)})`
          : "No quiet hours set",
    },
    { ok: thisWeek < donor.maxAlertsPerWeek, label: `${thisWeek} of ${donor.maxAlertsPerWeek} alerts used this week` },
  ];

  return (
    <Card as="section" aria-labelledby="reach-title">
      <CardHeader
        id="reach-title"
        title="When we can alert you"
        description={`Only when your group is needed within ${POLICY.donorAlertRadiusKm} km and all of these are true.`}
      />
      <CardBody>
        <ul className="space-y-2.5">
          {rules.map((r) => (
            <li key={r.label} className="flex items-start gap-2.5 text-sm">
              {r.ok ? (
                <CheckCircle2 className="mt-px size-4 shrink-0 text-ok" aria-label="Yes" />
              ) : (
                <CircleSlash className="mt-px size-4 shrink-0 text-ink-faint" aria-label="No" />
              )}
              <span className={r.ok ? "text-ink" : "text-ink-muted"}>{r.label}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

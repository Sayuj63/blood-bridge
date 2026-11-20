import { POLICY, type BloodGroup, type GeoPoint } from "./domain";
import { haversineKm } from "./geo";

/**
 * Donor eligibility and alert targeting (PRD §6.3).
 * The interval comes from blood-bank configuration — it is NOT a medical rule.
 * Real intervals and criteria must be checked against local guidelines.
 */

export interface EligibilityRules {
  /** Minimum days between whole-blood donations, as configured by the blood bank. */
  minDaysBetweenDonations: number;
}

export const DEMO_ELIGIBILITY_RULES: EligibilityRules = { minDaysBetweenDonations: 90 };

const DAY = 86_400_000;

export interface Eligibility {
  eligible: boolean;
  eligibleFrom: number | null;
}

export function eligibility(lastDonationAt: number | null, now: number, rules: EligibilityRules): Eligibility {
  if (lastDonationAt === null) return { eligible: true, eligibleFrom: null };
  const eligibleFrom = lastDonationAt + rules.minDaysBetweenDonations * DAY;
  return { eligible: now >= eligibleFrom, eligibleFrom: now >= eligibleFrom ? null : eligibleFrom };
}

export interface DonorProfile {
  id: string;
  bloodGroup: BloodGroup;
  location: GeoPoint;
  lastDonationAt: number | null;
  consentAlerts: boolean;
  consentLocation: boolean;
  optedOut: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  maxAlertsPerWeek: number;
  alertsThisWeek: number;
}

export type SkipReason = "group" | "consent" | "ineligible" | "out_of_range" | "quiet_hours" | "weekly_cap";

export interface TargetingResult {
  eligible: { donorId: string; distanceKm: number }[];
  skipped: Record<SkipReason, number>;
}

/** Hour of day in IST (the demo city), so quiet hours behave the same regardless of server timezone. */
export function localHour(now: number): number {
  return new Date(now + 5.5 * 3_600_000).getUTCHours();
}

export function inQuietHours(start: number | null, end: number | null, hour: number): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * A donor is alerted only when ALL are true: group matches, eligible, within
 * range, consent on — plus quiet hours and a weekly cap to prevent spam.
 * Returns counts per skip reason so the operator sees the funnel *before* sending.
 */
export function targetDonors(
  donors: DonorProfile[],
  need: { bloodGroup: BloodGroup; origin: GeoPoint; radiusKm?: number },
  now: number,
  rules: EligibilityRules,
): TargetingResult {
  const radius = need.radiusKm ?? POLICY.donorAlertRadiusKm;
  const skipped: Record<SkipReason, number> = {
    group: 0,
    consent: 0,
    ineligible: 0,
    out_of_range: 0,
    quiet_hours: 0,
    weekly_cap: 0,
  };
  const eligibleDonors: TargetingResult["eligible"] = [];
  const hour = localHour(now);

  for (const d of donors) {
    if (d.bloodGroup !== need.bloodGroup) {
      skipped.group++;
      continue;
    }
    if (d.optedOut || !d.consentAlerts || !d.consentLocation) {
      skipped.consent++;
      continue;
    }
    if (!eligibility(d.lastDonationAt, now, rules).eligible) {
      skipped.ineligible++;
      continue;
    }
    const distanceKm = haversineKm(d.location, need.origin);
    if (distanceKm > radius) {
      skipped.out_of_range++;
      continue;
    }
    if (inQuietHours(d.quietHoursStart, d.quietHoursEnd, hour)) {
      skipped.quiet_hours++;
      continue;
    }
    if (d.alertsThisWeek >= d.maxAlertsPerWeek) {
      skipped.weekly_cap++;
      continue;
    }
    eligibleDonors.push({ donorId: d.id, distanceKm: Math.round(distanceKm * 10) / 10 });
  }

  eligibleDonors.sort((a, b) => a.distanceKm - b.distanceKm);
  return { eligible: eligibleDonors, skipped };
}

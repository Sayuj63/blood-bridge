import { describe, expect, it } from "vitest";
import { compatibleSources, isCompatible } from "../src/shared/compatibility";
import { DEMO_ELIGIBILITY_RULES, eligibility, inQuietHours, targetDonors, type DonorProfile } from "../src/shared/eligibility";
import { forecastSite, simulateCell, type ForecastSite } from "../src/shared/forecast";
import { haversineKm } from "../src/shared/geo";
import { rankSites, type CandidateSite } from "../src/shared/ranking";
import { planTransfers } from "../src/shared/transfers";

const NOW = Date.UTC(2026, 10, 20, 6, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SION = { lat: 19.039, lng: 72.8619 };

describe("compatibility (demo logic)", () => {
  it("treats O- as universal red-cell donor and AB+ as universal recipient", () => {
    for (const r of ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] as const) {
      expect(isCompatible("O-", r, "red_cells")).toBe(true);
    }
    expect(compatibleSources("AB+", "red_cells")).toHaveLength(8);
    expect(compatibleSources("O-", "red_cells").map((s) => s.group)).toEqual(["O-"]);
  });

  it("reverses ABO for plasma — AB plasma is universal, O plasma only for O", () => {
    expect(isCompatible("AB-", "O+", "plasma")).toBe(true);
    expect(isCompatible("O+", "A+", "plasma")).toBe(false);
    expect(isCompatible("O+", "O-", "plasma")).toBe(true);
  });

  it("keeps whole blood ABO-identical and protects Rh- recipients", () => {
    expect(isCompatible("O-", "A+", "whole_blood")).toBe(false);
    expect(isCompatible("A-", "A+", "whole_blood")).toBe(true);
    expect(isCompatible("A+", "A-", "whole_blood")).toBe(false);
  });

  it("gives Rh- platelet recipients only Rh- platelets", () => {
    expect(compatibleSources("O-", "platelets").every((s) => s.group.endsWith("-"))).toBe(true);
  });

  it("lists the exact match first", () => {
    expect(compatibleSources("B+", "red_cells")[0]).toEqual({ group: "B+", exact: true });
  });
});

describe("ranking", () => {
  const unit = (id: string, g: "O-" | "O+", expiresInH: number) => ({ id, bloodGroup: g, component: "platelets" as const, expiresAt: NOW + expiresInH * HOUR });
  const site = (siteId: string, lat: number, units: CandidateSite["units"], syncAgoMin = 5): CandidateSite => ({
    siteId,
    name: siteId,
    location: { lat, lng: 72.86 },
    lastSyncAt: NOW - syncAgoMin * 60_000,
    units,
  });
  const req = { bloodGroup: "O-" as const, component: "platelets" as const, unitsNeeded: 2, neededBy: NOW + 2 * HOUR, origin: SION, now: NOW };

  it("gates on compatibility — sites with only incompatible stock are not listed", () => {
    const out = rankSites(req, [site("A", 19.04, [unit("1", "O+", 50), unit("2", "O+", 50)])]);
    expect(out).toHaveLength(0);
  });

  it("drops units that expire before they are needed", () => {
    const out = rankSites(req, [site("A", 19.04, [unit("1", "O-", 3), unit("2", "O-", 50)])]);
    expect(out[0].allocation.map((u) => u.id)).toEqual(["2"]);
    expect(out[0].coversRequest).toBe(false);
  });

  it("ranks a nearer site that covers the request above a closer partial one", () => {
    const out = rankSites(req, [
      site("partial", 19.04, [unit("1", "O-", 50)]),
      site("full", 19.06, [unit("2", "O-", 50), unit("3", "O-", 60)]),
    ]);
    expect(out.map((o) => o.siteId)).toEqual(["full", "partial"]);
  });

  it("prefers the closer, fresher site among equals and flags stale data", () => {
    const units = (p: string) => [unit(`${p}1`, "O-", 50), unit(`${p}2`, "O-", 60)];
    const out = rankSites(req, [site("far", 19.2, units("f")), site("stale", 19.045, units("s"), 120), site("near", 19.045, units("n"))]);
    expect(out[0].siteId).toBe("near");
    expect(out.find((o) => o.siteId === "stale")!.stale).toBe(true);
  });

  it("allocates oldest in-date units first (FIFO)", () => {
    const out = rankSites({ ...req, unitsNeeded: 1 }, [site("A", 19.04, [unit("young", "O-", 100), unit("old", "O-", 20)])]);
    expect(out[0].allocation[0].id).toBe("old");
  });
});

describe("forecast", () => {
  it("counts units that expire before their turn as waste", () => {
    // 1 unit/hour demand; 3 units, one expiring in 30 min before anything can use it.
    const units = [
      { id: "a", bloodGroup: "O+" as const, component: "red_cells" as const, expiresAt: NOW + 0.5 * HOUR },
      { id: "b", bloodGroup: "O+" as const, component: "red_cells" as const, expiresAt: NOW + 10 * HOUR },
      { id: "c", bloodGroup: "O+" as const, component: "red_cells" as const, expiresAt: NOW + 10 * HOUR },
    ];
    const out = simulateCell(units, 1, NOW, 72);
    expect(out.expectedWaste).toBe(1);
    expect(out.stockoutHours).toBe(2);
    expect(out.shortfall).toBe(70);
  });

  it("reports surplus and no stockout when stock outlasts the horizon", () => {
    const units = Array.from({ length: 10 }, (_, i) => ({ id: `u${i}`, bloodGroup: "A+" as const, component: "plasma" as const, expiresAt: NOW + 300 * DAY }));
    const out = simulateCell(units, 0.05, NOW, 72);
    expect(out.stockoutHours).toBeNull();
    expect(out.surplus).toBe(7); // used at 20h, 40h, 60h — the 4th turn (80h) is past the horizon
  });

  it("multiplies demand near a surge epicentre", () => {
    const site: ForecastSite = {
      siteId: "S",
      name: "S",
      location: SION,
      units: Array.from({ length: 24 }, (_, i) => ({ id: `u${i}`, bloodGroup: "O+" as const, component: "red_cells" as const, expiresAt: NOW + 20 * DAY })),
      baselinePerDay: { "O+|red_cells": 12 },
    };
    const calm = forecastSite(site, null, NOW)[0];
    const surge = forecastSite(site, { kind: "flood", epicenter: SION, radiusKm: 5, multipliers: { "O+|red_cells": 4 } }, NOW)[0];
    expect(calm.stockoutHours).toBe(48);
    expect(surge.stockoutHours).toBe(12);
  });
});

describe("expiry-aware transfers", () => {
  const plt = (id: string, expiresInH: number) => ({ id, bloodGroup: "O+" as const, component: "platelets" as const, expiresAt: NOW + expiresInH * HOUR });
  const quiet: ForecastSite = {
    siteId: "QUIET",
    name: "Quiet",
    location: { lat: 19.23, lng: 72.85 },
    units: [plt("q1", 30), plt("q2", 32), plt("q3", 34), plt("q4", 36)],
    baselinePerDay: { "O+|platelets": 0.5 },
  };
  const busy: ForecastSite = {
    siteId: "BUSY",
    name: "Busy",
    location: { lat: 19.07, lng: 72.88 },
    units: [plt("b1", 40)],
    baselinePerDay: { "O+|platelets": 12 },
  };

  it("moves soon-to-expire units to a site forecast short, and reduces both waste and shortfall", () => {
    const plan = planTransfers([quiet, busy], null, NOW);
    expect(plan.proposals).toHaveLength(1);
    const [p] = plan.proposals;
    expect(p.fromSiteId).toBe("QUIET");
    expect(p.toSiteId).toBe("BUSY");
    expect(p.rescuedFromExpiry).toBeGreaterThan(0);
    expect(plan.after.expectedWaste).toBeLessThan(plan.before.expectedWaste);
    expect(plan.after.shortfall).toBeLessThan(plan.before.shortfall);
  });

  it("never moves locked (in-transit) units", () => {
    const locked = { ...quiet, units: quiet.units.map((u) => ({ ...u, locked: true })) };
    expect(planTransfers([locked, busy], null, NOW).proposals).toHaveLength(0);
  });
});

describe("donor targeting", () => {
  const base: DonorProfile = {
    id: "d",
    bloodGroup: "O-",
    location: SION,
    lastDonationAt: NOW - 200 * DAY,
    consentAlerts: true,
    consentLocation: true,
    optedOut: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    maxAlertsPerWeek: 2,
    alertsThisWeek: 0,
  };
  const need = { bloodGroup: "O-" as const, origin: SION };

  it("alerts only when group, consent, eligibility, range, quiet hours and weekly cap all pass", () => {
    const donors: DonorProfile[] = [
      { ...base, id: "ok" },
      { ...base, id: "group", bloodGroup: "O+" },
      { ...base, id: "consent", consentAlerts: false },
      { ...base, id: "recent", lastDonationAt: NOW - 10 * DAY },
      { ...base, id: "far", location: { lat: 19.3, lng: 72.86 } },
      { ...base, id: "capped", alertsThisWeek: 2 },
    ];
    const out = targetDonors(donors, need, NOW, DEMO_ELIGIBILITY_RULES);
    expect(out.eligible.map((e) => e.donorId)).toEqual(["ok"]);
    expect(out.skipped).toMatchObject({ group: 1, consent: 1, ineligible: 1, out_of_range: 1, weekly_cap: 1 });
  });

  it("computes the next eligible date from the configured interval", () => {
    const e = eligibility(NOW - 30 * DAY, NOW, DEMO_ELIGIBILITY_RULES);
    expect(e.eligible).toBe(false);
    expect(e.eligibleFrom).toBe(NOW + 60 * DAY);
  });

  it("handles quiet hours that wrap past midnight", () => {
    expect(inQuietHours(23, 7, 2)).toBe(true);
    expect(inQuietHours(23, 7, 12)).toBe(false);
  });
});

describe("geo", () => {
  it("measures Sion → Kurla at roughly 4–5 km", () => {
    const d = haversineKm(SION, { lat: 19.0726, lng: 72.8845 });
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(5);
  });
});

import { describe, expect, it } from "vitest";
import type { BloodGroup } from "../src/shared/domain";
import { rankSites, type CandidateSite, type RankedOption } from "../src/shared/ranking";
import { planSplit } from "../src/shared/split";

const NOW = Date.UTC(2026, 10, 20, 6, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SION = { lat: 19.039, lng: 72.8619 };

let seq = 0;
function site(siteId: string, lat: number, groups: BloodGroup[], opts: { syncedMinAgo?: number } = {}): CandidateSite {
  return {
    siteId,
    name: siteId.toUpperCase(),
    location: { lat, lng: 72.86 },
    lastSyncAt: NOW - (opts.syncedMinAgo ?? 5) * 60_000,
    units: groups.map((g) => ({ id: `U${++seq}`, bloodGroup: g, component: "red_cells" as const, expiresAt: NOW + 10 * DAY })),
  };
}

function rank(group: BloodGroup, unitsNeeded: number, sites: CandidateSite[]): RankedOption[] {
  return rankSites({ bloodGroup: group, component: "red_cells", unitsNeeded, neededBy: NOW + HOUR, origin: SION, now: NOW }, sites);
}

describe("planSplit", () => {
  it("uses a single bank when one bank covers the request", () => {
    const options = rank("O-", 3, [site("near", 19.04, ["O-"]), site("big", 19.1, ["O-", "O-", "O-", "O-"])]);
    const plan = planSplit(options, 3, "O-");
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0]).toMatchObject({ siteId: "big", units: 3, matchType: "exact" });
    expect(plan.covered).toBe(3);
    expect(plan.shortBy).toBe(0);
  });

  it("splits scattered stock across the fewest banks (largest contribution first)", () => {
    // Real Mumbai shape: one bank with 2, several with 1.
    const options = rank("O-", 3, [
      site("one-a", 19.04, ["O-"]),
      site("two", 19.08, ["O-", "O-"]),
      site("one-b", 19.05, ["O-"]),
    ]);
    const plan = planSplit(options, 3, "O-");
    expect(plan.legs.map((l) => [l.siteId, l.units])).toEqual([
      ["two", 2],
      ["one-a", 1],
    ]);
    expect(plan.covered).toBe(3);
    expect(plan.shortBy).toBe(0);
    expect(plan.maxEtaMinutes).toBe(Math.max(...plan.legs.map((l) => l.etaMinutes)));
  });

  it("prefers exact-group legs over larger compatible ones", () => {
    // A+ patient: B has 2 O- (compatible), C has 1 A+ (exact), D has 1 A+ (exact).
    const options = rank("A+", 3, [site("compat", 19.04, ["O-", "O-"]), site("exact-c", 19.05, ["A+"]), site("exact-d", 19.06, ["A+"])]);
    const plan = planSplit(options, 3, "A+");
    expect(plan.legs.slice(0, 2).every((l) => l.matchType === "exact")).toBe(true);
    expect(plan.legs.at(-1)).toMatchObject({ siteId: "compat", units: 1, matchType: "compatible" });
    expect(plan.covered).toBe(3);
  });

  it("reports partial coverage when the city does not hold enough", () => {
    const options = rank("O-", 5, [site("a", 19.04, ["O-"]), site("b", 19.06, ["O-", "O-"])]);
    const plan = planSplit(options, 5, "O-");
    expect(plan.legs).toHaveLength(2);
    expect(plan.covered).toBe(3);
    expect(plan.shortBy).toBe(2);
  });

  it("returns an empty plan for no options", () => {
    expect(planSplit([], 3)).toEqual({ legs: [], covered: 0, shortBy: 3, maxEtaMinutes: 0 });
  });

  it("prefers fresh data over stale on equal contribution", () => {
    const options = rank("O-", 2, [site("stale", 19.04, ["O-"], { syncedMinAgo: 600 }), site("fresh", 19.07, ["O-"]), site("fresh2", 19.09, ["O-"])]);
    const plan = planSplit(options, 2, "O-");
    expect(plan.legs.map((l) => l.siteId)).not.toContain("stale");
  });
});

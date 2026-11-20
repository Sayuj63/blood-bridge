import { compatibleSources } from "./compatibility";
import { POLICY, type BloodGroup, type Component, type GeoPoint } from "./domain";
import { etaMinutes, haversineKm } from "./geo";

export interface CandidateUnit {
  id: string;
  bloodGroup: BloodGroup;
  component: Component;
  expiresAt: number;
}

export interface CandidateSite {
  siteId: string;
  name: string;
  location: GeoPoint;
  lastSyncAt: number;
  units: CandidateUnit[];
}

export interface RankRequest {
  bloodGroup: BloodGroup;
  component: Component;
  unitsNeeded: number;
  neededBy: number;
  origin: GeoPoint;
  now: number;
}

export interface RankedOption {
  siteId: string;
  name: string;
  rank: number;
  distanceKm: number;
  etaMinutes: number;
  /** Units the system suggests allocating — oldest in-date first (FIFO), exact match first. */
  allocation: CandidateUnit[];
  unitsAvailable: number;
  exactAvailable: number;
  coversRequest: boolean;
  matchType: "exact" | "compatible" | "mixed";
  /** True whenever any suggested unit is not an exact group match. */
  needsClinicianConfirmation: boolean;
  alternativeGroups: BloodGroup[];
  freshnessMinutes: number;
  stale: boolean;
  soonestExpiryHours: number;
  score: number;
  scoreBreakdown: { travel: number; freshness: number; shelfLife: number; coverage: number };
}

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Weights for the within-tier score (lower is better). Tune later, per PRD §8. */
export const RANK_WEIGHTS = { travel: 0.5, freshness: 0.25, shelfLife: 0.15, coverage: 0.1 } as const;

/**
 * Rank sites for a request.
 * 1. Compatibility gate — sites with no compatible, in-date unit are not listed.
 * 2. Tier — sites that can cover the request with exact-match units come first.
 * 3. Weighted score — travel time, data freshness, shelf life, coverage.
 */
export function rankSites(req: RankRequest, sites: CandidateSite[]): RankedOption[] {
  const sources = compatibleSources(req.bloodGroup, req.component);
  const sourceOrder = new Map(sources.map((s, i) => [s.group, i]));
  // A unit is usable only if it is still in date when it is needed (plus a small buffer).
  const usableAfter = Math.max(req.now, req.neededBy) + 2 * HOUR;

  const options = sites.flatMap((site) => {
    const usable = site.units
      .filter((u) => u.component === req.component && sourceOrder.has(u.bloodGroup) && u.expiresAt > usableAfter)
      .sort((a, b) => sourceOrder.get(a.bloodGroup)! - sourceOrder.get(b.bloodGroup)! || a.expiresAt - b.expiresAt);
    if (usable.length === 0) return [];

    const allocation = usable.slice(0, req.unitsNeeded);
    const exactAvailable = usable.filter((u) => u.bloodGroup === req.bloodGroup).length;
    const allocatedExact = allocation.filter((u) => u.bloodGroup === req.bloodGroup).length;
    const matchType: RankedOption["matchType"] =
      allocatedExact === allocation.length ? "exact" : allocatedExact === 0 ? "compatible" : "mixed";

    const eta = etaMinutes(req.origin, site.location);
    const freshnessMinutes = Math.max(0, Math.round((req.now - site.lastSyncAt) / MINUTE));
    const soonestExpiryHours = Math.round((Math.min(...allocation.map((u) => u.expiresAt)) - req.now) / HOUR);

    const breakdown = {
      travel: Math.min(eta / 60, 1),
      freshness: Math.min(freshnessMinutes / (POLICY.staleAfterMinutes * 2), 1),
      // Older in-date units are preferred (FIFO) so short remaining shelf life scores *better*.
      shelfLife: Math.min(soonestExpiryHours / (24 * 30), 1),
      coverage: 1 - allocation.length / req.unitsNeeded,
    };
    const score =
      breakdown.travel * RANK_WEIGHTS.travel +
      breakdown.freshness * RANK_WEIGHTS.freshness +
      breakdown.shelfLife * RANK_WEIGHTS.shelfLife +
      breakdown.coverage * RANK_WEIGHTS.coverage;

    return [
      {
        siteId: site.siteId,
        name: site.name,
        rank: 0,
        distanceKm: Math.round(haversineKm(req.origin, site.location) * 10) / 10,
        etaMinutes: eta,
        allocation,
        unitsAvailable: usable.length,
        exactAvailable,
        coversRequest: allocation.length >= req.unitsNeeded,
        matchType,
        needsClinicianConfirmation: matchType !== "exact",
        alternativeGroups: [...new Set(allocation.filter((u) => u.bloodGroup !== req.bloodGroup).map((u) => u.bloodGroup))],
        freshnessMinutes,
        stale: freshnessMinutes > POLICY.staleAfterMinutes,
        soonestExpiryHours,
        score: Math.round(score * 1000) / 1000,
        scoreBreakdown: breakdown,
      } satisfies RankedOption,
    ];
  });

  const tier = (o: RankedOption) => (o.coversRequest ? 0 : 2) + (o.matchType === "exact" ? 0 : 1);
  return options
    .sort((a, b) => tier(a) - tier(b) || a.score - b.score)
    .map((o, i) => ({ ...o, rank: i + 1 }));
}

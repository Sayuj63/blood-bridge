import type { RankedOption } from "./ranking";

/** One bank's share of a split reservation. */
export interface SplitLeg {
  siteId: string;
  name: string;
  /** Rank of this bank in the search results. */
  rank: number;
  units: number;
  etaMinutes: number;
  /** Match type of the units this leg would take (exact-group units are taken first). */
  matchType: RankedOption["matchType"];
  stale: boolean;
}

export interface SplitPlan {
  legs: SplitLeg[];
  /** Units the plan covers (≤ unitsNeeded). */
  covered: number;
  /** Units no bank can supply right now (0 when fully covered). */
  shortBy: number;
  /** Slowest leg's ETA: when the last bag should reach the ward. 0 for an empty plan. */
  maxEtaMinutes: number;
}

function legFor(option: RankedOption, take: number, bloodGroup: string | undefined): SplitLeg {
  const slice = option.allocation.slice(0, take);
  const exact = bloodGroup === undefined
    ? Math.min(take, option.exactAvailable)
    : slice.filter((u) => u.bloodGroup === bloodGroup).length;
  return {
    siteId: option.siteId,
    name: option.name,
    rank: option.rank,
    units: take,
    etaMinutes: option.etaMinutes,
    matchType: exact === take ? "exact" : exact === 0 ? "compatible" : "mixed",
    stale: option.stale,
  };
}

/**
 * Cover a request across as few banks as possible.
 * - If one ranked bank covers every unit, the plan is that single bank (the best-ranked one).
 * - Otherwise, greedily pick, at each step, the bank whose contribution is all exact-group
 *   first, then the largest contribution (fewer banks), then fresh data, then search rank.
 * `options` are expected to come from `rankSites` for the same `unitsNeeded`.
 */
export function planSplit(options: RankedOption[], unitsNeeded: number, bloodGroup?: string): SplitPlan {
  const need = Math.max(0, Math.floor(unitsNeeded));
  const usable = options.filter((o) => o.allocation.length > 0);
  const legs: SplitLeg[] = [];

  const single = usable.find((o) => o.allocation.length >= need);
  if (need > 0 && single) {
    legs.push(legFor(single, need, bloodGroup));
  } else {
    const pool = [...usable];
    let remaining = need;
    while (remaining > 0 && pool.length > 0) {
      const candidates = pool.map((o) => ({ o, leg: legFor(o, Math.min(remaining, o.allocation.length), bloodGroup) }));
      candidates.sort(
        (a, b) =>
          Number(b.leg.matchType === "exact") - Number(a.leg.matchType === "exact") ||
          b.leg.units - a.leg.units ||
          Number(a.leg.stale) - Number(b.leg.stale) ||
          a.o.rank - b.o.rank,
      );
      const pick = candidates[0];
      legs.push(pick.leg);
      remaining -= pick.leg.units;
      pool.splice(pool.indexOf(pick.o), 1);
    }
    // Legs stay in pick order: reserving them in this order (each `reserve` takes the
    // remaining units, up to what the bank holds) reproduces exactly this plan.
  }

  const covered = legs.reduce((n, l) => n + l.units, 0);
  return {
    legs,
    covered,
    shortBy: Math.max(0, need - covered),
    maxEtaMinutes: legs.reduce((m, l) => Math.max(m, l.etaMinutes), 0),
  };
}

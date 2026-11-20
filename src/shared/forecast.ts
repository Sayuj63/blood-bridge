import type { BloodGroup, Component, GeoPoint, SurgeKind } from "./domain";
import { BLOOD_GROUPS, COMPONENTS, POLICY } from "./domain";
import { haversineKm } from "./geo";

/**
 * Rule-based forecast (PRD §8): recent demand average × surge multiplier.
 * Deliberately simple and explainable — every number on the dashboard can be
 * traced back to "units on hand ÷ hourly demand, minus what expires first".
 */

const HOUR = 3_600_000;

export interface ForecastUnit {
  id: string;
  bloodGroup: BloodGroup;
  component: Component;
  expiresAt: number;
  /** Offered for transfer by its site — treated as spare, not local supply. */
  offered?: boolean;
  /** Already committed elsewhere (e.g. in transit) — counts as supply but cannot be moved again. */
  locked?: boolean;
}

export interface ForecastSite {
  siteId: string;
  name: string;
  location: GeoPoint;
  units: ForecastUnit[];
  /** Baseline demand in units/day, keyed `${group}|${component}`. Missing keys mean zero demand. */
  baselinePerDay: Record<string, number>;
}

export interface SurgeScenario {
  kind: SurgeKind;
  epicenter: GeoPoint;
  radiusKm: number;
  /** Demand multipliers keyed `${group}|${component}` or `*|${component}` for every group. */
  multipliers: Record<string, number>;
}

export interface CellForecast {
  siteId: string;
  bloodGroup: BloodGroup;
  component: Component;
  onHand: number;
  demandPerHour: number;
  /** Hours until the last usable unit is consumed; null when stock outlasts the horizon. */
  stockoutHours: number | null;
  /** Units that will expire unused within the horizon at current demand. */
  expectedWaste: number;
  /** Units of demand inside the horizon that local stock cannot meet. */
  shortfall: number;
  /** Units still on the shelf, in date, at the end of the horizon. */
  surplus: number;
  /** IDs of units projected to expire unused, soonest first — candidates for transfer. */
  wasteUnitIds: string[];
  /** IDs of units not needed locally within the horizon (excludes waste) — also transferable. */
  surplusUnitIds: string[];
}

export const cellKey = (g: BloodGroup | "*", c: Component) => `${g}|${c}`;

/** Surge influence: full inside the radius, fading linearly to zero at 2× radius. */
export function surgeInfluence(surge: SurgeScenario, at: GeoPoint): number {
  const d = haversineKm(surge.epicenter, at);
  if (d <= surge.radiusKm) return 1;
  return Math.max(0, 1 - (d - surge.radiusKm) / surge.radiusKm);
}

export function surgeMultiplier(surge: SurgeScenario | null, at: GeoPoint, g: BloodGroup, c: Component): number {
  if (!surge) return 1;
  const raw = surge.multipliers[cellKey(g, c)] ?? surge.multipliers[cellKey("*", c)] ?? 1;
  return 1 + (raw - 1) * surgeInfluence(surge, at);
}

/**
 * Simulate FIFO consumption of one (site, group, component) cell.
 * Units are used soonest-expiry first at a constant hourly rate; a unit that
 * expires before its turn comes is counted as waste.
 */
export function simulateCell(
  units: ForecastUnit[],
  demandPerHour: number,
  now: number,
  horizonHours: number,
): Omit<CellForecast, "siteId" | "bloodGroup" | "component"> {
  const sorted = [...units].sort((a, b) => a.expiresAt - b.expiresAt);
  const horizonEnd = now + horizonHours * HOUR;
  const wasteUnitIds: string[] = [];
  const surplusUnitIds: string[] = [];
  let consumed = 0;
  // True once some in-date unit is still on the shelf when the horizon ends — i.e. no stockout.
  let stockRemains = false;

  for (const unit of sorted) {
    if (unit.offered) {
      if (unit.expiresAt <= horizonEnd) wasteUnitIds.push(unit.id);
      else surplusUnitIds.push(unit.id);
      continue;
    }
    const turnAt = demandPerHour > 0 ? now + ((consumed + 1) / demandPerHour) * HOUR : Number.POSITIVE_INFINITY;
    if (turnAt > horizonEnd) {
      // Not needed locally within the horizon.
      stockRemains = true;
      if (unit.expiresAt <= horizonEnd) wasteUnitIds.push(unit.id);
      else surplusUnitIds.push(unit.id);
    } else if (unit.expiresAt < turnAt) {
      wasteUnitIds.push(unit.id);
    } else {
      consumed++;
    }
  }

  const demandInHorizon = demandPerHour * horizonHours;
  const runsOut = demandPerHour > 0 && !stockRemains;
  return {
    onHand: units.length,
    demandPerHour,
    stockoutHours: runsOut ? round1(consumed / demandPerHour) : null,
    expectedWaste: wasteUnitIds.length,
    shortfall: runsOut ? Math.max(0, Math.ceil(demandInHorizon - consumed)) : 0,
    surplus: surplusUnitIds.length,
    wasteUnitIds,
    surplusUnitIds,
  };
}

export function forecastSite(
  site: ForecastSite,
  surge: SurgeScenario | null,
  now: number,
  horizonHours: number = POLICY.forecastHorizonHours,
): CellForecast[] {
  const cells: CellForecast[] = [];
  for (const c of COMPONENTS) {
    for (const g of BLOOD_GROUPS) {
      const units = site.units.filter((u) => u.bloodGroup === g && u.component === c && u.expiresAt > now);
      const perDay = site.baselinePerDay[cellKey(g, c)] ?? 0;
      if (units.length === 0 && perDay === 0) continue;
      const demandPerHour = (perDay / 24) * surgeMultiplier(surge, site.location, g, c);
      cells.push({ siteId: site.siteId, bloodGroup: g, component: c, ...simulateCell(units, demandPerHour, now, horizonHours) });
    }
  }
  return cells;
}

export interface GroupOutlook {
  bloodGroup: BloodGroup;
  component: Component;
  onHand: number;
  demandPerHour: number;
  stockoutHours: number | null;
  expectedWaste: number;
  shortfall: number;
  /** Sites in this cell that run out within 24h. */
  sitesAtRisk: number;
}

/**
 * City-wide outlook per group: sums site-level results rather than pooling stock,
 * because blood sitting at the wrong site does not help until it is moved.
 * stockoutHours is the city's earliest site-level stockout weighted by demand.
 */
export function cityOutlook(cells: CellForecast[]): GroupOutlook[] {
  const byKey = new Map<string, CellForecast[]>();
  for (const cell of cells) {
    const key = cellKey(cell.bloodGroup, cell.component);
    byKey.set(key, [...(byKey.get(key) ?? []), cell]);
  }
  return [...byKey.values()].map((group) => {
    const demandPerHour = sum(group.map((c) => c.demandPerHour));
    const onHand = sum(group.map((c) => c.onHand));
    const shortfall = sum(group.map((c) => c.shortfall));
    const usable = onHand - sum(group.map((c) => c.expectedWaste));
    // Hours until pooled usable stock is exhausted at pooled demand — what a perfectly coordinated city could achieve.
    const pooledHours = demandPerHour > 0 ? usable / demandPerHour : null;
    return {
      bloodGroup: group[0].bloodGroup,
      component: group[0].component,
      onHand,
      demandPerHour: round1(demandPerHour),
      stockoutHours:
        pooledHours !== null && pooledHours < POLICY.forecastHorizonHours ? round1(Math.max(0, pooledHours)) : null,
      expectedWaste: sum(group.map((c) => c.expectedWaste)),
      shortfall,
      sitesAtRisk: group.filter((c) => c.stockoutHours !== null && c.stockoutHours < 24).length,
    };
  });
}

export interface OutcomeSummary {
  expectedWaste: number;
  shortfall: number;
  cellsAtRisk: number;
}

export function summarize(cells: CellForecast[]): OutcomeSummary {
  return {
    expectedWaste: sum(cells.map((c) => c.expectedWaste)),
    shortfall: sum(cells.map((c) => c.shortfall)),
    cellsAtRisk: cells.filter((c) => c.stockoutHours !== null && c.stockoutHours < 24).length,
  };
}

/** Preset scenarios. Multipliers are illustrative demo numbers. */
export const SURGE_PRESETS: Record<SurgeKind, { label: string; radiusKm: number; multipliers: Record<string, number> }> = {
  flood: {
    label: "Flash flood",
    radiusKm: 6,
    multipliers: {
      [cellKey("*", "red_cells")]: 3.5,
      [cellKey("O-", "red_cells")]: 6,
      [cellKey("O+", "red_cells")]: 5,
      [cellKey("*", "platelets")]: 3,
      [cellKey("*", "plasma")]: 3,
      [cellKey("*", "whole_blood")]: 2.5,
    },
  },
  mass_casualty: {
    label: "Mass-casualty incident",
    radiusKm: 4,
    multipliers: {
      [cellKey("*", "red_cells")]: 5,
      [cellKey("O-", "red_cells")]: 9,
      [cellKey("O+", "red_cells")]: 6,
      [cellKey("*", "platelets")]: 4,
      [cellKey("*", "plasma")]: 4.5,
      [cellKey("*", "whole_blood")]: 3,
    },
  },
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

import type { ForecastDTO, SiteDTO, SiteStockDTO, TransferSuggestionDTO } from "../../../shared/api";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, COMPONENT_SHORT, type BloodGroup, type Component } from "../../../shared/domain";
import type { GroupOutlook } from "../../../shared/forecast";

/**
 * Operational risk tiers for hospital inventory & predictive views.
 * Strictly operational (not clinical triage). Derived transparently from
 * existing ForecastDTO (GroupOutlook) calculations without modifying domain logic.
 */
export type RiskTier = "sufficient" | "approaching" | "gap" | "critical";

export interface RiskMeta {
  tier: RiskTier;
  label: string;
  shortLabel: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export const RISK_META: Record<RiskTier, RiskMeta> = {
  sufficient: {
    tier: "sufficient",
    label: "Sufficient stock",
    shortLabel: "Sufficient",
    dotColor: "#15803D",
    textColor: "#15803D",
    bgColor: "#ECFDF3",
    borderColor: "#BBF7D0",
  },
  approaching: {
    tier: "approaching",
    label: "Approaching shortage",
    shortLabel: "Approaching",
    dotColor: "#CA8A04",
    textColor: "#A16207",
    bgColor: "#FEFCE8",
    borderColor: "#FDE68A",
  },
  gap: {
    tier: "gap",
    label: "Near-term gap",
    shortLabel: "Near-term gap",
    dotColor: "#EA580C",
    textColor: "#C2410C",
    bgColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  critical: {
    tier: "critical",
    label: "Critical shortage",
    shortLabel: "Critical",
    dotColor: "#C93245",
    textColor: "#991B1B",
    bgColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
};

export const RISK_ORDER: Record<RiskTier, number> = {
  critical: 0,
  gap: 1,
  approaching: 2,
  sufficient: 3,
};

/**
 * Classify one GroupOutlook row into the 4 operational risk tiers using
 * existing forecast outputs (`stockoutHours`, `shortfall`, `sitesAtRisk`, `onHand`).
 */
export function classifyOutlookRisk(o: GroupOutlook): RiskTier {
  if (o.sitesAtRisk > 0 || (o.stockoutHours !== null && o.stockoutHours < 24) || (o.onHand === 0 && o.demandPerHour > 0)) {
    return "critical";
  }
  if ((o.stockoutHours !== null && o.stockoutHours < 48) || o.shortfall >= 5) {
    return "gap";
  }
  if (o.stockoutHours !== null || o.shortfall > 0 || o.expectedWaste >= 5) {
    return "approaching";
  }
  return "sufficient";
}

/** 24-hour operational replenishment buffer derived transparently from hourly demand. */
export function safetyStockTarget(demandPerHour: number): number {
  if (demandPerHour <= 0) return 0;
  return Math.max(1, Math.ceil(demandPerHour * 24));
}

export interface ForecastSeriesPoint {
  hour: number;
  label: string;
  projectedStock: number;
  cumulativeDemand: number;
  safetyTarget: number;
  belowSafety: boolean;
}

/**
 * Build an hourly trajectory (every 6h over the forecast horizon) directly from
 * Blood Bridge's existing linear FIFO forecast inputs (`onHand`, `expectedWaste`,
 * `demandPerHour`, `horizonHours`). No ML or invented trend curves.
 */
export function buildForecastSeries(o: GroupOutlook, horizonHours = 72): {
  points: ForecastSeriesPoint[];
  usableStock: number;
  expectedDemand: number;
  projectedEndStock: number;
  safetyTarget: number;
  crossingHour: number | null;
} {
  const usableStock = Math.max(0, o.onHand - o.expectedWaste);
  const expectedDemand = Math.round(o.demandPerHour * horizonHours);
  const safetyTarget = safetyStockTarget(o.demandPerHour);
  const step = 6;
  const points: ForecastSeriesPoint[] = [];

  for (let h = 0; h <= horizonHours; h += step) {
    const consumed = o.demandPerHour * h;
    const projected = Math.max(0, Math.round((usableStock - consumed) * 10) / 10);
    const label = h === 0 ? "Now" : h % 24 === 0 ? `Day ${h / 24}` : `+${h}h`;
    points.push({
      hour: h,
      label,
      projectedStock: projected,
      cumulativeDemand: Math.round(consumed * 10) / 10,
      safetyTarget,
      belowSafety: safetyTarget > 0 && projected < safetyTarget,
    });
  }

  let crossingHour: number | null = null;
  if (o.demandPerHour > 0 && safetyTarget > 0) {
    if (usableStock <= safetyTarget) {
      crossingHour = 0;
    } else {
      const hoursUntilTarget = (usableStock - safetyTarget) / o.demandPerHour;
      if (hoursUntilTarget <= horizonHours) {
        crossingHour = Math.round(hoursUntilTarget * 10) / 10;
      }
    }
  }

  return {
    points,
    usableStock,
    expectedDemand,
    projectedEndStock: Math.max(0, Math.round(usableStock - o.demandPerHour * horizonHours)),
    safetyTarget,
    crossingHour,
  };
}

/** Plain-English explanation derived directly from existing forecast metrics. */
export function explainOutlookRisk(o: GroupOutlook, forecast: ForecastDTO | undefined): string {
  const groupLabel = `${o.bloodGroup} ${COMPONENT_LABEL[o.component].toLowerCase()}`;
  const usable = Math.max(0, o.onHand - o.expectedWaste);
  const horizon = forecast?.horizonHours ?? 72;
  const demand72h = Math.round(o.demandPerHour * horizon);
  const surgeNote = forecast?.surge ? ` Elevated demand reflects the simulated ${forecast.surge.label.toLowerCase()} in ${forecast.surge.areaName}.` : "";

  if (o.stockoutHours !== null && o.stockoutHours < 24) {
    return `${groupLabel} is at critical risk because usable stock (${usable} of ${o.onHand} units after ${o.expectedWaste} projected expiry losses) is projected to run out in ~${o.stockoutHours}h at ${o.demandPerHour}/hr demand, leaving a ${o.shortfall}-unit gap across ${o.sitesAtRisk} site${o.sitesAtRisk === 1 ? "" : "s"}.${surgeNote}`;
  }
  if (o.stockoutHours !== null && o.stockoutHours < 48) {
    return `${groupLabel} faces a near-term replenishment gap: usable stock (${usable} units) will be exhausted in ~${o.stockoutHours}h before the ${horizon}h window ends, with ${o.expectedWaste} unit${o.expectedWaste === 1 ? "" : "s"} projected to expire unused at other locations and a ${o.shortfall}-unit shortfall.${surgeNote}`;
  }
  if (o.stockoutHours !== null || o.shortfall > 0) {
    return `${groupLabel} is approaching shortage within the ${horizon}h baseline horizon (~${o.stockoutHours ?? horizon}h cover) as expected consumption (${demand72h} units) outpaces local usable stock (${usable} units).${surgeNote}`;
  }
  if (o.expectedWaste > 0) {
    return `${groupLabel} meets ${horizon}h demand overall (${o.onHand} units on hand vs ~${demand72h} expected demand), but ${o.expectedWaste} unit${o.expectedWaste === 1 ? "" : "s"} are projected to expire unused unless redistributed.`;
  }
  return `${groupLabel} currently meets operational targets with ${o.onHand} usable units on hand against ~${demand72h} units of projected ${horizon}h demand.${surgeNote}`;
}

export interface GroupSummaryRow {
  bloodGroup: BloodGroup;
  onHand: number;
  usable: number;
  expectedWaste: number;
  shortfall: number;
  demandPerHour: number;
  earliestStockoutHours: number | null;
  sitesAtRisk: number;
  risk: RiskTier;
  worstComponent: Component | null;
  byComponent: Record<Component, number>;
}

/** Aggregate city-wide forecast outlook by blood group (for overview charts & status grid). */
export function aggregateByBloodGroup(forecast: ForecastDTO | undefined, sites: SiteDTO[] | undefined): GroupSummaryRow[] {
  const outlook = forecast?.outlook ?? [];
  const banks = (sites ?? []).filter((s) => s.kind === "blood_bank");

  return BLOOD_GROUPS.map((bloodGroup) => {
    const rows = outlook.filter((o) => o.bloodGroup === bloodGroup);
    const byComponent: Record<Component, number> = {
      whole_blood: 0,
      red_cells: 0,
      platelets: 0,
      plasma: 0,
    };
    let onHand = 0;
    let expectedWaste = 0;
    let shortfall = 0;
    let demandPerHour = 0;
    let sitesAtRisk = 0;
    let earliestStockoutHours: number | null = null;
    let worstRisk: RiskTier = "sufficient";
    let worstComponent: Component | null = null;

    for (const r of rows) {
      byComponent[r.component] += r.onHand;
      onHand += r.onHand;
      expectedWaste += r.expectedWaste;
      shortfall += r.shortfall;
      demandPerHour += r.demandPerHour;
      sitesAtRisk += r.sitesAtRisk;
      if (r.stockoutHours !== null && (earliestStockoutHours === null || r.stockoutHours < earliestStockoutHours)) {
        earliestStockoutHours = r.stockoutHours;
      }
      const tier = classifyOutlookRisk(r);
      if (RISK_ORDER[tier] < RISK_ORDER[worstRisk]) {
        worstRisk = tier;
        worstComponent = r.component;
      }
    }

    // Fallback to site counts if forecast hasn't arrived yet.
    if (rows.length === 0 && banks.length > 0) {
      onHand = banks.reduce((acc, b) => acc + (b.availableByGroup[bloodGroup] ?? 0), 0);
    }

    return {
      bloodGroup,
      onHand,
      usable: Math.max(0, onHand - expectedWaste),
      expectedWaste,
      shortfall,
      demandPerHour: Math.round(demandPerHour * 10) / 10,
      earliestStockoutHours,
      sitesAtRisk,
      risk: worstRisk,
      worstComponent,
      byComponent,
    };
  });
}

export interface ComponentSummaryRow {
  component: Component;
  label: string;
  shortLabel: string;
  onHand: number;
  usable: number;
  expectedWaste: number;
  shortfall: number;
  atRiskGroups: number;
}

/** Aggregate forecast outlook by component (for component distribution & expiry risk charts). */
export function aggregateByComponent(forecast: ForecastDTO | undefined): ComponentSummaryRow[] {
  const outlook = forecast?.outlook ?? [];
  return COMPONENTS.map((component) => {
    const rows = outlook.filter((o) => o.component === component);
    const onHand = rows.reduce((n, r) => n + r.onHand, 0);
    const expectedWaste = rows.reduce((n, r) => n + r.expectedWaste, 0);
    const shortfall = rows.reduce((n, r) => n + r.shortfall, 0);
    const atRiskGroups = rows.filter((r) => classifyOutlookRisk(r) !== "sufficient").length;
    return {
      component,
      label: COMPONENT_LABEL[component],
      shortLabel: COMPONENT_SHORT[component],
      onHand,
      usable: Math.max(0, onHand - expectedWaste),
      expectedWaste,
      shortfall,
      atRiskGroups,
    };
  });
}

/** Match transfer suggestions relevant to a given blood group & component, most urgent first. */
export function matchingSuggestions(
  suggestions: TransferSuggestionDTO[] | undefined,
  bloodGroup: BloodGroup,
  component: Component,
): TransferSuggestionDTO[] {
  return (suggestions ?? [])
    .filter((s) => s.bloodGroup === bloodGroup && s.component === component)
    .sort((a, b) => a.priority - b.priority);
}

/** Map a hospital fridge StockCell level to our 4 operational risk tiers. */
export function stockCellRiskTier(level: SiteStockDTO["cells"][number]["level"]): RiskTier {
  if (level === "critical") return "critical";
  if (level === "low") return "gap";
  return "sufficient";
}

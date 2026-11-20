import type { BloodGroup, Component, GeoPoint } from "./domain";
import { etaMinutes } from "./geo";
import { cellKey, forecastSite, summarize, type CellForecast, type ForecastSite, type OutcomeSummary, type SurgeScenario } from "./forecast";

/**
 * Expiry-aware transfer engine (PRD §8).
 * Suggest moving units when they are likely to expire (or sit idle) at one site
 * while another site is forecast short of the same group and component.
 * Units likely to expire are moved first — that is the whole point.
 */

const HOUR = 3_600_000;

export interface TransferProposal {
  fromSiteId: string;
  toSiteId: string;
  bloodGroup: BloodGroup;
  component: Component;
  quantity: number;
  unitIds: string[];
  /** How many of the moved units would otherwise expire unused at the source. */
  rescuedFromExpiry: number;
  receiverShortfall: number;
  receiverStockoutHours: number | null;
  etaMinutes: number;
  /** Lower = act sooner. */
  priority: number;
  reason: string;
}

export interface TransferPlan {
  proposals: TransferProposal[];
  before: OutcomeSummary;
  after: OutcomeSummary;
}

/** Units arriving with less than this shelf life left are not worth moving. */
const MIN_SHELF_ON_ARRIVAL_HOURS = 6;

export function planTransfers(
  sites: ForecastSite[],
  surge: SurgeScenario | null,
  now: number,
  siteNames: Record<string, string> = {},
  /** Operators can act on a short list; beyond this the plan becomes noise. */
  maxProposals = 12,
): TransferPlan {
  const cells = sites.flatMap((s) => forecastSite(s, surge, now));
  const location = new Map<string, GeoPoint>(sites.map((s) => [s.siteId, s.location]));
  const unitExpiry = new Map(sites.flatMap((s) => s.units.map((u) => [u.id, u.expiresAt] as const)));
  const locked = new Set(sites.flatMap((s) => s.units.filter((u) => u.locked).map((u) => u.id)));
  const name = (id: string) => siteNames[id] ?? id;

  const byKey = new Map<string, CellForecast[]>();
  for (const cell of cells) {
    const key = cellKey(cell.bloodGroup, cell.component);
    byKey.set(key, [...(byKey.get(key) ?? []), cell]);
  }

  const proposals: TransferProposal[] = [];
  for (const group of byKey.values()) {
    const receivers = group
      .filter((c) => c.shortfall > 0)
      .sort((a, b) => (a.stockoutHours ?? 999) - (b.stockoutHours ?? 999));
    // Spare stock per donor site: soon-to-expire units first, then idle surplus.
    const spare = new Map(
      group.map((c) => [c.siteId, [...c.wasteUnitIds, ...c.surplusUnitIds].filter((id) => !locked.has(id))]),
    );
    const wasteSet = new Set(group.flatMap((c) => c.wasteUnitIds));

    for (const receiver of receivers) {
      let need = receiver.shortfall;
      const to = location.get(receiver.siteId)!;
      const donors = group
        .filter((c) => c.siteId !== receiver.siteId && (spare.get(c.siteId)?.length ?? 0) > 0)
        .map((c) => ({ cell: c, eta: etaMinutes(location.get(c.siteId)!, to) }))
        // Prefer donors whose stock would otherwise be wasted, then the closest.
        .sort((a, b) => b.cell.expectedWaste - a.cell.expectedWaste || a.eta - b.eta);

      for (const { cell: donor, eta } of donors) {
        if (need <= 0) break;
        const arrival = now + eta * 60_000;
        const pool = spare.get(donor.siteId)!;
        const movable = pool.filter((id) => (unitExpiry.get(id) ?? 0) - arrival > MIN_SHELF_ON_ARRIVAL_HOURS * HOUR);
        const unitIds = movable.slice(0, need);
        if (unitIds.length === 0) continue;

        spare.set(donor.siteId, pool.filter((id) => !unitIds.includes(id)));
        need -= unitIds.length;
        const rescued = unitIds.filter((id) => wasteSet.has(id)).length;
        const soonest = Math.min(...unitIds.map((id) => unitExpiry.get(id)!));
        const expiresIn = Math.round((soonest - now) / HOUR);

        proposals.push({
          fromSiteId: donor.siteId,
          toSiteId: receiver.siteId,
          bloodGroup: receiver.bloodGroup,
          component: receiver.component,
          quantity: unitIds.length,
          unitIds,
          rescuedFromExpiry: rescued,
          receiverShortfall: receiver.shortfall,
          receiverStockoutHours: receiver.stockoutHours,
          etaMinutes: eta,
          priority: (receiver.stockoutHours ?? 72) - rescued * 2,
          reason:
            rescued > 0
              ? `${name(donor.siteId)} has ${rescued} unit${rescued > 1 ? "s" : ""} likely to expire (soonest in ${expiresIn}h); ${name(receiver.siteId)} is forecast short by ${receiver.shortfall}.`
              : `${name(donor.siteId)} holds idle stock; ${name(receiver.siteId)} is forecast short by ${receiver.shortfall}${receiver.stockoutHours !== null ? ` and runs out in ~${receiver.stockoutHours}h` : ""}.`,
        });
      }
    }
  }

  const top = proposals.sort((a, b) => a.priority - b.priority || b.quantity - a.quantity).slice(0, maxProposals);
  return { proposals: top, before: summarize(cells), after: summarize(applyProposals(sites, top, surge, now)) };
}

/** Re-run the forecast as if the proposals were executed — powers the before/after outcome meter. */
export function applyProposals(
  sites: ForecastSite[],
  proposals: Pick<TransferProposal, "fromSiteId" | "toSiteId" | "unitIds">[],
  surge: SurgeScenario | null,
  now: number,
): CellForecast[] {
  const moves = new Map<string, string>();
  for (const p of proposals) for (const id of p.unitIds) moves.set(id, p.toSiteId);
  const allUnits = sites.flatMap((s) => s.units.map((u) => ({ ...u, siteId: moves.get(u.id) ?? s.siteId })));
  return sites.flatMap((s) =>
    forecastSite({ ...s, units: allUnits.filter((u) => u.siteId === s.siteId) }, surge, now),
  );
}

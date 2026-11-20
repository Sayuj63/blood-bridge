import { and, eq, gt, inArray } from "drizzle-orm";
import type { SiteDTO, SiteStockDTO, StockCell, StockLevel, UnitDTO } from "../../shared/api";
import { BLOOD_GROUPS, COMPONENTS, POLICY, type BloodGroup } from "../../shared/domain";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { notFound } from "../lib/http";
import { areaById } from "../seed";

type SiteRow = typeof schema.sites.$inferSelect;
type UnitRow = typeof schema.units.$inferSelect;

const MINUTE = 60_000;
const HOUR = 3_600_000;

export function toSiteDTO(site: SiteRow, available: Pick<UnitRow, "bloodGroup">[], now: number): SiteDTO {
  const freshnessMinutes = Math.max(0, Math.round((now - site.lastSyncAt) / MINUTE));
  const availableByGroup: Partial<Record<BloodGroup, number>> = {};
  for (const u of available) availableByGroup[u.bloodGroup] = (availableByGroup[u.bloodGroup] ?? 0) + 1;
  return {
    id: site.id,
    kind: site.kind,
    name: site.name,
    shortName: site.shortName,
    areaId: site.areaId,
    areaName: areaById(site.areaId)?.name ?? site.areaId,
    address: site.address,
    phone: site.phone,
    lat: site.lat,
    lng: site.lng,
    lastSyncAt: site.lastSyncAt,
    freshnessMinutes,
    stale: freshnessMinutes > POLICY.staleAfterMinutes,
    verified: site.verified,
    availableByGroup,
    totalAvailable: available.length,
  };
}

export function toUnitDTO(u: UnitRow): UnitDTO {
  return {
    id: u.id,
    siteId: u.siteId,
    bloodGroup: u.bloodGroup,
    component: u.component,
    collectedAt: u.collectedAt,
    expiresAt: u.expiresAt,
    status: u.status,
    reservationId: u.reservationId,
    offered: u.offeredAt !== null,
    updatedAt: u.updatedAt,
  };
}

export async function listSites({ db, now }: Deps): Promise<SiteDTO[]> {
  const [sites, available] = await Promise.all([
    db.select().from(schema.sites),
    db
      .select({ siteId: schema.units.siteId, bloodGroup: schema.units.bloodGroup })
      .from(schema.units)
      .where(and(eq(schema.units.status, "available"), gt(schema.units.expiresAt, now))),
  ]);
  return sites
    .map((s) => toSiteDTO(s, available.filter((u) => u.siteId === s.id), now))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

export async function getSite({ db }: Deps, siteId: string): Promise<SiteRow> {
  const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, siteId));
  if (!site) throw notFound("Site");
  return site;
}

function stockLevel(onHand: number, perDay: number): StockLevel {
  if (perDay <= 0) return onHand > 0 ? "surplus" : "ok";
  const days = onHand / perDay;
  if (days < 1) return "critical";
  if (days < 2.5) return "low";
  if (days > 10) return "surplus";
  return "ok";
}

export async function siteStock(deps: Deps, siteId: string): Promise<SiteStockDTO> {
  const { db, now } = deps;
  const site = await getSite(deps, siteId);
  const [units, demand] = await Promise.all([
    db
      .select()
      .from(schema.units)
      .where(
        and(
          eq(schema.units.siteId, siteId),
          inArray(schema.units.status, ["available", "reserved", "in_transit"]),
          gt(schema.units.expiresAt, now),
        ),
      ),
    db.select().from(schema.demandBaseline).where(eq(schema.demandBaseline.siteId, siteId)),
  ]);

  const cells: StockCell[] = [];
  for (const component of COMPONENTS) {
    for (const bloodGroup of BLOOD_GROUPS) {
      const inCell = units.filter((u) => u.bloodGroup === bloodGroup && u.component === component);
      const available = inCell.filter((u) => u.status === "available");
      const perDay = demand.find((d) => d.bloodGroup === bloodGroup && d.component === component)?.unitsPerDay ?? 0;
      cells.push({
        bloodGroup,
        component,
        onHand: available.length,
        reserved: inCell.filter((u) => u.status === "reserved").length,
        expiring48h: available.filter((u) => u.expiresAt - now <= POLICY.expiringSoonHours * HOUR).length,
        expiring7d: available.filter((u) => u.expiresAt - now <= 7 * 24 * HOUR).length,
        daysOfCover: perDay > 0 ? Math.round((available.length / perDay) * 10) / 10 : null,
        level: stockLevel(available.length, perDay),
      });
    }
  }

  const available = units.filter((u) => u.status === "available");
  return {
    site: toSiteDTO(site, available, now),
    cells,
    units: units.sort((a, b) => a.expiresAt - b.expiresAt).map(toUnitDTO),
    totals: {
      onHand: available.length,
      reserved: units.filter((u) => u.status === "reserved").length,
      expiring48h: cells.reduce((n, c) => n + c.expiring48h, 0),
      expiring7d: cells.reduce((n, c) => n + c.expiring7d, 0),
    },
  };
}

/** Operator confirms the shelf matches the system — refreshes the freshness indicator. */
export async function syncSite(deps: Deps, siteId: string, actor: string): Promise<void> {
  const site = await getSite(deps, siteId);
  await deps.db.update(schema.sites).set({ lastSyncAt: deps.now }).where(eq(schema.sites.id, siteId));
  await deps.hub.audit([
    { actor, action: "stock.synced", entityType: "site", entityId: siteId, siteId, summary: `${site.shortName} confirmed stock count` },
  ]);
  await deps.hub.publish({ topics: ["sites", "stock"], siteIds: [siteId], headline: `${site.shortName} stock re-synced`, tone: "info" });
}

export async function touchSync(deps: Deps, siteIds: string[]): Promise<void> {
  if (siteIds.length === 0) return;
  await deps.db.update(schema.sites).set({ lastSyncAt: deps.now }).where(inArray(schema.sites.id, siteIds));
}

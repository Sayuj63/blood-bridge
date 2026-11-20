import { and, eq } from "drizzle-orm";
import type { AddUnitsInput, UnitActionInput, UnitDTO } from "../../shared/api";
import { COMPONENT_SHORT, DEMO_SHELF_LIFE_DAYS } from "../../shared/domain";
import { insertMany, schema } from "../db/client";
import type { Deps } from "../deps";
import { conflict, notFound } from "../lib/http";
import { newId } from "../lib/ids";
import { getSite, toUnitDTO, touchSync } from "./sites";

const DAY = 86_400_000;

export async function addUnits(deps: Deps, siteId: string, input: AddUnitsInput, actor: string): Promise<UnitDTO[]> {
  const site = await getSite(deps, siteId);
  const life = DEMO_SHELF_LIFE_DAYS[input.component] * DAY;
  const expiresAt = deps.now + (input.expiresInDays !== undefined ? input.expiresInDays * DAY : life);
  const rows = Array.from({ length: input.count }, () => ({
    id: newId("U"),
    siteId,
    bloodGroup: input.bloodGroup,
    component: input.component,
    collectedAt: Math.min(deps.now, expiresAt - life),
    expiresAt,
    status: "available" as const,
    reservationId: null,
    transferId: null,
    offeredAt: null,
    updatedAt: deps.now,
  }));
  await insertMany(deps.db, schema.units, rows);
  await touchSync(deps, [siteId]);

  const label = `${input.count} × ${input.bloodGroup} ${COMPONENT_SHORT[input.component]}`;
  await deps.hub.audit([
    { actor, action: "stock.added", entityType: "site", entityId: siteId, siteId, summary: `${site.shortName} added ${label}`, payload: { unitIds: rows.map((r) => r.id) } },
  ]);
  await deps.hub.publish({ topics: ["stock", "sites"], siteIds: [siteId], headline: `${site.shortName} added ${label}`, tone: "info" });
  return rows.map(toUnitDTO);
}

const ACTION_STATUS = { use: "used", remove: "discarded", discard: "discarded" } as const;

export async function unitAction(deps: Deps, unitId: string, input: UnitActionInput, actor: string): Promise<UnitDTO> {
  const [unit] = await deps.db.select().from(schema.units).where(eq(schema.units.id, unitId));
  if (!unit) throw notFound("Unit");
  if (unit.status !== "available") throw conflict(`Unit is ${unit.status.replace("_", " ")} and cannot be changed here`);

  const [updated] = await deps.db
    .update(schema.units)
    .set({ status: ACTION_STATUS[input.action], updatedAt: deps.now })
    .where(and(eq(schema.units.id, unitId), eq(schema.units.status, "available")))
    .returning();
  if (!updated) throw conflict("Unit changed while you were editing it — refresh and try again");
  await touchSync(deps, [unit.siteId]);

  const verb = input.action === "use" ? "marked used" : "removed";
  await deps.hub.audit([
    { actor, action: `unit.${input.action}`, entityType: "unit", entityId: unitId, siteId: unit.siteId, summary: `Unit ${unitId} (${unit.bloodGroup} ${COMPONENT_SHORT[unit.component]}) ${verb}` },
  ]);
  await deps.hub.publish({ topics: ["stock", "sites"], siteIds: [unit.siteId] });
  return toUnitDTO(updated);
}

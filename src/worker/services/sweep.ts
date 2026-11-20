import { and, eq, lte } from "drizzle-orm";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { sweepReservations } from "./requests";

/**
 * Periodic housekeeping, driven by the CityHub alarm (and a 1-minute cron backstop):
 *  - unconfirmed reservations past their window → expire and auto-reroute
 *  - reserved units not collected in time → return to stock
 *  - units past expiry → mark expired
 * Returns when the next sweep is due, or null if nothing is pending.
 */
export async function runSweep(deps: Deps): Promise<number | null> {
  const next = await sweepReservations(deps);

  const expired = await deps.db
    .update(schema.units)
    .set({ status: "expired", updatedAt: deps.now })
    .where(and(eq(schema.units.status, "available"), lte(schema.units.expiresAt, deps.now)))
    .returning({ id: schema.units.id, siteId: schema.units.siteId });
  if (expired.length > 0) {
    const siteIds = [...new Set(expired.map((u) => u.siteId))];
    await deps.hub.audit([
      {
        actor: "system",
        action: "stock.expired",
        entityType: "unit",
        entityId: expired.length === 1 ? expired[0].id : `${expired.length} units`,
        siteId: siteIds.length === 1 ? siteIds[0] : null,
        summary: `${expired.length} unit${expired.length === 1 ? "" : "s"} passed expiry and left available stock`,
        payload: { unitIds: expired.map((u) => u.id) },
      },
    ]);
    await deps.hub.publish({ topics: ["stock", "sites"], siteIds });
  }
  return next;
}

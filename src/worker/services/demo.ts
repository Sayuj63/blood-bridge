import { insertMany, schema } from "../db/client";
import type { Deps } from "../deps";
import { generateSeed } from "../seed";

/**
 * Wipe and regenerate the simulated city. Deterministic and relative to now,
 * so every rehearsal and every live demo starts from the same state.
 */
export async function resetDemo(deps: Deps, actor: string): Promise<{ sites: number; units: number; donors: number }> {
  const { db } = deps;
  // Children first (FK order).
  await db.batch([
    db.delete(schema.auditLog),
    db.delete(schema.rateLimits),
    db.delete(schema.donations),
    db.delete(schema.donorAlerts),
    db.delete(schema.donors),
    db.delete(schema.surgeEvents),
    db.delete(schema.transfers),
    db.delete(schema.units),
    db.delete(schema.reservations),
    db.delete(schema.requests),
    db.delete(schema.demandBaseline),
    db.delete(schema.sites),
  ]);

  const seed = generateSeed(deps.now);
  await insertMany(db, schema.sites, seed.sites);
  await insertMany(db, schema.demandBaseline, seed.demand);
  await insertMany(db, schema.units, seed.units);
  await insertMany(db, schema.donors, seed.donors);
  await insertMany(db, schema.donations, seed.donations);

  await deps.hub.audit([
    {
      actor,
      action: "demo.reset",
      entityType: "system",
      entityId: "seed",
      summary: `Simulated city generated: ${seed.sites.length} sites, ${seed.units.length} units, ${seed.donors.length} donors`,
    },
  ]);
  await deps.hub.publish({
    topics: ["sites", "stock", "requests", "reservations", "transfers", "donors", "alerts", "surge", "audit"],
    headline: "Demo reset — simulated city regenerated",
    tone: "info",
  });
  return { sites: seed.sites.length, units: seed.units.length, donors: seed.donors.length };
}

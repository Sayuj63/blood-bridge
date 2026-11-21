import { and, eq, inArray, like } from "drizzle-orm";
import type { IntegrationDTO, RaktSyncDTO } from "../../shared/api";
import { fetchRaktBags, parseRaktBags } from "../connectors/rakt";
import { insertMany, schema } from "../db/client";
import type { Deps } from "../deps";
import { AppError } from "../lib/http";
import { SHELF_LIFE_DAYS } from "../seed";
import { eraktkoshStatus } from "./eraktkosh";
import { getSite } from "./sites";

/**
 * Connected systems a blood bank can feed Blood Bridge from.
 * RAKT is configured per deployment: RAKT_API_KEY (secret), RAKT_SITE_ID (which bank uses it),
 * RAKT_BASE_URL (optional, defaults to https://rakt.in).
 */
const raktConfig = (env: Env) =>
  env.RAKT_API_KEY && env.RAKT_SITE_ID
    ? { apiKey: env.RAKT_API_KEY, siteId: env.RAKT_SITE_ID, baseUrl: env.RAKT_BASE_URL || "https://rakt.in" }
    : null;

export async function listIntegrations(deps: Deps, siteId: string): Promise<IntegrationDTO[]> {
  const ek = await eraktkoshStatus(deps);
  const rakt = raktConfig(deps.env);
  return [
    {
      id: "eraktkosh",
      name: "e-RaktKosh",
      description: "National blood-availability portal (MoHFW / NBTC). Public; counts per group and component.",
      state: ek.ok === false ? "error" : "available",
      detail: ek.summary,
      canSync: true,
    },
    {
      id: "rakt",
      name: "RAKT",
      description: "Blood bank management software. Per-bag stock with collection dates, via its REST API.",
      state: !rakt ? "not_configured" : rakt.siteId === siteId ? "connected" : "other_site",
      detail: !rakt
        ? "Connector ready. Needs this bank's RAKT organisation API key."
        : rakt.siteId === siteId
          ? "Connected for this bank."
          : "Connected for another bank in the network.",
      canSync: rakt?.siteId === siteId,
    },
    {
      id: "ebloodconnect",
      name: "eBloodConnect",
      description: "Blood bank management software. Its API is private and undocumented.",
      state: "partner_required",
      detail: "Needs vendor partner access before a connector can be built.",
      canSync: false,
    },
  ];
}

/** Pull this bank's in-stock components from RAKT. Idempotent: RAKT components map to stable unit IDs. */
export async function syncRakt(deps: Deps, siteId: string, actor: string): Promise<RaktSyncDTO> {
  const rakt = raktConfig(deps.env);
  if (!rakt) throw new AppError(409, "rakt_not_configured", "RAKT isn't connected. Add this bank's RAKT API key first.");
  if (rakt.siteId !== siteId) throw new AppError(409, "rakt_other_site", "RAKT is connected for a different bank");
  const site = await getSite(deps, siteId);

  let units;
  try {
    units = parseRaktBags(await fetchRaktBags(rakt.baseUrl, rakt.apiKey), deps.now, SHELF_LIFE_DAYS);
  } catch (err) {
    throw new AppError(502, "rakt_unavailable", `Couldn't sync from RAKT: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Diff in code: D1 caps bound parameters per statement, and a bank can hold hundreds of components.
  const existing = await deps.db
    .select({ id: schema.units.id, status: schema.units.status })
    .from(schema.units)
    .where(and(eq(schema.units.siteId, siteId), like(schema.units.id, "RAKT-%")));
  const known = new Set(existing.map((r) => r.id));
  const listed = new Set(units.map((u) => u.id));
  const fresh = units.filter((u) => !known.has(u.id));
  await insertMany(
    deps.db,
    schema.units,
    fresh.map((u) => ({ ...u, siteId, status: "available" as const, updatedAt: deps.now })),
  );
  // Components RAKT no longer lists as in stock have been issued or discarded there.
  const gone = existing.filter((r) => r.status === "available" && !listed.has(r.id)).map((r) => r.id);
  for (let i = 0; i < gone.length; i += 90) {
    await deps.db
      .update(schema.units)
      .set({ status: "used", updatedAt: deps.now })
      .where(and(inArray(schema.units.id, gone.slice(i, i + 90)), eq(schema.units.status, "available")));
  }
  await deps.db.update(schema.sites).set({ lastSyncAt: deps.now }).where(eq(schema.sites.id, siteId));

  const summary = `${site.shortName} synced from RAKT: ${units.length} in stock, +${fresh.length} new, −${gone.length} issued`;
  await deps.hub.audit([{ actor, action: "rakt.sync", entityType: "site", entityId: siteId, siteId, summary }]);
  await deps.hub.publish({ topics: ["stock", "sites", "transfers"], siteIds: [siteId], headline: summary, tone: "info" });
  return { syncedAt: deps.now, inStock: units.length, added: fresh.length, removed: gone.length };
}

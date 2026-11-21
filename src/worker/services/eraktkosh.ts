import { and, desc, eq, gt, inArray, like } from "drizzle-orm";
import type { EraktkoshStatusDTO, EraktkoshSyncDTO } from "../../shared/api";
import { BLOOD_GROUPS, COMPONENTS } from "../../shared/domain";
import { insertMany, schema } from "../db/client";
import type { Deps } from "../deps";
import { COMPONENT_MAP, DISTRICT_CODES, parseResults, STATE_CODE, type EraktkoshResult, type ParsedSnapshot } from "../eraktkosh/parse";
import { AppError } from "../lib/http";
import { newId } from "../lib/ids";
import { SHELF_LIFE_DAYS } from "../seed";

/**
 * Live sync with e-RaktKosh, the national blood-availability portal (public, unauthenticated).
 * Counts are reconciled per bank × group × component; per-bag expiry is modelled because
 * e-RaktKosh publishes counts only. Each bank keeps e-RaktKosh's own last-updated time, so the
 * freshness shown in the app is the real age of the source data.
 */

const ENDPOINT = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/nearbyBB.cnt";
const USER_AGENT = "Mozilla/5.0 (BloodBridge/1.0; MindSprint 2026 hackathon; +https://blood-bridge.blood-bridge.workers.dev)";
const DAY = 86_400_000;
/** The cron runs every minute; a sync attempt is made at most this often. */
export const AUTO_SYNC_EVERY_MS = 60 * 60_000;

async function fetchComponent(districtCode: string, componentCode: string): Promise<EraktkoshResult> {
  const q = new URLSearchParams({
    hmode: "GETNEARBYSTOCKDETAILS",
    stateCode: STATE_CODE,
    districtCode,
    bloodGroup: "all",
    bloodComponent: componentCode,
    lang: "0",
  });
  const res = await fetch(`${ENDPOINT}?${q}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`e-RaktKosh returned HTTP ${res.status}`);
  const body = (await res.json()) as { data?: EraktkoshResult["rows"] };
  return { componentCode, rows: body.data ?? [] };
}

/** All modelled component codes for both Mumbai districts, a few requests at a time. */
async function fetchSnapshot(): Promise<ParsedSnapshot> {
  const jobs = DISTRICT_CODES.flatMap((d) => Object.keys(COMPONENT_MAP).map((c) => [d, c] as const));
  const results: EraktkoshResult[] = [];
  for (let i = 0; i < jobs.length; i += 4) {
    results.push(...(await Promise.all(jobs.slice(i, i + 4).map(([d, c]) => fetchComponent(d, c)))));
  }
  return parseResults(results);
}

/** Make `available` units match the reported counts. Reserved / in-transit units are never touched. */
async function reconcileBank(deps: Deps, bankId: string, snap: ParsedSnapshot): Promise<{ added: number; removed: number }> {
  const target = snap.stock[bankId];
  const available = await deps.db
    .select({ id: schema.units.id, bloodGroup: schema.units.bloodGroup, component: schema.units.component, expiresAt: schema.units.expiresAt })
    .from(schema.units)
    .where(and(eq(schema.units.siteId, bankId), eq(schema.units.status, "available"), gt(schema.units.expiresAt, deps.now)));

  const toAdd: (typeof schema.units.$inferInsert)[] = [];
  const toRemove: string[] = [];
  for (const g of BLOOD_GROUPS) {
    for (const c of COMPONENTS) {
      const have = available.filter((u) => u.bloodGroup === g && u.component === c).sort((a, b) => b.expiresAt - a.expiresAt);
      const want = target[g][c];
      const life = SHELF_LIFE_DAYS[c] * DAY;
      for (let i = have.length; i < want; i++) {
        const expiresAt = Math.round(deps.now + life * (0.05 + Math.random() * 0.95));
        toAdd.push({
          id: newId("U"),
          siteId: bankId,
          bloodGroup: g,
          component: c,
          collectedAt: expiresAt - life,
          expiresAt,
          status: "available",
          updatedAt: deps.now,
        });
      }
      // Issued elsewhere since our last view: retire the freshest surplus first, keeping older units for FIFO.
      toRemove.push(...have.slice(0, Math.max(0, have.length - want)).map((u) => u.id));
    }
  }
  await insertMany(deps.db, schema.units, toAdd);
  for (let i = 0; i < toRemove.length; i += 90) {
    await deps.db
      .update(schema.units)
      .set({ status: "used", updatedAt: deps.now })
      .where(and(inArray(schema.units.id, toRemove.slice(i, i + 90)), eq(schema.units.status, "available")));
  }
  if (snap.updatedAt[bankId]) {
    await deps.db.update(schema.sites).set({ lastSyncAt: snap.updatedAt[bankId] }).where(eq(schema.sites.id, bankId));
  }
  return { added: toAdd.length, removed: toRemove.length };
}

/** Sync one bank or all banks. Failures (portal down, blocked) are audited and reported, never thrown raw. */
export async function syncEraktkosh(deps: Deps, actor: string, onlyBankId?: string, provided?: ParsedSnapshot): Promise<EraktkoshSyncDTO> {
  let snap: ParsedSnapshot;
  if (provided) {
    snap = provided;
  } else {
    try {
      snap = await fetchSnapshot();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // e-RaktKosh refuses cloud servers; an India-based relay (the laptop gateway) pushes instead.
      const last = await lastSuccess(deps);
      if (last && deps.now - last.at < 3 * AUTO_SYNC_EVERY_MS) {
        throw new AppError(409, "eraktkosh_via_relay", `e-RaktKosh blocks cloud servers. The India relay refreshed it ${Math.round((deps.now - last.at) / 60_000)} min ago.`);
      }
      await deps.hub.audit([{ actor, action: "eraktkosh.sync_failed", entityType: "system", entityId: "eraktkosh", summary: `e-RaktKosh sync failed: ${message}` }]);
      throw new AppError(502, "eraktkosh_unavailable", `Couldn't reach e-RaktKosh: ${message}. Start the laptop relay (gateway) to refresh it from India.`);
    }
  }

  const banks = Object.keys(snap.stock).filter((id) => !onlyBankId || id === onlyBankId);
  if (onlyBankId && banks.length === 0) throw new AppError(404, "not_on_eraktkosh", "This bank isn't listed in today's e-RaktKosh data");

  const changes: EraktkoshSyncDTO["banks"] = [];
  for (const id of banks) {
    const { added, removed } = await reconcileBank(deps, id, snap);
    changes.push({ siteId: id, added, removed, sourceUpdatedAt: snap.updatedAt[id] ?? null });
  }
  const added = changes.reduce((n, c) => n + c.added, 0);
  const removed = changes.reduce((n, c) => n + c.removed, 0);
  const summary = `e-RaktKosh sync: ${banks.length} bank${banks.length === 1 ? "" : "s"}, +${added} / −${removed} units`;
  await deps.hub.audit([
    { actor, action: "eraktkosh.sync", entityType: "system", entityId: onlyBankId ?? "all", siteId: onlyBankId ?? null, summary, payload: { changes } },
  ]);
  await deps.hub.publish({ topics: ["stock", "sites", "transfers", "surge"], siteIds: banks, headline: summary, tone: "info" });
  return { syncedAt: deps.now, banks: changes, added, removed };
}

async function lastEntry(deps: Deps, action: string) {
  const [row] = await deps.db
    .select({ at: schema.auditLog.at, action: schema.auditLog.action, summary: schema.auditLog.summary, actor: schema.auditLog.actor })
    .from(schema.auditLog)
    .where(like(schema.auditLog.action, action))
    .orderBy(desc(schema.auditLog.seq))
    .limit(1);
  return row ?? null;
}
const lastSuccess = (deps: Deps) => lastEntry(deps, "eraktkosh.sync");

export async function eraktkoshStatus(deps: Deps): Promise<EraktkoshStatusDTO> {
  const [last, ok] = await Promise.all([lastEntry(deps, "eraktkosh.%"), lastSuccess(deps)]);
  // A recent success (direct or via the India relay) outranks a later blocked direct attempt.
  const fresh = ok && deps.now - ok.at < 3 * AUTO_SYNC_EVERY_MS ? ok : null;
  const shown = fresh ?? last;
  return {
    lastAttemptAt: last?.at ?? null,
    ok: shown ? shown.action === "eraktkosh.sync" : null,
    summary: shown ? `${shown.summary}${shown.actor.includes("relay") ? " (via India relay)" : ""}` : null,
    nextAutoSyncAt: (last?.at ?? deps.now) + AUTO_SYNC_EVERY_MS,
  };
}

/** Cron hook: attempt an automatic sync at most once an hour. */
export async function autoSyncEraktkosh(deps: Deps): Promise<void> {
  const status = await eraktkoshStatus(deps);
  if (status.lastAttemptAt !== null && deps.now - status.lastAttemptAt < AUTO_SYNC_EVERY_MS) return;
  const ok = await lastSuccess(deps);
  if (ok && deps.now - ok.at < AUTO_SYNC_EVERY_MS) return;
  try {
    await syncEraktkosh(deps, "system:eraktkosh-cron");
  } catch {
    // Already audited; the next attempt is in an hour.
  }
}

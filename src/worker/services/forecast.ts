import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import type {
  ApproveTransferInput,
  DismissTransferInput,
  ForecastDTO,
  OfferUnitsInput,
  SiteRiskDTO,
  StartSurgeInput,
  SurgeBriefDTO,
  SurgeDTO,
  TransferBoardDTO,
  TransferDTO,
} from "../../shared/api";
import { COMPONENT_LABEL, COMPONENT_SHORT, POLICY } from "../../shared/domain";
import {
  cityOutlook,
  forecastSite,
  summarize,
  surgeInfluence,
  SURGE_PRESETS,
  type ForecastSite,
  type SurgeScenario,
} from "../../shared/forecast";
import { etaMinutes } from "../../shared/geo";
import { planTransfers } from "../../shared/transfers";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { badRequest, conflict, notFound } from "../lib/http";
import { newId } from "../lib/ids";
import { areaById, SURGE_DEFAULT_AREA } from "../seed";
import { getSite, touchSync } from "./sites";

type SurgeRow = typeof schema.surgeEvents.$inferSelect;
const HOUR = 3_600_000;

export const suggestionKey = (p: { fromSiteId: string; toSiteId: string; bloodGroup: string; component: string }) =>
  `${p.fromSiteId}|${p.toSiteId}|${p.bloodGroup}|${p.component}`;

/* ─────────────────────────────── Loading ─────────────────────────────── */

/**
 * Build the forecast model of the city. Units already in transit count at their
 * destination, so approving a transfer immediately changes the outlook.
 */
export async function loadForecastSites(deps: Deps): Promise<{ sites: ForecastSite[]; names: Record<string, string> }> {
  const [siteRows, unitRows, demandRows, inTransit] = await Promise.all([
    deps.db.select().from(schema.sites),
    deps.db
      .select({
        id: schema.units.id,
        siteId: schema.units.siteId,
        bloodGroup: schema.units.bloodGroup,
        component: schema.units.component,
        expiresAt: schema.units.expiresAt,
        offeredAt: schema.units.offeredAt,
        status: schema.units.status,
        transferId: schema.units.transferId,
      })
      .from(schema.units)
      .where(and(inArray(schema.units.status, ["available", "in_transit"]), gt(schema.units.expiresAt, deps.now))),
    deps.db.select().from(schema.demandBaseline),
    deps.db
      .select({ id: schema.transfers.id, toSiteId: schema.transfers.toSiteId })
      .from(schema.transfers)
      .where(eq(schema.transfers.status, "approved")),
  ]);
  const destination = new Map(inTransit.map((t) => [t.id, t.toSiteId]));
  const located = unitRows.map((u) => ({
    ...u,
    at: u.status === "in_transit" && u.transferId ? (destination.get(u.transferId) ?? u.siteId) : u.siteId,
  }));

  const sites: ForecastSite[] = siteRows.map((s) => ({
    siteId: s.id,
    name: s.shortName,
    location: { lat: s.lat, lng: s.lng },
    units: located
      .filter((u) => u.at === s.id)
      .map((u) => ({
        id: u.id,
        bloodGroup: u.bloodGroup,
        component: u.component,
        expiresAt: u.expiresAt,
        offered: u.offeredAt !== null && u.status === "available",
        locked: u.status === "in_transit",
      })),
    baselinePerDay: Object.fromEntries(
      demandRows.filter((d) => d.siteId === s.id).map((d) => [`${d.bloodGroup}|${d.component}`, d.unitsPerDay]),
    ),
  }));
  return { sites, names: Object.fromEntries(siteRows.map((s) => [s.id, s.shortName])) };
}

export async function activeSurgeRow(deps: Deps): Promise<SurgeRow | null> {
  const [row] = await deps.db
    .select()
    .from(schema.surgeEvents)
    .where(isNull(schema.surgeEvents.endedAt))
    .orderBy(desc(schema.surgeEvents.startedAt))
    .limit(1);
  return row ?? null;
}

const toScenario = (row: SurgeRow | null): SurgeScenario | null =>
  row && { kind: row.kind, epicenter: { lat: row.epicenterLat, lng: row.epicenterLng }, radiusKm: row.radiusKm, multipliers: row.multipliers };

function toSurgeDTO(row: SurgeRow): SurgeDTO {
  return {
    id: row.id,
    kind: row.kind,
    label: SURGE_PRESETS[row.kind].label,
    areaId: row.areaId,
    areaName: areaById(row.areaId)?.name ?? row.areaId,
    epicenter: { lat: row.epicenterLat, lng: row.epicenterLng },
    radiusKm: row.radiusKm,
    multipliers: row.multipliers,
    startedAt: row.startedAt,
  };
}

/* ─────────────────────────────── Forecast ─────────────────────────────── */

async function dismissedKeys(deps: Deps): Promise<Set<string>> {
  const rows = await deps.db
    .select({ key: schema.transfers.suggestionKey })
    .from(schema.transfers)
    .where(and(eq(schema.transfers.status, "dismissed"), gt(schema.transfers.createdAt, deps.now - 2 * HOUR)));
  return new Set(rows.map((r) => r.key));
}

async function currentPlan(deps: Deps) {
  const [{ sites, names }, surgeRow, dismissed] = await Promise.all([loadForecastSites(deps), activeSurgeRow(deps), dismissedKeys(deps)]);
  const surge = toScenario(surgeRow);
  const raw = planTransfers(sites, surge, deps.now, names);
  const proposals = raw.proposals.filter((p) => !dismissed.has(suggestionKey(p)));
  return { sites, names, surgeRow, surge, plan: { ...raw, proposals } };
}

export async function forecast(deps: Deps): Promise<ForecastDTO> {
  const { sites, names, surgeRow, surge, plan } = await currentPlan(deps);
  const cells = sites.flatMap((s) => forecastSite(s, surge, deps.now));
  const baseline = summarize(sites.flatMap((s) => forecastSite(s, null, deps.now)));

  const siteRisks: SiteRiskDTO[] = sites.map((s) => {
    const own = cells.filter((c) => c.siteId === s.siteId);
    const worst = own
      .filter((c) => c.stockoutHours !== null)
      .sort((a, b) => a.stockoutHours! - b.stockoutHours! || b.demandPerHour - a.demandPerHour)[0];
    return {
      siteId: s.siteId,
      name: names[s.siteId],
      earliestStockoutHours: worst?.stockoutHours ?? null,
      worst: worst ? { bloodGroup: worst.bloodGroup, component: worst.component } : null,
      expectedWaste: own.reduce((n, c) => n + c.expectedWaste, 0),
      surgeInfluence: surge ? Math.round(surgeInfluence(surge, s.location) * 100) / 100 : 0,
    };
  });

  return {
    generatedAt: deps.now,
    horizonHours: POLICY.forecastHorizonHours,
    surge: surgeRow && toSurgeDTO(surgeRow),
    outlook: cityOutlook(cells).sort((a, b) => (a.stockoutHours ?? 999) - (b.stockoutHours ?? 999)),
    sites: siteRisks,
    current: summarize(cells),
    withPlan: plan.after,
    baseline,
  };
}

/* ─────────────────────────────── Transfers ─────────────────────────────── */

async function listTransfers(deps: Deps, siteId?: string): Promise<TransferDTO[]> {
  const sites = await deps.db.select({ id: schema.sites.id, shortName: schema.sites.shortName }).from(schema.sites);
  const name = new Map(sites.map((s) => [s.id, s.shortName]));
  const rows = await deps.db
    .select()
    .from(schema.transfers)
    .where(and(inArray(schema.transfers.status, ["approved", "completed"]), gt(schema.transfers.createdAt, deps.now - 24 * HOUR)))
    .orderBy(desc(schema.transfers.createdAt));
  return rows
    .filter((t) => !siteId || t.fromSiteId === siteId || t.toSiteId === siteId)
    .map((t) => ({
      id: t.id,
      fromSiteId: t.fromSiteId,
      toSiteId: t.toSiteId,
      fromName: name.get(t.fromSiteId) ?? t.fromSiteId,
      toName: name.get(t.toSiteId) ?? t.toSiteId,
      bloodGroup: t.bloodGroup,
      component: t.component,
      quantity: t.quantity,
      status: t.status,
      rescuedFromExpiry: t.rescuedFromExpiry,
      reason: t.reason,
      etaMinutes: t.etaMinutes,
      createdAt: t.createdAt,
      decidedAt: t.decidedAt,
      completedAt: t.completedAt,
    }));
}

export async function transferBoard(deps: Deps, siteId?: string): Promise<TransferBoardDTO> {
  const { names, plan } = await currentPlan(deps);
  const suggestions = plan.proposals
    .filter((p) => !siteId || p.fromSiteId === siteId || p.toSiteId === siteId)
    .map((p) => ({ ...p, key: suggestionKey(p), fromName: names[p.fromSiteId], toName: names[p.toSiteId] }));
  return { suggestions, active: await listTransfers(deps, siteId), before: plan.before, after: plan.after };
}

export async function approveTransfer(deps: Deps, input: ApproveTransferInput, actor: string): Promise<TransferDTO> {
  if (input.fromSiteId === input.toSiteId) throw badRequest("Source and destination must differ");
  const [from, to] = await Promise.all([getSite(deps, input.fromSiteId), getSite(deps, input.toSiteId)]);
  const { plan } = await currentPlan(deps);
  const key = suggestionKey(input);
  const proposal = plan.proposals.find((p) => suggestionKey(p) === key);

  // Suggested units first (soonest-expiring), then any other available units of that cell.
  const others = await deps.db
    .select({ id: schema.units.id, expiresAt: schema.units.expiresAt })
    .from(schema.units)
    .where(
      and(
        eq(schema.units.siteId, input.fromSiteId),
        eq(schema.units.bloodGroup, input.bloodGroup),
        eq(schema.units.component, input.component),
        eq(schema.units.status, "available"),
        gt(schema.units.expiresAt, deps.now + 6 * HOUR),
      ),
    );
  const suggested = proposal?.unitIds ?? [];
  const pool = [...suggested, ...others.sort((a, b) => a.expiresAt - b.expiresAt).map((u) => u.id).filter((id) => !suggested.includes(id))];
  const unitIds = pool.slice(0, input.quantity);
  if (unitIds.length === 0) throw conflict(`${from.shortName} has no movable ${input.bloodGroup} ${COMPONENT_SHORT[input.component]}`);

  const transferId = newId("TRF");
  const moved = await deps.db
    .update(schema.units)
    .set({ status: "in_transit", transferId, updatedAt: deps.now })
    .where(and(inArray(schema.units.id, unitIds), eq(schema.units.status, "available")))
    .returning({ id: schema.units.id });
  if (moved.length === 0) throw conflict("Those units were just reserved elsewhere — refresh suggestions");

  // Credit expiry rescues only for suggested units that actually moved.
  const rescued = proposal ? Math.min(proposal.rescuedFromExpiry, moved.filter((m) => proposal.unitIds.includes(m.id)).length) : 0;
  const eta = proposal?.etaMinutes ?? etaMinutes(from, to);
  const reason = proposal?.reason ?? `Manual transfer approved by ${actor}`;
  await deps.db.insert(schema.transfers).values({
    id: transferId,
    suggestionKey: key,
    fromSiteId: from.id,
    toSiteId: to.id,
    bloodGroup: input.bloodGroup,
    component: input.component,
    quantity: moved.length,
    status: "approved",
    rescuedFromExpiry: rescued,
    reason,
    etaMinutes: eta,
    createdAt: deps.now,
    decidedAt: deps.now,
    completedAt: null,
  });

  const label = `${moved.length} × ${input.bloodGroup} ${COMPONENT_SHORT[input.component]}`;
  await deps.hub.audit([
    { actor, action: "transfer.approved", entityType: "transfer", entityId: transferId, siteId: from.id, summary: `Transfer ${label}: ${from.shortName} → ${to.shortName}`, payload: { unitIds: moved.map((m) => m.id), reason } },
  ]);
  await deps.hub.publish({
    topics: ["transfers", "stock", "sites", "surge"],
    siteIds: [from.id, to.id],
    headline: `Transfer approved: ${label} ${from.shortName} → ${to.shortName} (ETA ${eta} min)`,
    tone: "success",
  });
  return (await listTransfers(deps)).find((t) => t.id === transferId)!;
}

export async function dismissTransfer(deps: Deps, input: DismissTransferInput, actor: string): Promise<void> {
  const [from, to] = await Promise.all([getSite(deps, input.fromSiteId), getSite(deps, input.toSiteId)]);
  const id = newId("TRF");
  await deps.db.insert(schema.transfers).values({
    id,
    suggestionKey: suggestionKey(input),
    fromSiteId: from.id,
    toSiteId: to.id,
    bloodGroup: input.bloodGroup,
    component: input.component,
    quantity: 0,
    status: "dismissed",
    reason: "Dismissed by operator",
    etaMinutes: 0,
    createdAt: deps.now,
    decidedAt: deps.now,
  });
  await deps.hub.audit([
    { actor, action: "transfer.dismissed", entityType: "transfer", entityId: id, siteId: from.id, summary: `Dismissed suggestion ${input.bloodGroup} ${COMPONENT_SHORT[input.component]} ${from.shortName} → ${to.shortName}` },
  ]);
  await deps.hub.publish({ topics: ["transfers"], siteIds: [from.id, to.id] });
}

export async function completeTransfer(deps: Deps, transferId: string, actor: string): Promise<TransferDTO> {
  const [t] = await deps.db.select().from(schema.transfers).where(eq(schema.transfers.id, transferId));
  if (!t) throw notFound("Transfer");
  if (t.status !== "approved") throw conflict(`Transfer is already ${t.status}`);
  await deps.db
    .update(schema.units)
    .set({ siteId: t.toSiteId, status: "available", transferId: null, offeredAt: null, updatedAt: deps.now })
    .where(and(eq(schema.units.transferId, transferId), eq(schema.units.status, "in_transit")));
  await deps.db.update(schema.transfers).set({ status: "completed", completedAt: deps.now }).where(eq(schema.transfers.id, transferId));
  await touchSync(deps, [t.fromSiteId, t.toSiteId]);

  const to = await getSite(deps, t.toSiteId);
  await deps.hub.audit([
    { actor, action: "transfer.completed", entityType: "transfer", entityId: transferId, siteId: t.toSiteId, summary: `${to.shortName} received ${t.quantity} × ${t.bloodGroup} ${COMPONENT_SHORT[t.component]}` },
  ]);
  await deps.hub.publish({ topics: ["transfers", "stock", "sites", "surge"], siteIds: [t.fromSiteId, t.toSiteId], headline: `${to.shortName} received transfer ${transferId}`, tone: "success" });
  return (await listTransfers(deps)).find((x) => x.id === transferId)!;
}

/** "Offer for transfer" from the hospital stock panel — offered units become spare in the plan. */
export async function offerUnits(deps: Deps, siteId: string, input: OfferUnitsInput, actor: string): Promise<number> {
  const site = await getSite(deps, siteId);
  const updated = await deps.db
    .update(schema.units)
    .set({ offeredAt: deps.now, updatedAt: deps.now })
    .where(and(eq(schema.units.siteId, siteId), inArray(schema.units.id, input.unitIds), eq(schema.units.status, "available")))
    .returning({ id: schema.units.id });
  await deps.hub.audit([
    { actor, action: "stock.offered", entityType: "site", entityId: siteId, siteId, summary: `${site.shortName} offered ${updated.length} unit${updated.length === 1 ? "" : "s"} for transfer`, payload: { unitIds: updated.map((u) => u.id) } },
  ]);
  await deps.hub.publish({ topics: ["transfers", "stock", "surge"], siteIds: [siteId], headline: `${site.shortName} offered ${updated.length} expiring unit${updated.length === 1 ? "" : "s"} for transfer`, tone: "info" });
  return updated.length;
}

/* ─────────────────────────────── Surge ─────────────────────────────── */

export async function startSurge(deps: Deps, input: StartSurgeInput, actor: string): Promise<SurgeDTO> {
  const preset = SURGE_PRESETS[input.kind];
  const area = areaById(input.areaId ?? SURGE_DEFAULT_AREA[input.kind]);
  if (!area) throw badRequest("Unknown area");
  await deps.db.update(schema.surgeEvents).set({ endedAt: deps.now }).where(isNull(schema.surgeEvents.endedAt));
  const row: SurgeRow = {
    id: newId("SRG"),
    kind: input.kind,
    areaId: area.id,
    epicenterLat: area.lat,
    epicenterLng: area.lng,
    radiusKm: preset.radiusKm,
    multipliers: preset.multipliers,
    startedAt: deps.now,
    endedAt: null,
    brief: null,
  };
  await deps.db.insert(schema.surgeEvents).values(row);
  await deps.hub.audit([
    { actor, action: "surge.started", entityType: "surge", entityId: row.id, summary: `SIMULATED ${preset.label} declared in ${area.name}`, payload: { multipliers: preset.multipliers } },
  ]);
  await deps.hub.publish({ topics: ["surge", "transfers"], headline: `SURGE MODE · Simulated ${preset.label.toLowerCase()} in ${area.name}`, tone: "critical" });
  return toSurgeDTO(row);
}

export async function endSurge(deps: Deps, actor: string): Promise<void> {
  const row = await activeSurgeRow(deps);
  if (!row) return;
  await deps.db.update(schema.surgeEvents).set({ endedAt: deps.now }).where(eq(schema.surgeEvents.id, row.id));
  await deps.hub.audit([{ actor, action: "surge.ended", entityType: "surge", entityId: row.id, summary: "Surge mode stood down" }]);
  await deps.hub.publish({ topics: ["surge", "transfers"], headline: "Surge mode stood down", tone: "info" });
}

/* ─────────────────────────────── AI brief ─────────────────────────────── */

const BRIEF_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

/**
 * A 3-line situation brief for the command view. Generated by an open model on
 * Workers AI from the forecast numbers only (no personal data), cached per surge,
 * with a deterministic template fallback so the demo never depends on the model.
 */
export async function surgeBrief(deps: Deps): Promise<SurgeBriefDTO> {
  const row = await activeSurgeRow(deps);
  const f = await forecast(deps);
  const template = templateBrief(f);
  if (!row) return { text: template, source: "template", generatedAt: deps.now };
  if (row.brief) return JSON.parse(row.brief) as SurgeBriefDTO;

  let brief: SurgeBriefDTO = { text: template, source: "template", generatedAt: deps.now };
  try {
    const facts = {
      event: `${f.surge!.label} in ${f.surge!.areaName}`,
      firstToRunOut: f.outlook.slice(0, 4).map((o) => `${o.bloodGroup} ${COMPONENT_LABEL[o.component]}: ${o.stockoutHours ?? ">72"}h`),
      sitesAtRisk: f.sites.filter((s) => (s.earliestStockoutHours ?? 99) < 24).map((s) => s.name),
      unitsExpiringUnused: f.current.expectedWaste,
      withTransferPlan: f.withPlan,
    };
    const result = (await deps.env.AI.run(BRIEF_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "You write terse situation briefs for a blood-bank coordination desk. Exactly 3 short lines, each starting with '• '. Use only the numbers given. No patient data, no clinical advice, no speculation. Mention that data is simulated.",
        },
        { role: "user", content: JSON.stringify(facts) },
      ],
      max_tokens: 200,
    })) as { response?: string };
    const text = result.response?.trim();
    if (text) brief = { text, source: "workers-ai", generatedAt: deps.now };
  } catch {
    // Fall back to the template — the brief is a nice-to-have, never a dependency.
  }
  await deps.db.update(schema.surgeEvents).set({ brief: JSON.stringify(brief) }).where(eq(schema.surgeEvents.id, row.id));
  return brief;
}

function templateBrief(f: ForecastDTO): string {
  if (!f.surge) return "• No active surge. City stock is within normal range (simulated data).";
  const first = f.outlook[0];
  const atRisk = f.sites.filter((s) => (s.earliestStockoutHours ?? 99) < 24).map((s) => s.name);
  return [
    `• SIMULATED ${f.surge.label.toLowerCase()} in ${f.surge.areaName}: demand multiplied up to ${Math.max(...Object.values(f.surge.multipliers))}× near the epicentre.`,
    first
      ? `• ${first.bloodGroup} ${COMPONENT_LABEL[first.component].toLowerCase()} runs out first (~${first.stockoutHours ?? ">72"}h city-wide); ${atRisk.length} site${atRisk.length === 1 ? "" : "s"} at risk within 24h${atRisk.length ? `: ${atRisk.join(", ")}` : ""}.`
      : "• No group is forecast to run out within the horizon.",
    `• Transfer plan cuts projected shortfall ${f.current.shortfall} → ${f.withPlan.shortfall} units and expiring units ${f.current.expectedWaste} → ${f.withPlan.expectedWaste}.`,
  ].join("\n");
}

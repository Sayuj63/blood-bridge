import { and, desc, eq, gt, inArray, notInArray, or } from "drizzle-orm";
import type {
  CreateRequestInput,
  QueueItemDTO,
  RequestDTO,
  ReservationDTO,
  SearchInput,
  SearchResultDTO,
  SplitLegResultDTO,
  SplitReservationDTO,
  TimelineStep,
} from "../../shared/api";
import { compatibleSources } from "../../shared/compatibility";
import { COMPONENT_SHORT, POLICY, type GeoPoint, type ReservationStatus } from "../../shared/domain";
import { rankSites, type CandidateSite, type RankedOption } from "../../shared/ranking";
import { planSplit, type SplitPlan } from "../../shared/split";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { AppError, conflict, notFound } from "../lib/http";
import { newId } from "../lib/ids";
import { getSite, touchSync } from "./sites";

type RequestRow = typeof schema.requests.$inferSelect;
type ReservationRow = typeof schema.reservations.$inferSelect;

const MINUTE = 60_000;
/** Statuses that hold or consume units on behalf of a request. */
const LIVE: ReservationStatus[] = ["requested", "confirmed", "reserved", "picked_up", "delivered"];
const OPEN: ReservationStatus[] = ["requested", "confirmed", "reserved", "picked_up"];

/* ─────────────────────────────── Search ─────────────────────────────── */

async function candidateSites(deps: Deps, input: SearchInput, onlyBankIds?: string[]): Promise<CandidateSite[]> {
  const groups = compatibleSources(input.bloodGroup, input.component).map((s) => s.group);
  const banks = await deps.db
    .select()
    .from(schema.sites)
    .where(
      onlyBankIds
        ? and(eq(schema.sites.kind, "blood_bank"), inArray(schema.sites.id, onlyBankIds))
        : eq(schema.sites.kind, "blood_bank"),
    );
  const units = await deps.db
    .select({
      id: schema.units.id,
      siteId: schema.units.siteId,
      bloodGroup: schema.units.bloodGroup,
      component: schema.units.component,
      expiresAt: schema.units.expiresAt,
    })
    .from(schema.units)
    .where(
      and(
        eq(schema.units.status, "available"),
        eq(schema.units.component, input.component),
        inArray(schema.units.bloodGroup, groups),
        gt(schema.units.expiresAt, deps.now),
        inArray(schema.units.siteId, banks.map((b) => b.id)),
      ),
    );
  return banks.map((b) => ({
    siteId: b.id,
    name: b.name,
    location: { lat: b.lat, lng: b.lng },
    lastSyncAt: b.lastSyncAt,
    units: units.filter((u) => u.siteId === b.id),
  }));
}

/**
 * Ranked search from any point (e.g. the locality named in a WhatsApp message).
 * Read-only: it lists options; reserving still requires a hospital request.
 */
export async function searchNear(deps: Deps, origin: GeoPoint, input: Omit<SearchInput, "hospitalId">): Promise<RankedOption[]> {
  const sites = await candidateSites(deps, { ...input, hospitalId: "" });
  return rankSites({ ...input, origin, now: deps.now }, sites);
}

export async function search(deps: Deps, input: SearchInput): Promise<SearchResultDTO> {
  const hospital = await getSite(deps, input.hospitalId);
  const sites = await candidateSites(deps, input);
  const options = rankSites({ ...input, origin: { lat: hospital.lat, lng: hospital.lng }, now: deps.now }, sites);

  let noMatch: SearchResultDTO["noMatch"] = null;
  if (options.length === 0) {
    const anyStock = await deps.db
      .selectDistinct({ siteId: schema.units.siteId })
      .from(schema.units)
      .where(and(eq(schema.units.status, "available"), eq(schema.units.component, input.component)));
    noMatch = {
      nearestAnyStockSiteIds: anyStock.map((s) => s.siteId),
      hint: `No compatible in-date ${COMPONENT_SHORT[input.component]} for ${input.bloodGroup} right now. Raise a critical alert to reach eligible donors, or check transfer suggestions.`,
    };
  }
  return { options, noMatch, searchedAt: deps.now };
}

/* ─────────────────────────────── Requests ─────────────────────────────── */

export async function createRequest(deps: Deps, input: CreateRequestInput, actor: string): Promise<RequestDTO> {
  const hospital = await getSite(deps, input.hospitalId);

  // Anti-abuse: duplicate detection — same hospital, group and component still open in the last 10 minutes.
  const [duplicate] = await deps.db
    .select({ id: schema.requests.id })
    .from(schema.requests)
    .where(
      and(
        eq(schema.requests.hospitalId, input.hospitalId),
        eq(schema.requests.bloodGroup, input.bloodGroup),
        eq(schema.requests.component, input.component),
        eq(schema.requests.ward, input.ward),
        eq(schema.requests.status, "open"),
        gt(schema.requests.createdAt, deps.now - 10 * MINUTE),
      ),
    );
  if (duplicate) {
    throw new AppError(409, "duplicate_request", "An identical request from this ward is already open", { requestId: duplicate.id });
  }

  const row: RequestRow = {
    id: newId("REQ"),
    hospitalId: input.hospitalId,
    bloodGroup: input.bloodGroup,
    component: input.component,
    unitsNeeded: input.unitsNeeded,
    urgency: input.urgency,
    neededBy: input.neededBy,
    ward: input.ward,
    status: "open",
    criticalBroadcastAt: null,
    createdAt: deps.now,
  };
  await deps.db.insert(schema.requests).values(row);
  await deps.hub.audit([
    {
      actor,
      action: "request.created",
      entityType: "request",
      entityId: row.id,
      siteId: hospital.id,
      summary: `${hospital.shortName} requested ${row.unitsNeeded} × ${row.bloodGroup} ${COMPONENT_SHORT[row.component]} (${row.urgency})`,
    },
  ]);
  await deps.hub.publish({ topics: ["requests"], siteIds: [hospital.id] });
  return getRequest(deps, row.id);
}

async function loadRequest(deps: Deps, requestId: string): Promise<RequestRow> {
  const [request] = await deps.db.select().from(schema.requests).where(eq(schema.requests.id, requestId));
  if (!request) throw notFound("Request");
  return request;
}

/** Hold units at a bank for a request. Conditional update guards against double-booking. */
export async function reserve(deps: Deps, requestId: string, bankSiteId: string, actor: string, note?: string): Promise<RequestDTO> {
  const request = await loadRequest(deps, requestId);
  if (request.status !== "open") throw conflict(`Request is already ${request.status}`);

  const existing = await deps.db.select().from(schema.reservations).where(eq(schema.reservations.requestId, requestId));
  if (existing.some((r) => r.bankSiteId === bankSiteId && OPEN.includes(r.status))) {
    throw conflict("This blood bank already holds a live reservation for the request");
  }
  const held = existing.filter((r) => LIVE.includes(r.status)).reduce((n, r) => n + r.unitsCount, 0);
  const remaining = request.unitsNeeded - held;
  if (remaining <= 0) throw conflict("Request is already fully covered");

  const hospital = await getSite(deps, request.hospitalId);
  const bank = await getSite(deps, bankSiteId);
  const [option] = rankSites(
    { ...request, unitsNeeded: remaining, origin: { lat: hospital.lat, lng: hospital.lng }, now: deps.now },
    await candidateSites(deps, { ...request, hospitalId: request.hospitalId, unitsNeeded: remaining }, [bankSiteId]),
  );
  if (!option) throw conflict(`${bank.shortName} no longer has compatible in-date stock`);

  const reservationId = newId("RES");
  const unitIds = option.allocation.map((u) => u.id);
  const heldRows = await deps.db
    .update(schema.units)
    .set({ status: "reserved", reservationId, updatedAt: deps.now })
    .where(and(inArray(schema.units.id, unitIds), eq(schema.units.status, "available")))
    .returning({ id: schema.units.id });
  if (heldRows.length !== unitIds.length) {
    await releaseUnits(deps, heldRows.map((r) => r.id));
    throw new AppError(409, "conflicting_reservation", "Another request just reserved some of these units. Search again for live stock.");
  }

  const confirmBy = deps.now + POLICY.confirmWindowSeconds * 1000;
  await deps.db.insert(schema.reservations).values({
    id: reservationId,
    requestId,
    bankSiteId,
    status: "requested",
    unitsCount: unitIds.length,
    matchType: option.matchType,
    requiresPhoneConfirm: option.stale,
    phoneConfirmedAt: null,
    declineReason: null,
    etaMinutes: option.etaMinutes,
    confirmBy,
    holdExpiresAt: null,
    requestedAt: deps.now,
    updatedAt: deps.now,
  });
  await deps.hub.scheduleSweep(confirmBy);

  const label = `${unitIds.length} × ${request.bloodGroup} ${COMPONENT_SHORT[request.component]}`;
  await deps.hub.audit([
    {
      actor,
      action: "reservation.requested",
      entityType: "reservation",
      entityId: reservationId,
      siteId: bankSiteId,
      summary: `${hospital.shortName} → ${bank.shortName}: hold ${label}${note ? ` (${note})` : ""}`,
      payload: { requestId, unitIds, matchType: option.matchType },
    },
  ]);
  await deps.hub.publish({
    topics: ["reservations", "requests", "stock", "sites"],
    siteIds: [bankSiteId, hospital.id],
    headline: `${request.urgency === "critical" ? "CRITICAL · " : ""}${hospital.shortName} needs ${label} from ${bank.shortName}`,
    tone: request.urgency === "critical" ? "critical" : request.urgency === "urgent" ? "warning" : "info",
  });
  return getRequest(deps, requestId);
}

async function loadReservation(deps: Deps, reservationId: string): Promise<ReservationRow> {
  const [row] = await deps.db.select().from(schema.reservations).where(eq(schema.reservations.id, reservationId));
  if (!row) throw notFound("Reservation");
  return row;
}

async function releaseUnits(deps: Deps, unitIds: string[]) {
  if (unitIds.length === 0) return;
  await deps.db
    .update(schema.units)
    .set({ status: "available", reservationId: null, updatedAt: deps.now })
    .where(and(inArray(schema.units.id, unitIds), eq(schema.units.status, "reserved")));
}

async function reservationUnitIds(deps: Deps, reservationId: string): Promise<string[]> {
  const rows = await deps.db
    .select({ id: schema.units.id, expiresAt: schema.units.expiresAt })
    .from(schema.units)
    .where(eq(schema.units.reservationId, reservationId));
  return rows.sort((a, b) => a.expiresAt - b.expiresAt).map((r) => r.id);
}

export async function confirmReservation(deps: Deps, reservationId: string, units: number | undefined, actor: string): Promise<ReservationDTO> {
  const res = await loadReservation(deps, reservationId);
  if (res.status !== "requested") throw conflict(`Reservation is already ${res.status}`);
  const unitIds = await reservationUnitIds(deps, reservationId);
  const keep = Math.min(units ?? unitIds.length, unitIds.length);
  await releaseUnits(deps, unitIds.slice(keep));

  const holdExpiresAt = deps.now + POLICY.reservationHoldMinutes * MINUTE;
  const [updated] = await deps.db
    .update(schema.reservations)
    // The bank confirming in-system verifies the stock, so no separate phone check is needed.
    .set({ status: "reserved", unitsCount: keep, confirmedAt: deps.now, reservedAt: deps.now, holdExpiresAt, requiresPhoneConfirm: false, updatedAt: deps.now })
    .where(and(eq(schema.reservations.id, reservationId), eq(schema.reservations.status, "requested")))
    .returning();
  if (!updated) throw conflict("Reservation changed — refresh and try again");
  await touchSync(deps, [res.bankSiteId]);
  await deps.hub.scheduleSweep(holdExpiresAt);

  const bank = await getSite(deps, res.bankSiteId);
  const request = await loadRequest(deps, res.requestId);
  const partial = keep < unitIds.length;
  await deps.hub.audit([
    {
      actor,
      action: partial ? "reservation.partially_confirmed" : "reservation.confirmed",
      entityType: "reservation",
      entityId: reservationId,
      siteId: res.bankSiteId,
      summary: `${bank.shortName} ${partial ? `partially confirmed ${keep} of ${unitIds.length}` : `confirmed ${keep}`} unit${keep === 1 ? "" : "s"} for ${request.id}`,
    },
  ]);
  await deps.hub.publish({
    topics: ["reservations", "requests", "stock", "sites"],
    siteIds: [res.bankSiteId, request.hospitalId],
    headline: `${bank.shortName} ${partial ? "partially confirmed" : "confirmed"} — pickup in ${res.etaMinutes} min`,
    tone: "success",
  });
  return (await getRequest(deps, res.requestId)).reservations.find((r) => r.id === reservationId)!;
}

export async function declineReservation(deps: Deps, reservationId: string, reason: string, actor: string): Promise<RequestDTO> {
  const res = await loadReservation(deps, reservationId);
  if (!["requested", "reserved"].includes(res.status)) throw conflict(`Reservation is already ${res.status}`);
  await closeReservation(deps, res, "declined", reason, actor);
  return rerouteRequest(deps, res.requestId, `declined by bank: ${reason}`);
}

async function closeReservation(deps: Deps, res: ReservationRow, status: "declined" | "expired" | "released", reason: string, actor: string) {
  await releaseUnits(deps, await reservationUnitIds(deps, res.id));
  await deps.db
    .update(schema.reservations)
    .set({ status, declineReason: reason, updatedAt: deps.now })
    .where(eq(schema.reservations.id, res.id));
  const bank = await getSite(deps, res.bankSiteId);
  const request = await loadRequest(deps, res.requestId);
  await deps.hub.audit([
    { actor, action: `reservation.${status}`, entityType: "reservation", entityId: res.id, siteId: res.bankSiteId, summary: `${bank.shortName}: reservation ${status} — ${reason}` },
  ]);
  await deps.hub.publish({
    topics: ["reservations", "requests", "stock", "sites"],
    siteIds: [res.bankSiteId, request.hospitalId],
    headline: `${bank.shortName}: ${status === "declined" ? "declined" : status === "expired" ? "timed out" : "released"} — ${reason}`,
    tone: "warning",
  });
}

/**
 * Self-healing: when a bank declines or fails to confirm in time, automatically
 * move the request to the next-best bank that has not already been tried.
 */
export async function rerouteRequest(deps: Deps, requestId: string, cause: string): Promise<RequestDTO> {
  const request = await loadRequest(deps, requestId);
  if (request.status !== "open") return getRequest(deps, requestId);
  const tried = await deps.db
    .select({ bankSiteId: schema.reservations.bankSiteId, status: schema.reservations.status, unitsCount: schema.reservations.unitsCount })
    .from(schema.reservations)
    .where(eq(schema.reservations.requestId, requestId));
  const held = tried.filter((r) => LIVE.includes(r.status)).reduce((n, r) => n + r.unitsCount, 0);
  const remaining = request.unitsNeeded - held;
  if (remaining <= 0) return getRequest(deps, requestId);

  const hospital = await getSite(deps, request.hospitalId);
  const excluded = new Set(tried.map((t) => t.bankSiteId));
  const options = rankSites(
    { ...request, unitsNeeded: remaining, origin: { lat: hospital.lat, lng: hospital.lng }, now: deps.now },
    await candidateSites(deps, { ...request, unitsNeeded: remaining }),
  ).filter((o: RankedOption) => !excluded.has(o.siteId));

  const next = options[0];
  if (!next) {
    await deps.hub.publish({
      topics: ["requests"],
      siteIds: [hospital.id],
      headline: `${hospital.shortName}: no further compatible ${request.bloodGroup} ${COMPONENT_SHORT[request.component]} — consider a critical donor alert`,
      tone: "critical",
    });
    return getRequest(deps, requestId);
  }
  return reserve(deps, requestId, next.siteId, "system", `auto-rerouted: ${cause}`);
}

/* ─────────────────────────────── Split reservation ─────────────────────────────── */

/** Ranked banks for the units still uncovered, minus banks already tried for this request. */
async function remainingOptions(deps: Deps, request: RequestRow) {
  const tried = await deps.db
    .select({ bankSiteId: schema.reservations.bankSiteId, status: schema.reservations.status, unitsCount: schema.reservations.unitsCount })
    .from(schema.reservations)
    .where(eq(schema.reservations.requestId, request.id));
  const held = tried.filter((r) => LIVE.includes(r.status)).reduce((n, r) => n + r.unitsCount, 0);
  const remaining = Math.max(0, request.unitsNeeded - held);
  if (remaining === 0) return { held, remaining, options: [] as RankedOption[] };
  const hospital = await getSite(deps, request.hospitalId);
  const excluded = new Set(tried.map((t) => t.bankSiteId));
  const options = rankSites(
    { ...request, unitsNeeded: remaining, origin: { lat: hospital.lat, lng: hospital.lng }, now: deps.now },
    await candidateSites(deps, { ...request, unitsNeeded: remaining }),
  ).filter((o) => !excluded.has(o.siteId));
  return { held, remaining, options };
}

/** Read-only: how the uncovered units of a request would be split across banks right now. */
export async function planRequestSplit(deps: Deps, requestId: string): Promise<{ remaining: number; plan: SplitPlan }> {
  const request = await loadRequest(deps, requestId);
  const { remaining, options } = await remainingOptions(deps, request);
  return { remaining, plan: planSplit(options, remaining, request.bloodGroup) };
}

/**
 * Cover every uncovered unit in one action: plan the split, then hold each leg with the
 * normal `reserve` (which guards against double-booking). A leg that conflicts is skipped
 * and the next-ranked bank is tried instead. One "split reservation" audit entry sums it up.
 */
export async function reserveSplit(deps: Deps, requestId: string, actor: string): Promise<SplitReservationDTO> {
  const request = await loadRequest(deps, requestId);
  if (request.status !== "open") throw conflict(`Request is already ${request.status}`);
  const { remaining, options } = await remainingOptions(deps, request);
  if (remaining <= 0) throw conflict("Request is already fully covered");
  const plan = planSplit(options, remaining, request.bloodGroup);
  if (plan.legs.length === 0) throw conflict(`No bank has compatible in-date ${COMPONENT_SHORT[request.component]} for ${request.bloodGroup} right now`);

  // Planned legs first (in plan order), then every other ranked bank as a fallback.
  const planned = new Set(plan.legs.map((l) => l.siteId));
  const queue = [...plan.legs.map((l) => ({ siteId: l.siteId, name: l.name })), ...options.filter((o) => !planned.has(o.siteId))];

  const legs: SplitLegResultDTO[] = [];
  let latest = await getRequest(deps, requestId);
  let left = remaining;
  for (const bank of queue) {
    if (left <= 0) break;
    const before = new Set(latest.reservations.map((r) => r.id));
    try {
      latest = await reserve(deps, requestId, bank.siteId, actor, `split ${legs.filter((l) => l.outcome === "reserved").length + 1}`);
      const made = latest.reservations.find((r) => !before.has(r.id) && r.bankSiteId === bank.siteId);
      legs.push({ siteId: bank.siteId, name: bank.name, units: made?.unitsCount ?? 0, outcome: "reserved", reservationId: made?.id ?? null, error: null });
      left = request.unitsNeeded - latest.reservations.filter((r) => LIVE.includes(r.status)).reduce((n, r) => n + r.unitsCount, 0);
    } catch (err) {
      if (!(err instanceof AppError) || err.status !== 409) throw err;
      legs.push({ siteId: bank.siteId, name: bank.name, units: 0, outcome: "failed", reservationId: null, error: err.message });
      // A 409 can also mean the request itself closed meanwhile: stop rather than spin.
      if ((await loadRequest(deps, requestId)).status !== "open") break;
    }
  }

  const reserved = legs.filter((l) => l.outcome === "reserved");
  const newlyHeld = reserved.reduce((n, l) => n + l.units, 0);
  const unitsHeld = request.unitsNeeded - Math.max(0, left);
  const shortBy = Math.max(0, left);
  const hospital = await getSite(deps, request.hospitalId);
  const label = `${request.bloodGroup} ${COMPONENT_SHORT[request.component]}`;
  await deps.hub.audit([
    {
      actor,
      action: "request.split_reserved",
      entityType: "request",
      entityId: requestId,
      siteId: hospital.id,
      summary: `${hospital.shortName}: split reservation of ${newlyHeld} × ${label} across ${reserved.length} bank${reserved.length === 1 ? "" : "s"}${
        reserved.length ? ` (${reserved.map((l) => `${l.name} ${l.units}`).join(", ")})` : ""
      }${shortBy > 0 ? ` · short by ${shortBy}` : ""}`,
      payload: { plan, legs },
    },
  ]);
  if (shortBy > 0) {
    await deps.hub.publish({
      topics: ["requests"],
      siteIds: [hospital.id],
      headline: `${hospital.shortName}: ${unitsHeld} of ${request.unitsNeeded} ${request.bloodGroup} ${COMPONENT_SHORT[request.component]} covered — raise a critical alert for the rest`,
      tone: "critical",
    });
  }
  return { request: latest, plan, legs, unitsNeeded: request.unitsNeeded, unitsHeld, shortBy };
}

export async function phoneConfirm(deps: Deps, reservationId: string, actor: string): Promise<ReservationDTO> {
  const res = await loadReservation(deps, reservationId);
  await deps.db
    .update(schema.reservations)
    .set({ phoneConfirmedAt: deps.now, updatedAt: deps.now })
    .where(eq(schema.reservations.id, reservationId));
  const bank = await getSite(deps, res.bankSiteId);
  await deps.hub.audit([
    { actor, action: "reservation.phone_confirmed", entityType: "reservation", entityId: reservationId, siteId: res.bankSiteId, summary: `Stock at ${bank.shortName} confirmed by phone` },
  ]);
  await deps.hub.publish({ topics: ["reservations", "requests"], siteIds: [res.bankSiteId] });
  return (await getRequest(deps, res.requestId)).reservations.find((r) => r.id === reservationId)!;
}

export async function advanceReservation(deps: Deps, reservationId: string, to: "picked_up" | "delivered", actor: string): Promise<RequestDTO> {
  const res = await loadReservation(deps, reservationId);
  const from: ReservationStatus = to === "picked_up" ? "reserved" : "picked_up";
  if (res.status !== from) throw conflict(`Reservation must be ${from.replace("_", " ")} first`);
  if (to === "picked_up" && res.requiresPhoneConfirm && !res.phoneConfirmedAt) {
    throw new AppError(409, "phone_confirm_required", "Stock data was stale — confirm availability by phone before pickup");
  }

  await deps.db
    .update(schema.reservations)
    .set(to === "picked_up" ? { status: to, pickedUpAt: deps.now, updatedAt: deps.now } : { status: to, deliveredAt: deps.now, updatedAt: deps.now })
    .where(eq(schema.reservations.id, reservationId));

  const request = await loadRequest(deps, res.requestId);
  if (to === "delivered") {
    await deps.db
      .update(schema.units)
      .set({ status: "used", updatedAt: deps.now })
      .where(eq(schema.units.reservationId, reservationId));
    const delivered = await deps.db
      .select({ n: schema.reservations.unitsCount })
      .from(schema.reservations)
      .where(and(eq(schema.reservations.requestId, request.id), eq(schema.reservations.status, "delivered")));
    if (delivered.reduce((n, r) => n + r.n, 0) >= request.unitsNeeded) {
      await deps.db.update(schema.requests).set({ status: "fulfilled" }).where(eq(schema.requests.id, request.id));
    }
  }

  const bank = await getSite(deps, res.bankSiteId);
  const hospital = await getSite(deps, request.hospitalId);
  const verb = to === "picked_up" ? "picked up from" : "delivered to";
  const where = to === "picked_up" ? bank.shortName : hospital.shortName;
  await deps.hub.audit([
    { actor, action: `reservation.${to}`, entityType: "reservation", entityId: reservationId, siteId: res.bankSiteId, summary: `${res.unitsCount} unit${res.unitsCount === 1 ? "" : "s"} ${verb} ${where}` },
  ]);
  await deps.hub.publish({
    topics: ["reservations", "requests", "stock", "sites"],
    siteIds: [res.bankSiteId, request.hospitalId],
    headline: `${res.unitsCount} × ${request.bloodGroup} ${COMPONENT_SHORT[request.component]} ${verb} ${where}${to === "delivered" ? ` (${request.ward})` : ""}`,
    tone: "success",
  });
  return getRequest(deps, request.id);
}

/* ─────────────────────────────── Read models ─────────────────────────────── */

function timeline(r: ReservationRow): TimelineStep[] {
  return [
    { step: "requested", at: r.requestedAt },
    { step: "confirmed", at: r.confirmedAt },
    { step: "reserved", at: r.reservedAt },
    { step: "picked_up", at: r.pickedUpAt },
    { step: "delivered", at: r.deliveredAt },
  ];
}

async function buildRequests(deps: Deps, rows: RequestRow[]): Promise<RequestDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const reservations = await deps.db
    .select()
    .from(schema.reservations)
    .where(inArray(schema.reservations.requestId, ids))
    .orderBy(desc(schema.reservations.requestedAt));
  const resIds = reservations.map((r) => r.id);
  const units = resIds.length
    ? await deps.db
        .select({ id: schema.units.id, bloodGroup: schema.units.bloodGroup, component: schema.units.component, expiresAt: schema.units.expiresAt, reservationId: schema.units.reservationId })
        .from(schema.units)
        .where(inArray(schema.units.reservationId, resIds))
    : [];
  const sites = await deps.db.select({ id: schema.sites.id, name: schema.sites.name }).from(schema.sites);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  return rows.map((r) => {
    const resDTOs: ReservationDTO[] = reservations
      .filter((x) => x.requestId === r.id)
      .map((x) => ({
        id: x.id,
        requestId: x.requestId,
        bankSiteId: x.bankSiteId,
        bankName: siteName.get(x.bankSiteId) ?? x.bankSiteId,
        status: x.status,
        unitsCount: x.unitsCount,
        units: units.filter((u) => u.reservationId === x.id).map(({ reservationId: _, ...u }) => u),
        matchType: x.matchType,
        needsClinicianConfirmation: x.matchType !== "exact",
        requiresPhoneConfirm: x.requiresPhoneConfirm,
        phoneConfirmedAt: x.phoneConfirmedAt,
        declineReason: x.declineReason,
        etaMinutes: x.etaMinutes,
        confirmBy: x.confirmBy,
        holdExpiresAt: x.holdExpiresAt,
        timeline: timeline(x),
        createdAt: x.requestedAt,
        updatedAt: x.updatedAt,
      }));
    return {
      ...r,
      hospitalName: siteName.get(r.hospitalId) ?? r.hospitalId,
      reservations: resDTOs,
      active: resDTOs.find((x) => LIVE.includes(x.status)) ?? null,
    };
  });
}

export async function getRequest(deps: Deps, requestId: string): Promise<RequestDTO> {
  const [dto] = await buildRequests(deps, [await loadRequest(deps, requestId)]);
  return dto;
}

export async function listRequests(deps: Deps, hospitalId: string): Promise<RequestDTO[]> {
  const rows = await deps.db
    .select()
    .from(schema.requests)
    .where(and(eq(schema.requests.hospitalId, hospitalId), gt(schema.requests.createdAt, deps.now - 24 * 60 * MINUTE)))
    .orderBy(desc(schema.requests.createdAt))
    .limit(30);
  return buildRequests(deps, rows);
}

const URGENCY_RANK = { critical: 0, urgent: 1, routine: 2 } as const;
const STATUS_RANK: Partial<Record<ReservationStatus, number>> = { requested: 0, reserved: 1, picked_up: 2 };

/** Incoming requests for a blood bank: actionable first, critical first, then by deadline. */
export async function bankQueue(deps: Deps, bankSiteId: string): Promise<QueueItemDTO[]> {
  const reservations = await deps.db
    .select()
    .from(schema.reservations)
    .where(
      and(
        eq(schema.reservations.bankSiteId, bankSiteId),
        or(
          inArray(schema.reservations.status, ["requested", "reserved", "picked_up"]),
          and(notInArray(schema.reservations.status, ["requested", "reserved", "picked_up"]), gt(schema.reservations.updatedAt, deps.now - 30 * MINUTE)),
        ),
      ),
    );
  if (reservations.length === 0) return [];
  const requestRows = await deps.db
    .select()
    .from(schema.requests)
    .where(inArray(schema.requests.id, [...new Set(reservations.map((r) => r.requestId))]));
  const requests = await buildRequests(deps, requestRows);
  const hospitals = await deps.db
    .select({ id: schema.sites.id, name: schema.sites.name, lat: schema.sites.lat, lng: schema.sites.lng })
    .from(schema.sites)
    .where(inArray(schema.sites.id, requestRows.map((r) => r.hospitalId)));

  return reservations
    .map((res) => {
      const { reservations: all, active: _, ...request } = requests.find((r) => r.id === res.requestId)!;
      return { reservation: all.find((x) => x.id === res.id)!, request, hospital: hospitals.find((h) => h.id === request.hospitalId)! };
    })
    .sort(
      (a, b) =>
        (STATUS_RANK[a.reservation.status] ?? 9) - (STATUS_RANK[b.reservation.status] ?? 9) ||
        URGENCY_RANK[a.request.urgency] - URGENCY_RANK[b.request.urgency] ||
        a.request.neededBy - b.request.neededBy,
    );
}

/** Sweep helper: requests whose bank did not confirm in time, and holds nobody collected. */
export async function sweepReservations(deps: Deps): Promise<number | null> {
  const timedOut = await deps.db
    .select()
    .from(schema.reservations)
    .where(and(eq(schema.reservations.status, "requested")));
  for (const res of timedOut.filter((r) => r.confirmBy <= deps.now)) {
    await closeReservation(deps, res, "expired", `no confirmation within ${POLICY.confirmWindowSeconds}s`, "system");
    await rerouteRequest(deps, res.requestId, "bank did not confirm in time");
  }

  const held = await deps.db.select().from(schema.reservations).where(eq(schema.reservations.status, "reserved"));
  for (const res of held.filter((r) => r.holdExpiresAt !== null && r.holdExpiresAt <= deps.now)) {
    await closeReservation(deps, res, "expired", `not collected within ${POLICY.reservationHoldMinutes} min — units returned to stock`, "system");
  }

  const pending = await deps.db
    .select({ confirmBy: schema.reservations.confirmBy, holdExpiresAt: schema.reservations.holdExpiresAt, status: schema.reservations.status })
    .from(schema.reservations)
    .where(inArray(schema.reservations.status, ["requested", "reserved"]));
  const times = pending.map((p) => (p.status === "requested" ? p.confirmBy : p.holdExpiresAt)).filter((t): t is number => t !== null);
  return times.length ? Math.min(...times) : null;
}

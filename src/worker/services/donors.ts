import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type {
  DonorAlertDTO,
  DonorDriveInput,
  DonorDrivePreviewDTO,
  DonorDriveResultDTO,
  DonorDTO,
  DonorPreferencesInput,
  DonorSignupInput,
  IncomingDonorDTO,
} from "../../shared/api";
import { COMPONENT_LABEL, POLICY, type BloodGroup, type Language, type Urgency } from "../../shared/domain";
import { DEMO_ELIGIBILITY_RULES, eligibility, targetDonors, type DonorProfile } from "../../shared/eligibility";
import { approximate } from "../../shared/geo";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { AppError, badRequest, conflict, notFound } from "../lib/http";
import { confirmationCode, newId } from "../lib/ids";
import { areaById } from "../seed";
import { normalizePhone } from "../messaging/phone";
import { enqueueAlertMessages, sendOptInWelcome } from "./messaging";
import { getSite } from "./sites";

type DonorRow = typeof schema.donors.$inferSelect;
type AlertRow = typeof schema.donorAlerts.$inferSelect;

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/* ─────────────────────────────── Profiles ─────────────────────────────── */

async function loadDonor(deps: Deps, donorId: string): Promise<DonorRow> {
  const [row] = await deps.db.select().from(schema.donors).where(eq(schema.donors.id, donorId));
  if (!row) throw notFound("Donor");
  return row;
}

export async function getDonor(deps: Deps, donorId: string): Promise<DonorDTO> {
  const d = await loadDonor(deps, donorId);
  const history = await deps.db
    .select({ at: schema.donations.at, siteName: schema.sites.name, alertId: schema.donations.alertId })
    .from(schema.donations)
    .innerJoin(schema.sites, eq(schema.sites.id, schema.donations.siteId))
    .where(eq(schema.donations.donorId, donorId))
    .orderBy(desc(schema.donations.at));
  const e = eligibility(d.lastDonationAt, deps.now, DEMO_ELIGIBILITY_RULES);
  return {
    id: d.id,
    name: d.name,
    phone: d.phone,
    bloodGroup: d.bloodGroup,
    areaId: d.areaId,
    areaName: areaById(d.areaId)?.name ?? d.areaId,
    language: d.language,
    consentAlerts: d.consentAlerts,
    consentLocation: d.consentLocation,
    consentEligibility: d.consentEligibility,
    optedOutAt: d.optedOutAt,
    quietHoursStart: d.quietHoursStart,
    quietHoursEnd: d.quietHoursEnd,
    maxAlertsPerWeek: d.maxAlertsPerWeek,
    lastDonationAt: d.lastDonationAt,
    eligible: e.eligible,
    eligibleFrom: e.eligibleFrom,
    donations: history.map((h) => ({ at: h.at, siteName: h.siteName })),
    // Honest impact: one donation is one unit; "requests supported" counts only alert-driven donations.
    impact: { unitsDonated: history.length, requestsSupported: history.filter((h) => h.alertId !== null).length },
    contactChannel: d.contactChannel,
    contactOptedIn: d.contactChannel !== "none" && d.contactOptInAt !== null && d.optedOutAt === null,
  };
}

export async function listPersonas(deps: Deps): Promise<DonorDTO[]> {
  const rows = await deps.db.select({ id: schema.donors.id }).from(schema.donors).where(eq(schema.donors.persona, true));
  return Promise.all(rows.map((r) => getDonor(deps, r.id)));
}

/** Off-app contact from a signup: E.164 number + opt-in time, or `none`. */
function contactFields(input: DonorSignupInput, now: number) {
  if (input.contactChannel === "none" || !input.contactConsent) return { contactChannel: "none" as const, contactAddress: null, contactOptInAt: null };
  const address = normalizePhone(input.contactPhone ?? "");
  if (!address) throw new AppError(422, "validation_failed", "Some fields are invalid", { contactPhone: ["Enter a valid mobile number, e.g. +91 98200 12345"] });
  return { contactChannel: input.contactChannel, contactAddress: address, contactOptInAt: now };
}

/** `welcome: false` when the caller (the chat bot) confirms the opt-in itself. */
export async function signup(deps: Deps, input: DonorSignupInput, opts: { welcome?: boolean } = {}): Promise<DonorDTO> {
  const area = areaById(input.areaId);
  if (!area) throw badRequest("Unknown area");
  const contact = contactFields(input, deps.now);
  const id = newId("DNR");
  await deps.db.insert(schema.donors).values({
    id,
    name: input.name,
    phone: input.phone,
    bloodGroup: input.bloodGroup,
    areaId: area.id,
    // Only the neighbourhood centre, rounded — never an exact location.
    ...approximate({ lat: area.lat, lng: area.lng }),
    language: input.language,
    consentAlerts: input.consentAlerts,
    consentLocation: input.consentLocation,
    consentEligibility: input.consentEligibility,
    maxAlertsPerWeek: 2,
    lastDonationAt: input.lastDonationAt,
    persona: true,
    createdAt: deps.now,
    ...contact,
  });
  await deps.hub.audit([
    { actor: `donor:${id}`, action: "donor.signed_up", entityType: "donor", entityId: id, summary: `New ${input.bloodGroup} donor registered in ${area.name}` },
  ]);
  await deps.hub.publish({ topics: ["donors"] });
  if (opts.welcome !== false && contact.contactChannel !== "none") {
    await sendOptInWelcome(deps, { id, bloodGroup: input.bloodGroup, language: input.language, ...contact, optedOutAt: null });
  }
  return getDonor(deps, id);
}

export async function updatePreferences(deps: Deps, donorId: string, input: DonorPreferencesInput): Promise<DonorDTO> {
  await loadDonor(deps, donorId);
  if (Object.keys(input).length > 0) {
    await deps.db.update(schema.donors).set(input).where(eq(schema.donors.id, donorId));
    const consentChanged = ["consentAlerts", "consentLocation", "consentEligibility"].filter((k) => k in input);
    if (consentChanged.length > 0) {
      await deps.hub.audit([
        {
          actor: `donor:${donorId}`,
          action: "donor.consent_changed",
          entityType: "donor",
          entityId: donorId,
          summary: `Donor updated consent: ${consentChanged.map((k) => `${k.replace("consent", "").toLowerCase()} ${input[k as keyof DonorPreferencesInput] ? "on" : "off"}`).join(", ")}`,
        },
      ]);
    }
  }
  await deps.hub.publish({ topics: ["donors"], donorIds: [donorId] });
  return getDonor(deps, donorId);
}

/** Opt out: every consent off, and any pending alerts withdrawn. Reversible by opting back in. */
export async function setOptOut(deps: Deps, donorId: string, optOut: boolean): Promise<DonorDTO> {
  await loadDonor(deps, donorId);
  await deps.db
    .update(schema.donors)
    .set(optOut ? { optedOutAt: deps.now, consentAlerts: false, consentLocation: false, consentEligibility: false } : { optedOutAt: null })
    .where(eq(schema.donors.id, donorId));
  if (optOut) {
    await deps.db
      .update(schema.donorAlerts)
      .set({ status: "expired" })
      .where(and(eq(schema.donorAlerts.donorId, donorId), eq(schema.donorAlerts.status, "sent")));
  }
  await deps.hub.audit([
    { actor: `donor:${donorId}`, action: optOut ? "donor.opted_out" : "donor.opted_in", entityType: "donor", entityId: donorId, summary: optOut ? "Donor opted out of all alerts and sharing" : "Donor opted back in" },
  ]);
  await deps.hub.publish({ topics: ["donors", "alerts"], donorIds: [donorId] });
  return getDonor(deps, donorId);
}

/* ─────────────────────────────── Drives ─────────────────────────────── */

async function profiles(deps: Deps, bloodGroup?: BloodGroup): Promise<DonorProfile[]> {
  const rows = await deps.db
    .select()
    .from(schema.donors)
    .where(bloodGroup ? eq(schema.donors.bloodGroup, bloodGroup) : undefined);
  const weekly = await deps.db
    .select({ donorId: schema.donorAlerts.donorId, n: sql<number>`count(*)` })
    .from(schema.donorAlerts)
    .where(gt(schema.donorAlerts.createdAt, deps.now - WEEK))
    .groupBy(schema.donorAlerts.donorId);
  const counts = new Map(weekly.map((w) => [w.donorId, Number(w.n)]));
  return rows.map((d) => ({
    id: d.id,
    bloodGroup: d.bloodGroup,
    location: { lat: d.lat, lng: d.lng },
    lastDonationAt: d.lastDonationAt,
    consentAlerts: d.consentAlerts,
    consentLocation: d.consentLocation,
    optedOut: d.optedOutAt !== null,
    quietHoursStart: d.quietHoursStart,
    quietHoursEnd: d.quietHoursEnd,
    maxAlertsPerWeek: d.maxAlertsPerWeek,
    alertsThisWeek: counts.get(d.id) ?? 0,
  }));
}

/** Show the operator how many donors a drive would reach — and why others are skipped — before anything is sent. */
export async function previewDrive(deps: Deps, bankSiteId: string, bloodGroup: BloodGroup): Promise<DonorDrivePreviewDTO> {
  const bank = await getSite(deps, bankSiteId);
  const all = await profiles(deps);
  const result = targetDonors(all, { bloodGroup, origin: { lat: bank.lat, lng: bank.lng } }, deps.now, DEMO_ELIGIBILITY_RULES);
  return { bloodGroup, eligibleCount: result.eligible.length, skipped: result.skipped, totalDonors: all.length };
}

const MESSAGE: Record<Urgency, string> = {
  critical: "Urgent: {bank} urgently needs {group} donors for {component}. If you are well and able, please come today.",
  urgent: "{bank} needs {group} donors for {component} within the next day. Can you help?",
  routine: "{bank} is running low on {group}. If you are free this week, a donation would help.",
};

const LANGUAGE_CODE: Record<Language, string> = { en: "english", hi: "hindi", mr: "marathi" };
const TRANSLATE_MODEL = "@cf/meta/m2m100-1.2b";

/** Translate an alert with an open model on Workers AI. Falls back to English on any failure. */
async function translate(deps: Deps, text: string, language: Language): Promise<string | null> {
  if (language === "en") return null;
  try {
    const out = (await deps.env.AI.run(TRANSLATE_MODEL, {
      text,
      source_lang: LANGUAGE_CODE.en,
      target_lang: LANGUAGE_CODE[language],
    })) as { translated_text?: string };
    return out.translated_text?.trim() || null;
  } catch {
    return null;
  }
}

export async function sendDrive(
  deps: Deps,
  input: DonorDriveInput & { requestId?: string },
  actor: string,
): Promise<DonorDriveResultDTO> {
  const bank = await getSite(deps, input.bankSiteId);
  const all = await profiles(deps, input.bloodGroup);
  const { eligible } = targetDonors(all, { bloodGroup: input.bloodGroup, origin: { lat: bank.lat, lng: bank.lng } }, deps.now, DEMO_ELIGIBILITY_RULES);
  if (eligible.length === 0) throw conflict("No eligible, consenting donors in range right now");

  // No patient identity — only group, component and general urgency (PRD §6.3).
  const message = MESSAGE[input.urgency]
    .replace("{bank}", bank.shortName)
    .replace("{group}", input.bloodGroup)
    .replace("{component}", COMPONENT_LABEL[input.component].toLowerCase());

  const donorRows = await deps.db
    .select({ id: schema.donors.id, language: schema.donors.language })
    .from(schema.donors)
    .where(inArray(schema.donors.id, eligible.map((e) => e.donorId)));
  const languageOf = new Map(donorRows.map((d) => [d.id, d.language]));
  const languages = [...new Set(donorRows.map((d) => d.language))];
  const translations = new Map(await Promise.all(languages.map(async (l) => [l, await translate(deps, message, l)] as const)));

  const driveId = newId("DRV");
  const rows: AlertRow[] = eligible.map((e) => {
    const language = languageOf.get(e.donorId) ?? "en";
    return {
      id: newId("ALR"),
      donorId: e.donorId,
      bankSiteId: bank.id,
      driveId,
      driveNeeded: input.donorsNeeded,
      requestId: input.requestId ?? null,
      bloodGroup: input.bloodGroup,
      component: input.component,
      urgency: input.urgency,
      status: "sent",
      distanceKm: e.distanceKm,
      message,
      messageLocalized: translations.get(language) ?? null,
      language,
      confirmationCode: null,
      arrivalWindow: null,
      createdAt: deps.now,
      respondedAt: null,
    };
  });
  for (let i = 0; i < rows.length; i += 5) await deps.db.insert(schema.donorAlerts).values(rows.slice(i, i + 5));
  // WhatsApp/SMS copies for donors who explicitly opted in. Never blocks or fails the drive.
  await enqueueAlertMessages(deps, rows, bank, input.urgency).catch((err) => console.error("messaging: alert enqueue failed", err));

  await deps.hub.audit([
    {
      actor,
      action: "alerts.sent",
      entityType: "drive",
      entityId: driveId,
      siteId: bank.id,
      summary: `${bank.shortName} alerted ${rows.length} eligible ${input.bloodGroup} donor${rows.length === 1 ? "" : "s"} (${input.urgency})`,
      payload: { count: rows.length, translated: [...translations.entries()].filter(([, t]) => t).map(([l]) => l) },
    },
  ]);
  await deps.hub.publish({
    topics: ["alerts", "donors"],
    siteIds: [bank.id],
    donorIds: rows.map((r) => r.donorId),
    headline: `${bank.shortName} alerted ${rows.length} eligible ${input.bloodGroup} donors`,
    tone: input.urgency === "critical" ? "critical" : "warning",
  });
  return { sent: rows.length, alertIds: rows.map((r) => r.id) };
}

/** Critical broadcast from a hospital request: rate-limited, alerts all banks and nearby donors. */
export async function criticalBroadcast(deps: Deps, requestId: string, actor: string): Promise<DonorDriveResultDTO> {
  const [request] = await deps.db.select().from(schema.requests).where(eq(schema.requests.id, requestId));
  if (!request) throw notFound("Request");
  if (request.urgency !== "critical") throw badRequest("Only critical requests can alert everyone");
  if (request.criticalBroadcastAt) throw conflict("This request has already alerted everyone");
  await enforceRateLimit(deps, `critical:${request.hospitalId}`, POLICY.criticalAlertsPerHour);

  const hospital = await getSite(deps, request.hospitalId);
  const banks = await deps.db.select().from(schema.sites).where(eq(schema.sites.kind, "blood_bank"));
  const nearest = banks
    .map((b) => ({ b, d: Math.hypot(b.lat - hospital.lat, b.lng - hospital.lng) }))
    .sort((x, y) => x.d - y.d)[0].b;

  await deps.db.update(schema.requests).set({ criticalBroadcastAt: deps.now }).where(eq(schema.requests.id, requestId));
  await deps.hub.publish({
    topics: ["requests"],
    siteIds: banks.map((b) => b.id),
    headline: `CRITICAL · ${hospital.shortName} needs ${request.unitsNeeded} × ${request.bloodGroup} ${COMPONENT_LABEL[request.component].toLowerCase()} — all banks alerted`,
    tone: "critical",
  });
  try {
    return await sendDrive(
      deps,
      { bankSiteId: nearest.id, bloodGroup: request.bloodGroup, component: "whole_blood", urgency: "critical", donorsNeeded: request.unitsNeeded, requestId },
      actor,
    );
  } catch (err) {
    if (err instanceof AppError && err.code === "conflict") return { sent: 0, alertIds: [] };
    throw err;
  }
}

async function enforceRateLimit(deps: Deps, key: string, limit: number) {
  const windowStart = Math.floor(deps.now / 3_600_000) * 3_600_000;
  const [row] = await deps.db
    .insert(schema.rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [schema.rateLimits.key, schema.rateLimits.windowStart], set: { count: sql`${schema.rateLimits.count} + 1` } })
    .returning({ count: schema.rateLimits.count });
  if (row.count > limit) {
    throw new AppError(429, "rate_limited", `Critical alerts are limited to ${limit} per hour per hospital`);
  }
}

/* ─────────────────────────────── Alerts ─────────────────────────────── */

function arrivalWindow(now: number): string {
  // Suggest a 90-minute window starting ~30 minutes from now (IST).
  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  return `${fmt(now + 30 * 60_000)} – ${fmt(now + 120 * 60_000)}`;
}

async function toAlertDTOs(deps: Deps, rows: AlertRow[]): Promise<DonorAlertDTO[]> {
  const banks = await deps.db.select().from(schema.sites).where(eq(schema.sites.kind, "blood_bank"));
  return rows.map((a) => {
    const bank = banks.find((b) => b.id === a.bankSiteId);
    const revealed = a.status === "accepted" || a.status === "arrived";
    return {
      id: a.id,
      donorId: a.donorId,
      bankSiteId: a.bankSiteId,
      bankName: bank?.name ?? a.bankSiteId,
      bloodGroup: a.bloodGroup,
      component: a.component,
      urgency: a.urgency,
      status: a.status,
      distanceKm: a.distanceKm,
      message: a.message,
      messageLocalized: a.messageLocalized,
      language: a.language,
      bankAddress: revealed ? (bank?.address ?? null) : null,
      arrivalWindow: revealed ? a.arrivalWindow : null,
      confirmationCode: revealed ? a.confirmationCode : null,
      createdAt: a.createdAt,
      respondedAt: a.respondedAt,
    };
  });
}

export async function donorAlerts(deps: Deps, donorId: string): Promise<DonorAlertDTO[]> {
  const rows = await deps.db
    .select()
    .from(schema.donorAlerts)
    .where(and(eq(schema.donorAlerts.donorId, donorId), gt(schema.donorAlerts.createdAt, deps.now - WEEK)))
    .orderBy(desc(schema.donorAlerts.createdAt))
    .limit(20);
  return toAlertDTOs(deps, rows);
}

export async function respond(deps: Deps, alertId: string, response: "accept" | "decline"): Promise<DonorAlertDTO> {
  const [alert] = await deps.db.select().from(schema.donorAlerts).where(eq(schema.donorAlerts.id, alertId));
  if (!alert) throw notFound("Alert");
  if (alert.status === "fulfilled") throw new AppError(409, "already_fulfilled", "This need has already been met — thank you!");
  if (alert.status !== "sent") throw conflict(`You already responded to this alert`);

  const accepted = response === "accept";
  const [updated] = await deps.db
    .update(schema.donorAlerts)
    .set(
      accepted
        ? { status: "accepted", respondedAt: deps.now, confirmationCode: confirmationCode(), arrivalWindow: arrivalWindow(deps.now) }
        : { status: "declined", respondedAt: deps.now },
    )
    .where(and(eq(schema.donorAlerts.id, alertId), eq(schema.donorAlerts.status, "sent")))
    .returning();
  if (!updated) throw conflict("Alert changed — refresh");

  if (accepted) {
    // Once enough donors have said yes, close the rest of the drive with a thank-you.
    const [{ n }] = await deps.db
      .select({ n: sql<number>`count(*)` })
      .from(schema.donorAlerts)
      .where(and(eq(schema.donorAlerts.driveId, alert.driveId), inArray(schema.donorAlerts.status, ["accepted", "arrived"])));
    if (Number(n) >= alert.driveNeeded) {
      await deps.db
        .update(schema.donorAlerts)
        .set({ status: "fulfilled" })
        .where(and(eq(schema.donorAlerts.driveId, alert.driveId), eq(schema.donorAlerts.status, "sent")));
    }
  }

  const bank = await getSite(deps, alert.bankSiteId);
  await deps.hub.audit([
    {
      actor: `donor:${alert.donorId}`,
      action: accepted ? "alert.accepted" : "alert.declined",
      entityType: "alert",
      entityId: alertId,
      siteId: alert.bankSiteId,
      summary: accepted ? `A ${alert.bloodGroup} donor is coming to ${bank.shortName}` : `A donor replied "not now" to ${bank.shortName}`,
    },
  ]);
  await deps.hub.publish({
    topics: ["alerts", "donors"],
    siteIds: [alert.bankSiteId],
    donorIds: [alert.donorId],
    headline: accepted ? `Incoming donor: ${alert.bloodGroup} heading to ${bank.shortName}` : undefined,
    tone: accepted ? "success" : undefined,
  });
  const [dto] = await toAlertDTOs(deps, [updated]);
  return dto;
}

/** The bank's view of donors who said yes. Contact details exist here only because the donor chose to respond. */
export async function incomingDonors(deps: Deps, bankSiteId: string): Promise<IncomingDonorDTO[]> {
  const rows = await deps.db
    .select({ alert: schema.donorAlerts, donorName: schema.donors.name, donorPhone: schema.donors.phone })
    .from(schema.donorAlerts)
    .innerJoin(schema.donors, eq(schema.donors.id, schema.donorAlerts.donorId))
    .where(
      and(
        eq(schema.donorAlerts.bankSiteId, bankSiteId),
        inArray(schema.donorAlerts.status, ["accepted", "arrived"]),
        gt(schema.donorAlerts.createdAt, deps.now - DAY),
      ),
    )
    .orderBy(desc(schema.donorAlerts.respondedAt));
  return rows.map(({ alert, donorName, donorPhone }) => ({
    alertId: alert.id,
    donorName,
    donorPhone,
    bloodGroup: alert.bloodGroup,
    confirmationCode: alert.confirmationCode ?? "",
    arrivalWindow: alert.arrivalWindow ?? "",
    status: alert.status as "accepted" | "arrived",
    respondedAt: alert.respondedAt ?? alert.createdAt,
  }));
}

/** Bank marks the donation complete: donation recorded, donor's eligibility clock restarts. */
export async function completeDonation(deps: Deps, alertId: string, actor: string): Promise<void> {
  const [alert] = await deps.db.select().from(schema.donorAlerts).where(eq(schema.donorAlerts.id, alertId));
  if (!alert) throw notFound("Alert");
  if (alert.status !== "accepted") throw conflict("Donor has not confirmed they are coming");
  await deps.db.update(schema.donorAlerts).set({ status: "arrived" }).where(eq(schema.donorAlerts.id, alertId));
  await deps.db.update(schema.donors).set({ lastDonationAt: deps.now }).where(eq(schema.donors.id, alert.donorId));
  await deps.db.insert(schema.donations).values({ id: newId("DON"), donorId: alert.donorId, siteId: alert.bankSiteId, alertId, at: deps.now });

  const bank = await getSite(deps, alert.bankSiteId);
  await deps.hub.audit([
    { actor, action: "donation.completed", entityType: "alert", entityId: alertId, siteId: bank.id, summary: `${bank.shortName} recorded a ${alert.bloodGroup} donation` },
  ]);
  await deps.hub.publish({ topics: ["alerts", "donors", "stock"], siteIds: [bank.id], donorIds: [alert.donorId], headline: `${bank.shortName}: donation complete — thank you`, tone: "success" });
}

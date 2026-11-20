/**
 * The WhatsApp / SMS bot. One inbound message → one "turn": classify, act, queue replies.
 *
 *   STOP / START ─ always first (and STOP always works, from anyone)
 *   JOIN         ─ group → area → language → explicit YES  (creates an opted-in donor)
 *   YES / NO     ─ answer the donor's latest open alert (same code path as the app)
 *   need …       ─ parser (+ Workers AI for gaps) → ranked search → top 3 banks
 *   HELP / other ─ short menu (en / hi / mr)
 *
 * Replies are queued in the outbox like every other message, so rate limits, the
 * reply window, STOP suppression and the audit trail apply uniformly.
 * Never clinical advice: only stock, distance, freshness and who to call.
 */
import { and, desc, eq, gt } from "drizzle-orm";
import type { GatewayInboundDTO, GatewayInboundInput } from "../../shared/api";
import { COMPONENT_LABEL, type Component, type Language, type MessageChannel, type Urgency } from "../../shared/domain";
import type { RankedOption } from "../../shared/ranking";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { AppError, badRequest } from "../lib/http";
import { freshnessLabel, say, type CopyKey } from "../messaging/copy";
import { extractNeed, type ModelCall } from "../messaging/extract";
import {
  detectLanguage,
  hasDevanagari,
  keyword,
  matchPlace,
  parseBloodGroup,
  parseLanguageChoice,
  parseNeed,
  type Keyword,
  type NeedDraft,
  type Place,
} from "../messaging/parse";
import { isWhatsAppGroup, lastFour, maskAddress, normalizeAddress } from "../messaging/phone";
import { MESSAGING_POLICY as P } from "../messaging/policy";
import { AREAS, areaById } from "../seed";
import { respond, setOptOut, signup } from "./donors";
import { bumpHourly, canAlert, channelLabel, enqueue } from "./messaging";
import { searchNear } from "./requests";

type ConversationRow = typeof schema.conversations.$inferSelect;
type DonorRow = typeof schema.donors.$inferSelect;

const DAY = 86_400_000;
const NEEDED_WITHIN_MS: Record<Urgency, number> = { critical: 2 * 3_600_000, urgent: 6 * 3_600_000, routine: 48 * 3_600_000 };

interface StoredNeed {
  bloodGroup: NeedDraft["bloodGroup"];
  component: NeedDraft["component"];
  units: number | null;
  urgency: Urgency | null;
  placeId: string | null;
}

interface Reply {
  body: string;
  kind: "reply" | "notice";
  bypassSuppression?: boolean;
}

export interface InboundOptions {
  /** Public origin of the app, for links like /hospital. */
  publicUrl: string;
}

/* ───────────────────────────── Entry point ───────────────────────────── */

export async function handleInbound(deps: Deps, input: GatewayInboundInput, opts: InboundOptions): Promise<GatewayInboundDTO> {
  const address = normalizeAddress(input.channel, input.from);
  if (!address) throw badRequest("Unrecognised sender address");

  // Idempotency: the gateway may retry a forward; each provider message is handled once.
  const fresh = await deps.db
    .insert(schema.inboundMessages)
    .values({ channel: input.channel, messageId: input.messageId, intent: "received", receivedAt: deps.now })
    .onConflictDoNothing()
    .returning({ messageId: schema.inboundMessages.messageId });
  if (fresh.length === 0) return { ok: true, duplicate: true, intent: "duplicate", queued: 0 };

  const turn = await Turn.open(deps, input.channel, address, input.text, opts);
  const inboundCount = await bumpHourly(deps, `in:${address}`);
  let intent: string;
  if (inboundCount > P.inboundPerSenderPerHour) {
    intent = "rate_limited";
    // Say so once, then stay silent for the rest of the hour.
    if (inboundCount === P.inboundPerSenderPerHour + 1 && !turn.group) turn.say("rateLimited");
  } else {
    intent = await turn.route();
  }
  const queued = await turn.finish(intent);

  await deps.db
    .update(schema.inboundMessages)
    .set({ intent })
    .where(and(eq(schema.inboundMessages.channel, input.channel), eq(schema.inboundMessages.messageId, input.messageId)));
  return { ok: true, duplicate: false, intent, queued };
}

/* ───────────────────────────── A single turn ───────────────────────────── */

class Turn {
  private replies: Reply[] = [];
  private audits: { action: string; summary: string; entityType?: string; entityId?: string; siteId?: string | null; payload?: unknown }[] = [];
  readonly group: boolean;
  private language: Language;

  private constructor(
    private readonly deps: Deps,
    private readonly channel: MessageChannel,
    private readonly address: string,
    private readonly text: string,
    private conv: ConversationRow,
    private readonly donor: DonorRow | null,
    private readonly opts: InboundOptions,
  ) {
    this.group = isWhatsAppGroup(address);
    this.language = donor?.language ?? (hasDevanagari(text) ? detectLanguage(text) : conv.language);
  }

  static async open(deps: Deps, channel: MessageChannel, address: string, text: string, opts: InboundOptions): Promise<Turn> {
    const c = schema.conversations;
    const [existing] = await deps.db.select().from(c).where(and(eq(c.channel, channel), eq(c.address, address)));
    const base: ConversationRow = existing ?? {
      channel,
      address,
      step: "idle",
      context: {},
      language: "en",
      suppressedAt: null,
      lastInboundAt: null,
      updatedAt: deps.now,
    };
    // A half-finished JOIN or question goes stale after a while of silence.
    const stale = base.step !== "idle" && deps.now - base.updatedAt > P.conversationTtlMs;
    const conv: ConversationRow = { ...base, ...(stale ? { step: "idle", context: {} } : {}), lastInboundAt: deps.now };
    // Record the inbound first: replies are only allowed inside the reply window it opens.
    await deps.db
      .insert(c)
      .values({ ...conv, updatedAt: deps.now })
      .onConflictDoUpdate({ target: [c.channel, c.address], set: { lastInboundAt: deps.now } });
    const donor = isWhatsAppGroup(address) ? null : await findDonor(deps, address);
    return new Turn(deps, channel, address, text.trim(), conv, donor, opts);
  }

  say(key: CopyKey, vars?: Record<string, string | number>) {
    this.replies.push({ body: say(key, this.language, vars), kind: "reply" });
  }

  private sayRaw(body: string) {
    this.replies.push({ body, kind: "reply" });
  }

  private audit(action: string, summary: string, extra: Partial<(typeof this.audits)[number]> = {}) {
    this.audits.push({ action, summary, ...extra });
  }

  private setStep(step: string, context: Record<string, unknown> = {}) {
    this.conv = { ...this.conv, step, context };
  }

  private get who() {
    return `${channelLabel(this.channel)} ${maskAddress(this.address)}`;
  }

  /* ── Routing ── */

  async route(): Promise<string> {
    if (!this.text) return "empty";
    const kw = keyword(this.text);

    if (kw === "stop") return this.stop();
    if (this.conv.suppressedAt) return kw === "start" ? this.start() : "ignored_suppressed";
    if (kw === "start") return this.start();

    // In group chats we only ever answer blood requests, and never start a multi-step chat.
    if (this.group) return this.groupNeed();

    if (this.conv.step.startsWith("join_")) {
      const handled = await this.joinStep(kw);
      if (handled) return handled;
    }
    if (this.conv.step.startsWith("need_")) {
      const handled = await this.needStep(kw);
      if (handled) return handled;
    }
    if (kw === "help") return this.help();
    if (kw === "join") return this.joinStart();
    if (kw === "yes" || kw === "no") return this.alertReply(kw);
    return this.need();
  }

  /* ── STOP / START ── */

  private async stop(): Promise<string> {
    const donors = await findDonors(this.deps, this.address);
    for (const d of donors) {
      await this.deps.db.update(schema.donors).set({ contactOptInAt: null }).where(eq(schema.donors.id, d.id));
      if (d.optedOutAt === null) await setOptOut(this.deps, d.id, true);
    }
    // Cancel anything still waiting to go to this address.
    await this.deps.db
      .update(schema.outbox)
      .set({ status: "failed", lastError: "opted_out", updatedAt: this.deps.now })
      .where(and(eq(schema.outbox.to, this.address), eq(schema.outbox.status, "pending")));
    this.conv = { ...this.conv, suppressedAt: this.deps.now, step: "idle", context: {} };
    this.replies.push({ body: say("stopped", this.language), kind: "notice", bypassSuppression: true });
    this.audit("messaging.stop", `STOP from ${this.who}: messaging disabled${donors.length ? ` and ${donors.length} donor profile${donors.length === 1 ? "" : "s"} opted out` : ""}`, {
      entityType: "address",
      entityId: maskAddress(this.address),
      payload: { donorIds: donors.map((d) => d.id) },
    });
    return "stop";
  }

  private start(): string {
    this.conv = { ...this.conv, suppressedAt: null };
    this.audit("messaging.start", `START from ${this.who}: messages allowed again`, { entityType: "address", entityId: maskAddress(this.address) });
    if (this.donor) return this.askConsentAgain(this.donor);
    this.say("startNoDonor");
    return "start";
  }

  /* ── HELP ── */

  private help(): string {
    this.setStep("idle");
    this.say("help");
    return "help";
  }

  /* ── JOIN: group → area → language → explicit YES ── */

  private joinStart(): string {
    if (this.donor) {
      if (canAlert(this.donor)) {
        this.say("alreadyRegistered", { group: this.donor.bloodGroup });
        return "join_already";
      }
      return this.askConsentAgain(this.donor);
    }
    this.setStep("join_group");
    this.say("joinGroup");
    return "join_start";
  }

  private askConsentAgain(donor: DonorRow): string {
    const area = areaById(donor.areaId)?.name ?? donor.areaId;
    this.setStep("join_consent", { existingDonorId: donor.id, group: donor.bloodGroup, areaId: donor.areaId });
    this.say("joinConsent", { area, group: donor.bloodGroup });
    return "join_consent_again";
  }

  private async joinStep(kw: Keyword | null): Promise<string | null> {
    const ctx = this.conv.context as { group?: string; areaId?: string; language?: Language; existingDonorId?: string };
    switch (this.conv.step) {
      case "join_group": {
        const group = parseBloodGroup(this.text);
        if (group) {
          this.setStep("join_area", { group });
          this.say("joinArea", { group });
          return "join_group";
        }
        if (kw === "help" || kw === "join") return null;
        this.say("joinGroupRetry");
        return "join_retry";
      }
      case "join_area": {
        const area = matchPlace(this.text, AREA_PLACES, ["area"]);
        if (area) {
          this.setStep("join_language", { ...ctx, areaId: area.id });
          this.say("joinLanguage", { area: area.name });
          return "join_area";
        }
        if (kw === "help" || kw === "join") return null;
        this.say("joinAreaRetry", { examples: "Sion, Dadar, Andheri, Ghatkopar" });
        return "join_retry";
      }
      case "join_language": {
        const language = parseLanguageChoice(this.text);
        if (language) {
          this.language = language;
          this.conv = { ...this.conv, language };
          const area = areaById(ctx.areaId ?? "")?.name ?? "your area";
          this.setStep("join_consent", { ...ctx, language });
          this.say("joinConsent", { area, group: ctx.group ?? "" });
          return "join_language";
        }
        if (kw === "help" || kw === "join") return null;
        this.say("joinLanguage", { area: areaById(ctx.areaId ?? "")?.name ?? "" });
        return "join_retry";
      }
      case "join_consent": {
        if (kw === "yes") return this.completeJoin(ctx);
        if (kw === "no") {
          this.setStep("idle");
          this.say("joinCancelled");
          return "join_cancelled";
        }
        if (kw === "help" || kw === "join") return null;
        this.say("joinConsentRetry");
        return "join_retry";
      }
      default:
        this.setStep("idle");
        return null;
    }
  }

  /** Only an explicit YES here counts as opt-in: messaging us first is not consent. */
  private async completeJoin(ctx: { group?: string; areaId?: string; language?: Language; existingDonorId?: string }): Promise<string> {
    const { deps } = this;
    this.setStep("idle");
    if (ctx.existingDonorId) {
      await deps.db
        .update(schema.donors)
        .set({
          consentAlerts: true,
          consentLocation: true,
          optedOutAt: null,
          contactChannel: this.channel,
          contactAddress: this.address,
          contactOptInAt: deps.now,
        })
        .where(eq(schema.donors.id, ctx.existingDonorId));
      this.audit("messaging.opted_in", `Donor re-opted in to ${this.who} alerts (explicit YES)`, {
        entityType: "donor",
        entityId: ctx.existingDonorId,
        payload: { channel: this.channel, source: "chat" },
      });
      await deps.hub.publish({ topics: ["donors"], donorIds: [ctx.existingDonorId] });
      this.say("resubscribed");
      return "join_resubscribed";
    }
    const group = parseBloodGroup(ctx.group ?? "");
    const area = areaById(ctx.areaId ?? "");
    if (!group || !area) {
      this.setStep("join_group");
      this.say("joinGroup");
      return "join_restart";
    }
    const donor = await signup(
      deps,
      {
        name: `${channelLabel(this.channel)} donor ··${lastFour(this.address)}`,
        phone: this.address,
        bloodGroup: group,
        areaId: area.id,
        language: ctx.language ?? this.language,
        consentAlerts: true,
        consentLocation: true,
        consentEligibility: false,
        lastDonationAt: null,
        contactChannel: this.channel,
        contactPhone: this.address,
        contactConsent: true,
      },
      { welcome: false },
    );
    this.audit("messaging.opted_in", `New ${group} donor joined via ${this.who} (explicit YES)`, {
      entityType: "donor",
      entityId: donor.id,
      payload: { channel: this.channel, source: "chat" },
    });
    this.say("joined", { group, area: area.name });
    return "join_completed";
  }

  /* ── YES / NO to an alert ── */

  private async alertReply(kw: "yes" | "no"): Promise<string> {
    const { deps } = this;
    if (!this.donor) {
      this.say("nothingPending");
      return "reply_no_donor";
    }
    const [alert] = await deps.db
      .select()
      .from(schema.donorAlerts)
      .where(and(eq(schema.donorAlerts.donorId, this.donor.id), eq(schema.donorAlerts.status, "sent"), gt(schema.donorAlerts.createdAt, deps.now - DAY)))
      .orderBy(desc(schema.donorAlerts.createdAt))
      .limit(1);
    if (!alert) {
      this.say("nothingPending");
      return "reply_nothing_pending";
    }
    try {
      const dto = await respond(deps, alert.id, kw === "yes" ? "accept" : "decline");
      if (kw === "no") {
        this.say("declined");
        return "alert_declined";
      }
      const [bank] = await deps.db.select({ phone: schema.sites.phone }).from(schema.sites).where(eq(schema.sites.id, alert.bankSiteId));
      this.say("accepted", {
        bank: dto.bankName,
        address: dto.bankAddress ?? "",
        window: dto.arrivalWindow ?? "",
        code: dto.confirmationCode ?? "",
        phone: bank?.phone ?? "",
      });
      return "alert_accepted";
    } catch (err) {
      if (err instanceof AppError && (err.code === "already_fulfilled" || err.code === "conflict")) {
        this.say(err.code === "already_fulfilled" ? "fulfilled" : "nothingPending");
        return err.code === "already_fulfilled" ? "alert_fulfilled" : "reply_nothing_pending";
      }
      throw err;
    }
  }

  /* ── Blood requests ── */

  private async need(): Promise<string> {
    const places = await loadPlaces(this.deps);
    const extracted = await extractNeed(modelCall(this.deps), this.text, places);
    if (!extracted.isNeed) {
      this.say("help");
      return "unknown";
    }
    return this.continueNeed(extracted.draft, extracted.source);
  }

  private async needStep(kw: Keyword | null): Promise<string | null> {
    if (kw === "help" || kw === "join" || kw === "yes" || kw === "no") return null;
    const places = await loadPlaces(this.deps);
    const stored = this.conv.context as unknown as StoredNeed;
    const prior: NeedDraft = {
      bloodGroup: stored.bloodGroup ?? null,
      component: stored.component ?? null,
      units: stored.units ?? null,
      urgency: stored.urgency ?? null,
      place: places.find((p) => p.id === stored.placeId) ?? null,
    };
    const next = parseNeed(this.text, places);
    const asked = this.conv.step === "need_group" ? next.bloodGroup : next.place;
    if (!asked) {
      this.say(this.conv.step === "need_group" ? "needGroup" : "needPlace");
      return "need_retry";
    }
    const merged: NeedDraft = {
      bloodGroup: next.bloodGroup ?? prior.bloodGroup,
      component: next.component ?? prior.component,
      units: next.units ?? prior.units,
      urgency: next.urgency ?? prior.urgency,
      place: next.place ?? prior.place,
    };
    return this.continueNeed(merged, "parser");
  }

  private async continueNeed(draft: NeedDraft, source: string): Promise<string> {
    const store = (): Record<string, unknown> => ({
      bloodGroup: draft.bloodGroup,
      component: draft.component,
      units: draft.units,
      urgency: draft.urgency,
      placeId: draft.place?.id ?? null,
    });
    if (!draft.bloodGroup) {
      this.setStep("need_group", store());
      this.say("needGroup");
      return "need_ask_group";
    }
    if (!draft.place) {
      this.setStep("need_place", store());
      this.say("needPlace");
      return "need_ask_place";
    }
    this.setStep("idle");
    const listed = await this.answerNeed(draft as NeedDraft & { bloodGroup: NonNullable<NeedDraft["bloodGroup"]>; place: Place }, source);
    return listed > 0 ? "need_answered" : "need_no_stock";
  }

  private async groupNeed(): Promise<string> {
    const places = await loadPlaces(this.deps);
    const extracted = await extractNeed(modelCall(this.deps), this.text, places);
    if (!extracted.isNeed) return "ignored_group";
    const { draft } = extracted;
    if (!draft.bloodGroup || !draft.place) {
      this.say("groupNeedFormat");
      return "group_need_incomplete";
    }
    const listed = await this.answerNeed(draft as NeedDraft & { bloodGroup: NonNullable<NeedDraft["bloodGroup"]>; place: Place }, extracted.source);
    return listed > 0 ? "need_answered" : "need_no_stock";
  }

  /** Ranked search from the hospital or locality named, top 3 banks. Information only: reserving needs a hospital. */
  private async answerNeed(draft: NeedDraft & { bloodGroup: NonNullable<NeedDraft["bloodGroup"]>; place: Place }, source: string): Promise<number> {
    const { deps } = this;
    const component: Component = draft.component ?? "red_cells";
    const units = draft.units ?? 1;
    const urgency: Urgency = draft.urgency ?? "urgent";
    const options = await searchNear(deps, { lat: draft.place.lat, lng: draft.place.lng }, {
      bloodGroup: draft.bloodGroup,
      component,
      unitsNeeded: units,
      urgency,
      neededBy: deps.now + NEEDED_WITHIN_MS[urgency],
    });
    const top = options.slice(0, 3);
    const phones = new Map(
      (await deps.db.select({ id: schema.sites.id, phone: schema.sites.phone }).from(schema.sites).where(eq(schema.sites.kind, "blood_bank"))).map((s) => [s.id, s.phone]),
    );
    this.sayRaw(formatNeedReply({ draft, component, units, top, phones, publicUrl: this.opts.publicUrl, assumedComponent: !draft.component }));
    this.audit(
      "messaging.need_lookup",
      `${this.who} asked for ${draft.bloodGroup} ${COMPONENT_LABEL[component].toLowerCase()} near ${draft.place.name}: ${top.length ? `${top.length} bank${top.length === 1 ? "" : "s"} listed` : "no compatible stock listed"}`,
      { entityType: "need", entityId: `${draft.bloodGroup}:${component}:${draft.place.id}`, payload: { units, urgency, source, siteIds: top.map((o) => o.siteId) } },
    );
    return top.length;
  }

  /* ── Finish: persist state, queue replies, audit ── */

  async finish(intent: string): Promise<number> {
    const { deps } = this;
    const c = schema.conversations;
    await deps.db
      .update(c)
      .set({
        step: this.conv.step,
        context: this.conv.context,
        language: this.language,
        suppressedAt: this.conv.suppressedAt,
        updatedAt: deps.now,
      })
      .where(and(eq(c.channel, this.channel), eq(c.address, this.address)));

    let queued = 0;
    for (const r of this.replies) {
      const result = await enqueue(deps, {
        channel: this.channel,
        to: this.address,
        body: r.body,
        kind: r.kind,
        donorId: this.donor?.id,
        bypassSuppression: r.bypassSuppression,
      });
      if (result.queued) queued++;
    }

    await deps.hub.audit([
      {
        actor: this.donor ? `donor:${this.donor.id}` : `chat:${maskAddress(this.address)}`,
        action: "messaging.inbound",
        entityType: "message",
        entityId: `${this.channel}:${maskAddress(this.address)}`,
        summary: `${this.who} → ${intent.replace(/_/g, " ")}${queued ? ` · ${queued} repl${queued === 1 ? "y" : "ies"} queued` : ""}`,
        payload: { intent, queued, chars: this.text.length },
      },
      ...this.audits.map((a) => ({
        ...a,
        actor: this.donor ? `donor:${this.donor.id}` : `chat:${maskAddress(this.address)}`,
        entityType: a.entityType ?? "message",
        entityId: a.entityId ?? maskAddress(this.address),
      })),
    ]);
    await deps.hub.publish({ topics: ["messaging"], donorIds: this.donor ? [this.donor.id] : undefined });
    return queued;
  }
}

/* ───────────────────────────── Formatting ───────────────────────────── */

export function formatNeedReply(args: {
  draft: NeedDraft & { bloodGroup: NonNullable<NeedDraft["bloodGroup"]>; place: Place };
  component: Component;
  units: number;
  top: RankedOption[];
  phones: Map<string, string>;
  publicUrl: string;
  assumedComponent: boolean;
}): string {
  const { draft, component, units, top, phones, publicUrl } = args;
  const what = `${draft.bloodGroup} ${COMPONENT_LABEL[component].toLowerCase()}`;
  const lines = [`*Blood Bridge* · ${what}, ${units} unit${units === 1 ? "" : "s"} near ${draft.place.name}`];
  if (args.assumedComponent) lines.push(`(Assumed red cells. Say "platelets", "plasma" or "whole blood" if different.)`);
  if (top.length === 0) {
    lines.push(
      `No compatible in-date ${COMPONENT_LABEL[component].toLowerCase()} for ${draft.bloodGroup} is listed right now.`,
      `The hospital can raise a critical alert on Blood Bridge to reach eligible donors: ${publicUrl}/hospital`,
    );
  } else {
    top.forEach((o, i) => {
      const phone = phones.get(o.siteId);
      const compat = o.matchType === "exact" ? "" : " (compatible group, doctor must confirm)";
      const fresh = `${freshnessLabel(o.freshnessMinutes)}${o.stale ? ", call to confirm" : ""}`;
      lines.push(
        `${i + 1}. *${o.name}*`,
        `   ${o.unitsAvailable} unit${o.unitsAvailable === 1 ? "" : "s"}${compat} · ~${o.etaMinutes} min · ${fresh}`,
        ...(phone && /\d{5,}/.test(phone.replace(/\D/g, "")) ? [`   Call ${phone}`] : []),
      );
    });
    lines.push(`Only a hospital can reserve units. Ward staff can book in one tap: ${publicUrl}/hospital`);
  }
  lines.push("Stock information only, not medical advice. The treating doctor decides what is transfused.");
  return lines.join("\n");
}

/* ───────────────────────────── Lookups ───────────────────────────── */

const AREA_PLACES: Place[] = AREAS.map((a) => ({ id: a.id, name: a.name, kind: "area", lat: a.lat, lng: a.lng }));

/** Gazetteer: real localities plus real hospitals ("Nair Hospital", "Sion hospital"). */
async function loadPlaces(deps: Deps): Promise<Place[]> {
  const hospitals = await deps.db.select().from(schema.sites).where(eq(schema.sites.kind, "hospital"));
  return [
    ...AREA_PLACES,
    ...hospitals.map((h): Place => {
      const areaName = areaById(h.areaId)?.name;
      return {
        id: h.id,
        name: h.name,
        kind: "hospital",
        lat: h.lat,
        lng: h.lng,
        aliases: [h.shortName, ...(areaName ? [`${areaName} hospital`] : [])],
      };
    }),
  ];
}

async function findDonors(deps: Deps, address: string): Promise<DonorRow[]> {
  return deps.db.select().from(schema.donors).where(eq(schema.donors.contactAddress, address)).orderBy(desc(schema.donors.createdAt));
}

async function findDonor(deps: Deps, address: string): Promise<DonorRow | null> {
  return (await findDonors(deps, address))[0] ?? null;
}

/** Workers AI, when the binding is present. Absent (e.g. local dev without remote AI) → parser only. */
function modelCall(deps: Deps): ModelCall | undefined {
  const ai = deps.env.AI as Ai | undefined;
  if (!ai) return undefined;
  return async (system, user) => {
    const out = (await ai.run("@cf/meta/llama-3.1-8b-instruct-fast", {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 160,
      temperature: 0,
    })) as { response?: unknown };
    return out.response;
  };
}

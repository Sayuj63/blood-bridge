/**
 * Human-in-the-loop write tools. Each takes `confirm`: without it the tool returns a
 * dry-run preview and changes nothing; with it (and a valid token) it calls the same
 * service functions the app uses, so the change shows up live on every dashboard and
 * lands in the ledger under the `ai:<client>` actor.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { COMPONENT_LABEL, COMPONENT_SHORT, SURGE_KINDS, URGENCIES } from "../../shared/domain";
import { SURGE_PRESETS } from "../../shared/forecast";
import { SURGE_DEFAULT_AREA, SURGE_ZONES } from "../seed";
import * as donors from "../services/donors";
import * as fc from "../services/forecast";
import * as req from "../services/requests";
import * as sites from "../services/sites";
import { CONFIRM_DESCRIPTION, NEEDED_WITHIN_MIN, dryRun, guarded, hours, istTime, ok, resolveArea, toolError, writeGate, type McpContext } from "./context";
import { bloodGroup, component, siteId } from "./tools-read";

const confirm = z.boolean().default(false).describe(CONFIRM_DESCRIPTION);

export function registerWriteTools(server: McpServer, ctx: McpContext) {
  const { deps, actor } = ctx;
  const authNote = ctx.authorized ? "" : "\n(Note: this connection has no operator token, so confirming will be refused until the connector is set up with one.)";

  server.registerTool(
    "create_and_reserve",
    {
      title: "Create a blood request and reserve units",
      description:
        "Create a blood request for a hospital and immediately hold compatible units at a blood bank (the bank then has 90 s to confirm, or the system reroutes to the next-best bank). HUMAN-IN-THE-LOOP: call without confirm first to preview which bank and units would be held; only call with confirm: true after the user approves. bankSiteId defaults to the top-ranked option from find_blood. Patients are synthetic; non-exact matches need clinician confirmation.",
      inputSchema: {
        hospitalId: siteId.describe("Requesting hospital id, e.g. \"hsp-sion-ltmgh\""),
        bloodGroup,
        component,
        units: z.number().int().min(1).max(20).describe("Units (bags) needed"),
        urgency: z.enum(URGENCIES).default("urgent").describe("critical (~1 h), urgent (~4 h) or routine (~24 h)"),
        ward: z.string().trim().min(1).max(60).default("Emergency").describe("Requesting ward, e.g. \"Emergency\" or \"ICU\""),
        bankSiteId: siteId.optional().describe("Blood bank to reserve at; omit to use the top-ranked option"),
        confirm,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      guarded(async () => {
        const input = {
          hospitalId: args.hospitalId,
          bloodGroup: args.bloodGroup,
          component: args.component,
          unitsNeeded: args.units,
          urgency: args.urgency,
          ward: args.ward,
          neededBy: deps.now + NEEDED_WITHIN_MIN[args.urgency] * 60_000,
        };
        const { options } = await req.search(deps, input);
        const chosen = args.bankSiteId ? options.find((o) => o.siteId === args.bankSiteId) : options[0];
        const label = `${args.units} × ${args.bloodGroup} ${COMPONENT_LABEL[args.component].toLowerCase()}`;
        if (!chosen) {
          return toolError(
            args.bankSiteId
              ? `${args.bankSiteId} has no compatible in-date ${label}. Call find_blood to see banks that do.`
              : `No bank has compatible in-date ${label}. Consider send_donor_drive or list_transfer_suggestions.`,
            { code: "no_stock" },
          );
        }
        const preview = {
          hospitalId: args.hospitalId,
          bankSiteId: chosen.siteId,
          bankName: chosen.name,
          unitsToHold: chosen.allocation.length,
          unitsRequested: args.units,
          matchType: chosen.matchType,
          needsClinicianConfirmation: chosen.needsClinicianConfirmation,
          etaMinutes: chosen.etaMinutes,
          stale: chosen.stale,
        };
        const summary = `Would create a ${args.urgency} request for ${label} (${args.ward}) at ${args.hospitalId} and hold ${preview.unitsToHold} units at ${chosen.name} [${chosen.siteId}], ETA ${chosen.etaMinutes} min, ${chosen.matchType}${chosen.needsClinicianConfirmation ? " — a clinician must confirm the non-exact match" : ""}${chosen.stale ? ". Bank data is stale; a phone check will be required" : ""}.`;
        if (!args.confirm) return dryRun(summary + authNote, { preview });

        const denied = await writeGate(ctx);
        if (denied) return denied;
        const created = await req.createRequest(deps, input, actor);
        try {
          const r = await req.reserve(deps, created.id, chosen.siteId, actor);
          const a = r.active;
          return ok(
            `Request ${r.id} created and ${a ? `${a.unitsCount} units held at ${a.bankName} (${a.status}); bank must confirm by ${istTime(a.confirmBy)} or it auto-reroutes. ETA ${a.etaMinutes} min.` : "reservation pending."} It is now live on /stage and /command. Track it with get_request.`,
            { requestId: r.id, status: r.status, active: a && { reservationId: a.id, bankSiteId: a.bankSiteId, bankName: a.bankName, status: a.status, unitsCount: a.unitsCount, etaMinutes: a.etaMinutes, confirmBy: a.confirmBy } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          return toolError(`Request ${created.id} was created but the hold at ${chosen.name} failed: ${message}. The request stays open, so don't create it again; check it with get_request, or reserve at another bank from the hospital view.`, {
            code: "reserve_failed",
            requestId: created.id,
          });
        }
      }),
  );

  server.registerTool(
    "reserve_split",
    {
      title: "Cover a request across several blood banks",
      description:
        "When no single bank holds enough units (rare groups are often spread 1-4 units per bank), hold every uncovered unit of an open request across as few banks as possible, in one action. Each leg is a normal reservation the bank must confirm within 90 s; a leg that conflicts falls through to the next-ranked bank. HUMAN-IN-THE-LOOP: call without confirm to preview the legs, then with confirm: true only after the user approves. Create the request first with create_and_reserve or from the hospital view.",
      inputSchema: {
        requestId: z.string().min(1).max(64).describe("Open request id, e.g. \"REQ-ABC123\""),
        confirm,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    ({ requestId, confirm }) =>
      guarded(async () => {
        const r = await req.getRequest(deps, requestId);
        if (r.status !== "open") return toolError(`Request ${r.id} is already ${r.status}.`, { code: "not_open" });
        const { remaining, plan } = await req.planRequestSplit(deps, requestId);
        const label = `${r.bloodGroup} ${COMPONENT_SHORT[r.component]}`;
        if (remaining === 0) return ok(`Request ${r.id} is already fully covered; nothing to split.`, { requestId: r.id, remaining });
        if (plan.legs.length === 0) {
          return toolError(`No bank has compatible in-date ${label} for the ${remaining} uncovered units. Consider send_donor_drive or list_transfer_suggestions.`, { code: "no_stock" });
        }
        const legsText = plan.legs.map((l) => `${l.units} at ${l.name} [${l.siteId}] (ETA ${l.etaMinutes} min, ${l.matchType}${l.stale ? ", stale: phone check needed" : ""})`).join("; ");
        const summary = `Would hold ${plan.covered} of ${remaining} uncovered × ${label} for ${r.id} across ${plan.legs.length} bank${plan.legs.length === 1 ? "" : "s"}: ${legsText}. Last bag ETA ~${plan.maxEtaMinutes} min.${plan.shortBy > 0 ? ` Still short by ${plan.shortBy}: raise a critical alert for the rest.` : ""}`;
        if (!confirm) return dryRun(summary + authNote, { preview: { requestId: r.id, remaining, plan } });

        const denied = await writeGate(ctx);
        if (denied) return denied;
        const result = await req.reserveSplit(deps, requestId, actor);
        const held = result.legs.filter((l) => l.outcome === "reserved");
        return ok(
          `Split reservation for ${r.id}: ${result.unitsHeld} of ${result.unitsNeeded} units now held across ${held.length} bank${held.length === 1 ? "" : "s"} (${held.map((l) => `${l.name} ${l.units}`).join(", ") || "none"}). Each bank must confirm within 90 s or it auto-reroutes.${result.shortBy > 0 ? ` Short by ${result.shortBy}: consider send_donor_drive.` : ""} Track it with get_request.`,
          { requestId: r.id, unitsNeeded: result.unitsNeeded, unitsHeld: result.unitsHeld, shortBy: result.shortBy, legs: result.legs },
        );
      }),
  );

  server.registerTool(
    "approve_transfer",
    {
      title: "Approve a bank-to-bank transfer",
      description:
        "Approve moving units of one blood group × component from one blood bank to another (usually a suggestion from list_transfer_suggestions). Units go in-transit immediately and the transfer arc appears on /command. HUMAN-IN-THE-LOOP: call without confirm to preview the effect, then with confirm: true only after the user approves. quantity defaults to the planner's suggestion.",
      inputSchema: {
        fromSiteId: siteId.describe("Source blood bank id"),
        toSiteId: siteId.describe("Destination site id"),
        bloodGroup,
        component,
        quantity: z.number().int().min(1).max(50).optional().describe("Units to move; omit to use the suggested quantity"),
        confirm,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      guarded(async () => {
        if (args.fromSiteId === args.toSiteId) return toolError("Source and destination must differ.", { code: "bad_request" });
        const [from, to] = await Promise.all([sites.getSite(deps, args.fromSiteId), sites.getSite(deps, args.toSiteId)]);
        const board = await fc.transferBoard(deps);
        const suggestion = board.suggestions.find(
          (s) => s.fromSiteId === args.fromSiteId && s.toSiteId === args.toSiteId && s.bloodGroup === args.bloodGroup && s.component === args.component,
        );
        const quantity = args.quantity ?? suggestion?.quantity;
        if (!quantity) {
          return toolError("That transfer isn't a current suggestion, so give an explicit quantity (or pick one from list_transfer_suggestions).", { code: "quantity_required" });
        }
        const label = `${quantity} × ${args.bloodGroup} ${COMPONENT_SHORT[args.component]}`;
        const preview = {
          fromSiteId: from.id,
          fromName: from.shortName,
          toSiteId: to.id,
          toName: to.shortName,
          bloodGroup: args.bloodGroup,
          component: args.component,
          quantity,
          suggested: Boolean(suggestion),
          etaMinutes: suggestion?.etaMinutes ?? null,
          rescuedFromExpiry: suggestion?.rescuedFromExpiry ?? 0,
          reason: suggestion?.reason ?? "Manual transfer (not a current planner suggestion)",
        };
        if (!args.confirm) {
          return dryRun(
            `Would move ${label} from ${from.shortName} → ${to.shortName}${preview.etaMinutes ? ` (ETA ${preview.etaMinutes} min)` : ""}. ${preview.reason}${preview.rescuedFromExpiry ? ` Rescues ${preview.rescuedFromExpiry} units from expiry.` : ""}${authNote}`,
            { preview },
          );
        }
        const denied = await writeGate(ctx);
        if (denied) return denied;
        const t = await fc.approveTransfer(deps, { fromSiteId: from.id, toSiteId: to.id, bloodGroup: args.bloodGroup, component: args.component, quantity }, actor);
        return ok(`Transfer ${t.id} approved: ${t.quantity} × ${t.bloodGroup} ${COMPONENT_SHORT[t.component]} ${t.fromName} → ${t.toName}, ETA ${t.etaMinutes} min. Units are in transit; watch the arc on /command.`, {
          transfer: { id: t.id, fromName: t.fromName, toName: t.toName, bloodGroup: t.bloodGroup, component: t.component, quantity: t.quantity, status: t.status, etaMinutes: t.etaMinutes, rescuedFromExpiry: t.rescuedFromExpiry },
        });
      }),
  );

  const zoneList = SURGE_ZONES.map((z) => `${z.name} (${z.id})`).join(", ");
  server.registerTool(
    "start_surge",
    {
      title: "Start a simulated surge (doomsday drill)",
      description: `Declare a SIMULATED emergency surge (flood or mass-casualty) centred on a Mumbai area. Demand near the epicentre is multiplied (modelled assumptions, O- weighted highest), the /command dashboard switches to surge mode with stock-out countdowns, and the forecast and transfer suggestions update. Replaces any active surge. This is a drill, not a real emergency. HUMAN-IN-THE-LOOP: preview first, confirm: true only after the user approves. Known flood spots: ${zoneList}. Any locality name also works.`,
      inputSchema: {
        kind: z.enum(SURGE_KINDS).default("flood").describe("flood or mass_casualty"),
        area: z.string().trim().min(2).max(60).optional().describe("Area name or id, e.g. \"Kurla\" or \"fz-kurla-mithi\"; default Kurla for flood, Dadar for mass_casualty"),
        confirm,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    ({ kind, area, confirm }) =>
      guarded(async () => {
        const resolved = resolveArea(area ?? SURGE_DEFAULT_AREA[kind]);
        if (!resolved) return toolError(`Unknown area "${area}". Try one of: ${zoneList}.`, { code: "unknown_area" });
        const preset = SURGE_PRESETS[kind];
        const active = await fc.activeSurgeRow(deps);
        const preview = { kind, label: preset.label, areaId: resolved.id, areaName: resolved.name, radiusKm: preset.radiusKm, multipliers: preset.multipliers, replaces: active ? { id: active.id, kind: active.kind, areaId: active.areaId } : null };
        if (!confirm) {
          const mult = Object.entries(preset.multipliers).map(([k, v]) => `${k.replace("*|", "all ").replace("|", " ")} ×${v}`).join(", ");
          return dryRun(
            `Would start a SIMULATED ${preset.label.toLowerCase()} centred on ${resolved.name} (${preset.radiusKm} km radius). Demand multipliers near the epicentre: ${mult}.${active ? " This replaces the surge already running." : ""} /command will switch to surge mode.${authNote}`,
            { preview },
          );
        }
        const denied = await writeGate(ctx);
        if (denied) return denied;
        const s = await fc.startSurge(deps, { kind, areaId: resolved.id }, actor);
        const f = await fc.forecast(deps);
        const first = f.outlook.find((g) => g.stockoutHours !== null);
        return ok(
          `SURGE MODE ON (simulated): ${s.label} in ${s.areaName}. ${first ? `First to run out: ${first.bloodGroup} ${COMPONENT_SHORT[first.component]} in ${hours(first.stockoutHours)}.` : ""} 24h shortfall now ${f.current.shortfall24h} units; with all suggested transfers ${f.withPlan.shortfall24h}. Next: list_transfer_suggestions.`,
          { surge: s, current: f.current, withPlan: f.withPlan, firstToRunOut: first ?? null },
        );
      }),
  );

  server.registerTool(
    "end_surge",
    {
      title: "End the simulated surge",
      description: "Stand down the active simulated surge and return the city to baseline demand. HUMAN-IN-THE-LOOP: preview first, confirm: true only after the user approves. Does nothing if no surge is active.",
      inputSchema: { confirm },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ confirm }) =>
      guarded(async () => {
        const active = await fc.activeSurgeRow(deps);
        if (!active) return ok("No surge is active; nothing to end.", { active: null });
        const preview = { id: active.id, kind: active.kind, areaId: active.areaId, startedAt: active.startedAt };
        if (!confirm) return dryRun(`Would stand down the ${active.kind.replace(/_/g, "-")} surge (${active.areaId}) running since ${istTime(active.startedAt)}.${authNote}`, { preview });
        const denied = await writeGate(ctx);
        if (denied) return denied;
        await fc.endSurge(deps, actor);
        return ok("Surge stood down. The city is back on baseline demand.", { ended: preview });
      }),
  );

  server.registerTool(
    "send_donor_drive",
    {
      title: "Alert donors for a blood bank",
      description:
        "Send donation alerts (in each donor's language: English, Hindi or Marathi) to eligible, consenting donors near a blood bank for one blood group. Alerts close automatically once donorsNeeded accept. Donors are synthetic, and their phones on /stage and /donor light up. HUMAN-IN-THE-LOOP: preview first (shows the eligibility funnel), confirm: true only after the user approves.",
      inputSchema: {
        bankSiteId: siteId.describe("Blood bank donors should go to"),
        bloodGroup,
        component: component.default("whole_blood"),
        urgency: z.enum(URGENCIES).default("urgent").describe("critical, urgent or routine — sets the message tone"),
        donorsNeeded: z.number().int().min(1).max(20).default(3).describe("Close the drive after this many donors accept"),
        confirm,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      guarded(async () => {
        const p = await donors.previewDrive(deps, args.bankSiteId, args.bloodGroup);
        if (p.eligibleCount === 0) {
          return toolError(`No eligible, consenting ${args.bloodGroup} donors in range of ${args.bankSiteId} right now.`, { code: "no_donors", funnel: p });
        }
        const skipped = Object.entries(p.skipped).filter(([, n]) => n > 0).map(([k, n]) => `${k.replace(/_/g, " ")} ${n}`).join(", ");
        if (!args.confirm) {
          return dryRun(
            `Would send ${args.urgency} alerts to ${p.eligibleCount} eligible ${args.bloodGroup} donors for ${COMPONENT_LABEL[args.component].toLowerCase()} at ${args.bankSiteId}, closing after ${args.donorsNeeded} accept. Skipped of ${p.totalDonors}: ${skipped || "none"}.${authNote}`,
            { preview: { ...p, bankSiteId: args.bankSiteId, urgency: args.urgency, donorsNeeded: args.donorsNeeded } },
          );
        }
        const denied = await writeGate(ctx);
        if (denied) return denied;
        const r = await donors.sendDrive(
          deps,
          { bankSiteId: args.bankSiteId, bloodGroup: args.bloodGroup, component: args.component, urgency: args.urgency, donorsNeeded: args.donorsNeeded },
          actor,
        );
        return ok(`Alerted ${r.sent} ${args.bloodGroup} donors. Their phones are lit up on /stage; responses arrive live.`, { sent: r.sent, alertIds: r.alertIds });
      }),
  );
}

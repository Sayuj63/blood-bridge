/** Read-only MCP tools. None of these change state; all are safe to call freely. */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, COMPONENT_SHORT, URGENCIES } from "../../shared/domain";
import { compatibleSources } from "../../shared/compatibility";
import { SNAPSHOT_FETCHED_AT } from "../seed";
import * as audit from "../services/audit";
import * as donors from "../services/donors";
import * as fc from "../services/forecast";
import * as req from "../services/requests";
import * as sites from "../services/sites";
import { COMPAT_DISCLAIMER, DATA_SOURCES_MARKDOWN } from "./content";
import { NEEDED_WITHIN_MIN, guarded, hours, istTime, ok, type McpContext } from "./context";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export const bloodGroup = z.enum(BLOOD_GROUPS).describe("ABO/Rh blood group, e.g. \"O-\" or \"AB+\"");
export const component = z
  .enum(COMPONENTS)
  .describe("Blood component: whole_blood, red_cells (packed RBC), platelets, or plasma (FFP)");
export const siteId = z.string().min(1).max(64).describe("Site id from list_sites, e.g. \"hsp-sion-ltmgh\" or \"bb-kem-parel\"");

export function registerReadTools(server: McpServer, ctx: McpContext) {
  const { deps } = ctx;

  server.registerTool(
    "list_sites",
    {
      title: "List blood banks and hospitals",
      description:
        "List Mumbai blood banks and requesting hospitals with ids, area, available units by blood group, and data freshness (minutes since the bank last updated stock; 'stale' = older than 3 h, ask for a phone check). Sites are real (data.gov.in / OpenStreetMap); stock started from a real e-RaktKosh snapshot and changes with simulated activity. Use this to get site ids for other tools.",
      inputSchema: {
        kind: z.enum(["blood_bank", "hospital", "all"]).default("all").describe("Filter by site type"),
        area: z.string().max(60).optional().describe("Optional case-insensitive area filter, e.g. \"Parel\""),
      },
      annotations: READ,
    },
    ({ kind, area }) =>
      guarded(async () => {
        let list = await sites.listSites(deps);
        if (kind !== "all") list = list.filter((s) => s.kind === kind);
        if (area) list = list.filter((s) => s.areaName.toLowerCase().includes(area.toLowerCase()));
        const rows = list.map((s) => ({
          id: s.id,
          kind: s.kind,
          name: s.name,
          shortName: s.shortName,
          area: s.areaName,
          phone: s.phone,
          totalAvailable: s.totalAvailable,
          availableByGroup: s.availableByGroup,
          freshnessMinutes: s.freshnessMinutes,
          stale: s.stale,
        }));
        const text = rows
          .map(
            (s) =>
              `- ${s.shortName} [${s.id}] ${s.kind === "hospital" ? "hospital" : `bank, ${s.totalAvailable} units`} · ${s.area} · updated ${s.freshnessMinutes} min ago${s.stale ? " (STALE)" : ""}`,
          )
          .join("\n");
        return ok(`${rows.length} sites (stock snapshot from e-RaktKosh ${new Date(SNAPSHOT_FETCHED_AT).toISOString().slice(0, 16)}Z, then simulated):\n${text}`, {
          sites: rows,
        });
      }),
  );

  server.registerTool(
    "find_blood",
    {
      title: "Find compatible blood for a hospital",
      description:
        "Search every blood bank for compatible, in-date units for a patient at a hospital, ranked by travel time, data freshness, shelf life and coverage. Returns ETA (minutes by road), match type (exact / compatible / mixed — non-exact needs clinician confirmation), and whether the bank can cover the full request. Read-only: it does not reserve anything; use create_and_reserve for that. Patients are synthetic; compatibility is simplified demo logic.",
      inputSchema: {
        hospitalId: siteId.describe("Requesting hospital id, e.g. \"hsp-sion-ltmgh\" (LTMG Sion)"),
        bloodGroup,
        component,
        units: z.number().int().min(1).max(20).describe("Units (bags) needed"),
        urgency: z.enum(URGENCIES).default("urgent").describe("critical (~1 h), urgent (~4 h) or routine (~24 h)"),
      },
      annotations: READ,
    },
    ({ hospitalId, bloodGroup, component, units, urgency }) =>
      guarded(async () => {
        const result = await req.search(deps, {
          hospitalId,
          bloodGroup,
          component,
          unitsNeeded: units,
          urgency,
          neededBy: deps.now + NEEDED_WITHIN_MIN[urgency] * 60_000,
        });
        const options = result.options.slice(0, 5).map((o) => ({
          rank: o.rank,
          bankSiteId: o.siteId,
          name: o.name,
          etaMinutes: o.etaMinutes,
          distanceKm: Math.round(o.distanceKm * 10) / 10,
          unitsAvailable: o.unitsAvailable,
          exactAvailable: o.exactAvailable,
          suggestedUnits: o.allocation.length,
          coversRequest: o.coversRequest,
          matchType: o.matchType,
          needsClinicianConfirmation: o.needsClinicianConfirmation,
          alternativeGroups: o.alternativeGroups,
          freshnessMinutes: o.freshnessMinutes,
          stale: o.stale,
          soonestExpiryHours: Math.round(o.soonestExpiryHours * 10) / 10,
        }));
        const label = `${units} × ${bloodGroup} ${COMPONENT_LABEL[component].toLowerCase()}`;
        if (options.length === 0) {
          return ok(`No compatible in-date stock for ${label}. ${result.noMatch?.hint ?? ""}`, {
            options: [],
            noMatch: result.noMatch,
          });
        }
        const text = options
          .map(
            (o) =>
              `${o.rank}. ${o.name} [${o.bankSiteId}] — ETA ${o.etaMinutes} min, ${o.suggestedUnits}/${units} units ${o.coversRequest ? "(covers)" : "(partial)"}, ${o.matchType}${o.needsClinicianConfirmation ? " — clinician must confirm" : ""}, stock updated ${o.freshnessMinutes} min ago${o.stale ? " (STALE, phone-check)" : ""}, soonest expiry ${o.soonestExpiryHours} h`,
          )
          .join("\n");
        return ok(`Options for ${label} (${urgency}) at ${hospitalId}:\n${text}\n\nTo act: create_and_reserve with bankSiteId of the chosen option.`, {
          query: { hospitalId, bloodGroup, component, units, urgency },
          options,
          totalOptions: result.options.length,
        });
      }),
  );

  server.registerTool(
    "get_request",
    {
      title: "Get a blood request's status",
      description:
        "Get the live status of a blood request (id like \"REQ-ABC123\", returned by create_and_reserve): which bank holds it, reservation status, ETA, whether the bank has confirmed, and the requested → confirmed → reserved → picked_up → delivered timeline (IST). Banks that don't confirm in 90 s are auto-rerouted.",
      inputSchema: { requestId: z.string().min(1).max(64).describe("Request id, e.g. \"REQ-ABC123\"") },
      annotations: READ,
    },
    ({ requestId }) =>
      guarded(async () => {
        const r = await req.getRequest(deps, requestId);
        const a = r.active;
        const timeline = a?.timeline.map((t) => `${t.step}: ${t.at ? istTime(t.at) : "—"}`).join(" → ") ?? "no active reservation";
        const text = [
          `${r.id}: ${r.unitsNeeded} × ${r.bloodGroup} ${COMPONENT_SHORT[r.component]} for ${r.hospitalName} (${r.ward}), ${r.urgency}, status ${r.status}.`,
          a
            ? `Held at ${a.bankName}: ${a.status}, ${a.unitsCount} units, ${a.matchType}${a.needsClinicianConfirmation ? " (clinician confirm)" : ""}, ETA ${a.etaMinutes} min, bank confirm by ${istTime(a.confirmBy)}.`
            : "No live reservation.",
          `Timeline: ${timeline}`,
          r.reservations.length > 1 ? `Earlier attempts: ${r.reservations.filter((x) => x !== a).map((x) => `${x.bankName} ${x.status}${x.declineReason ? ` (${x.declineReason})` : ""}`).join("; ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return ok(text, {
          request: {
            id: r.id,
            hospitalId: r.hospitalId,
            hospitalName: r.hospitalName,
            bloodGroup: r.bloodGroup,
            component: r.component,
            unitsNeeded: r.unitsNeeded,
            urgency: r.urgency,
            ward: r.ward,
            status: r.status,
            createdAt: r.createdAt,
          },
          active: a && {
            reservationId: a.id,
            bankSiteId: a.bankSiteId,
            bankName: a.bankName,
            status: a.status,
            unitsCount: a.unitsCount,
            matchType: a.matchType,
            needsClinicianConfirmation: a.needsClinicianConfirmation,
            etaMinutes: a.etaMinutes,
            confirmBy: a.confirmBy,
            timeline: a.timeline,
          },
          attempts: r.reservations.map((x) => ({ bankName: x.bankName, status: x.status, declineReason: x.declineReason })),
        });
      }),
  );

  server.registerTool(
    "city_outlook",
    {
      title: "City blood outlook (72 h forecast)",
      description:
        "Forecast the next 72 hours across the city: which blood group × component runs out first (hours to stockout), which sites are at risk, expected expiry waste, and the outcome now vs. if every suggested transfer is approved vs. a no-surge baseline. Also reports any active (simulated) surge. Use this first for questions like 'what runs out first?' or 'what should we move?'. Demand rates and surge multipliers are modelled assumptions on top of a real stock snapshot.",
      inputSchema: {
        top: z.number().int().min(1).max(20).default(6).describe("How many groups and sites to list"),
      },
      annotations: READ,
    },
    ({ top }) =>
      guarded(async () => {
        const f = await fc.forecast(deps);
        const groups = f.outlook.filter((g) => g.stockoutHours !== null || g.sitesAtRisk > 0).slice(0, top);
        const atRisk = f.sites
          .filter((s) => s.earliestStockoutHours !== null)
          .sort((a, b) => a.earliestStockoutHours! - b.earliestStockoutHours!)
          .slice(0, top);
        const fmt = (o: typeof f.current) =>
          `shortfall next 24h ${o.shortfall24h} units, ${o.cellsAtRisk} stock cells at risk, waste ${o.expectedWaste} units, earliest stockout ${hours(o.earliestStockoutHours)}`;
        const text = [
          f.surge ? `ACTIVE SIMULATED SURGE: ${f.surge.label} in ${f.surge.areaName} (radius ${f.surge.radiusKm} km), since ${istTime(f.surge.startedAt)}.` : "No surge active (baseline demand).",
          "",
          "Runs out first (city-wide, pooled):",
          ...(groups.length
            ? groups.map((g) => `- ${g.bloodGroup} ${COMPONENT_SHORT[g.component]}: ${hours(g.stockoutHours)} · ${g.onHand} on hand · ${g.demandPerHour}/h demand · ${g.sitesAtRisk} sites out within 24h`)
            : ["- Nothing runs out within 72 h."]),
          "",
          "Sites at risk:",
          ...(atRisk.length
            ? atRisk.map((s) => `- ${s.name} [${s.siteId}]: ${s.worst ? `${s.worst.bloodGroup} ${COMPONENT_SHORT[s.worst.component]}` : ""} out in ${hours(s.earliestStockoutHours)}${s.surgeInfluence > 0 ? ` · surge influence ${Math.round(s.surgeInfluence * 100)}%` : ""}`)
            : ["- None."]),
          "",
          `Current: ${fmt(f.current)}`,
          `With all suggested transfers: ${fmt(f.withPlan)}`,
          `No-surge baseline: ${fmt(f.baseline)}`,
          "",
          "Next: list_transfer_suggestions to see what to move; send_donor_drive to close shortfalls transfers can't fix.",
        ].join("\n");
        return ok(text, {
          surge: f.surge,
          horizonHours: f.horizonHours,
          runsOutFirst: groups,
          sitesAtRisk: atRisk,
          current: f.current,
          withPlan: f.withPlan,
          baseline: f.baseline,
        });
      }),
  );

  server.registerTool(
    "list_transfer_suggestions",
    {
      title: "List suggested stock transfers",
      description:
        "List the planner's suggested bank-to-bank transfers (move expiring or surplus units to sites about to run out), most urgent first, with quantity, ETA, units rescued from expiry and the reason, plus transfers already approved in the last 24 h and the outcome before vs. after applying all suggestions. Feed a suggestion's fromSiteId/toSiteId/bloodGroup/component/quantity into approve_transfer.",
      inputSchema: {
        siteId: siteId.optional().describe("Only suggestions to or from this site"),
        limit: z.number().int().min(1).max(30).default(8).describe("Max suggestions to return"),
      },
      annotations: READ,
    },
    ({ siteId, limit }) =>
      guarded(async () => {
        const board = await fc.transferBoard(deps, siteId);
        const suggestions = board.suggestions
          .sort((a, b) => a.priority - b.priority)
          .slice(0, limit)
          .map((s) => ({
            fromSiteId: s.fromSiteId,
            fromName: s.fromName,
            toSiteId: s.toSiteId,
            toName: s.toName,
            bloodGroup: s.bloodGroup,
            component: s.component,
            quantity: s.quantity,
            etaMinutes: s.etaMinutes,
            rescuedFromExpiry: s.rescuedFromExpiry,
            receiverStockoutHours: s.receiverStockoutHours,
            reason: s.reason,
          }));
        const text = [
          suggestions.length
            ? suggestions
                .map(
                  (s, i) =>
                    `${i + 1}. ${s.quantity} × ${s.bloodGroup} ${COMPONENT_SHORT[s.component]}: ${s.fromName} [${s.fromSiteId}] → ${s.toName} [${s.toSiteId}], ETA ${s.etaMinutes} min${s.rescuedFromExpiry ? `, rescues ${s.rescuedFromExpiry} from expiry` : ""}. ${s.reason}`,
                )
                .join("\n")
            : "No transfers suggested right now.",
          board.active.length ? `\nAlready moving (24 h): ${board.active.map((t) => `${t.quantity} × ${t.bloodGroup} ${COMPONENT_SHORT[t.component]} ${t.fromName} → ${t.toName} (${t.status})`).join("; ")}` : "",
          `\nOutcome: 24h shortfall ${board.before.shortfall24h} → ${board.after.shortfall24h} units; waste ${board.before.expectedWaste} → ${board.after.expectedWaste} if all approved.`,
        ].join("\n");
        return ok(text, {
          suggestions,
          active: board.active.map((t) => ({ id: t.id, fromName: t.fromName, toName: t.toName, bloodGroup: t.bloodGroup, component: t.component, quantity: t.quantity, status: t.status, etaMinutes: t.etaMinutes })),
          before: board.before,
          after: board.after,
        });
      }),
  );

  server.registerTool(
    "preview_donor_drive",
    {
      title: "Preview a donor drive (eligibility funnel)",
      description:
        "Before alerting donors, show how many registered donors a drive for a blood bank and group would reach, and why the others are skipped (wrong group, no consent, not yet eligible since last donation, out of range, quiet hours, weekly alert cap). Read-only. Donors are synthetic; eligibility is simplified demo logic.",
      inputSchema: {
        bankSiteId: siteId.describe("Blood bank id that donors would go to, e.g. \"bb-kem-parel\""),
        bloodGroup,
      },
      annotations: READ,
    },
    ({ bankSiteId, bloodGroup }) =>
      guarded(async () => {
        const p = await donors.previewDrive(deps, bankSiteId, bloodGroup);
        const skipped = Object.entries(p.skipped)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${k.replace(/_/g, " ")} ${n}`)
          .join(", ");
        return ok(
          `${p.eligibleCount} of ${p.totalDonors} registered donors would be alerted for ${bloodGroup} at ${bankSiteId}. Skipped: ${skipped || "none"}.`,
          { ...p, bankSiteId },
        );
      }),
  );

  server.registerTool(
    "explain_compatibility",
    {
      title: "Explain blood compatibility",
      description:
        "Explain which donor blood groups can supply a recipient group, per component (red cells, whole blood, platelets, plasma follow different rules — e.g. O- is universal for red cells but AB is universal for plasma). SIMPLIFIED DEMO LOGIC, not clinical guidance; say so when you relay it.",
      inputSchema: {
        recipientGroup: bloodGroup.describe("The patient's blood group"),
        component: component.optional().describe("One component, or omit for all four"),
      },
      annotations: READ,
    },
    ({ recipientGroup, component }) =>
      guarded(async () => {
        const comps = component ? [component] : [...COMPONENTS];
        const table = comps.map((c) => {
          const sources = compatibleSources(recipientGroup, c);
          return {
            component: c,
            exact: sources.filter((s) => s.exact).map((s) => s.group),
            alternatives: sources.filter((s) => !s.exact).map((s) => s.group),
          };
        });
        const text = [
          `Donor groups that can supply a ${recipientGroup} recipient:`,
          "| Component | Exact | Compatible alternatives (scarce groups last) |",
          "|---|---|---|",
          ...table.map((r) => `| ${COMPONENT_LABEL[r.component]} | ${r.exact.join(", ") || "—"} | ${r.alternatives.join(", ") || "none"} |`),
          "",
          COMPAT_DISCLAIMER,
        ].join("\n");
        return ok(text, { recipientGroup, table, disclaimer: COMPAT_DISCLAIMER });
      }),
  );

  server.registerTool(
    "verify_ledger",
    {
      title: "Verify the audit ledger",
      description:
        "Re-hash the tamper-evident activity ledger (every reservation, transfer, surge and alert, including AI actions) and report whether the hash chain is intact, how many entries were checked, and where it breaks if it was tampered with.",
      inputSchema: {},
      annotations: READ,
    },
    () =>
      guarded(async () => {
        const v = await audit.verifyAudit(deps);
        const text = v.ok
          ? `Ledger intact: ${v.checked} entries verified, head hash ${v.headHash?.slice(0, 16) ?? "—"}…`
          : `LEDGER BROKEN at entry #${v.brokenAt} (${v.checked} checked). Someone altered history after it was written.`;
        return ok(text, { ...v });
      }),
  );

  server.registerTool(
    "recent_activity",
    {
      title: "Recent activity (audit log)",
      description:
        "Show the most recent entries in the city's audit ledger, newest first: who did what (actor — 'ai:chatgpt' / 'ai:claude' for AI actions), when (IST) and a one-line summary. Use to confirm an action landed or to narrate what has happened.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10).describe("Entries to return"),
        siteId: siteId.optional().describe("Only entries for this site"),
        aiOnly: z.boolean().default(false).describe("Only actions taken by AI clients"),
      },
      annotations: READ,
    },
    ({ limit, siteId, aiOnly }) =>
      guarded(async () => {
        let entries = await audit.listAudit(deps, { siteId, limit: aiOnly ? 200 : limit });
        if (aiOnly) entries = entries.filter((e) => e.actor.startsWith("ai:")).slice(0, limit);
        const rows = entries.map((e) => ({ seq: e.seq, at: e.at, actor: e.actor, action: e.action, summary: e.summary }));
        const text = rows.length
          ? rows.map((e) => `#${e.seq} ${istTime(e.at)} · ${e.actor} · ${e.summary}`).join("\n")
          : "No activity recorded yet.";
        return ok(text, { entries: rows });
      }),
  );

  server.registerTool(
    "data_sources",
    {
      title: "What is real vs simulated",
      description:
        "Explain Blood Bridge's data provenance: which data is real public data (Mumbai blood banks, hospitals, e-RaktKosh stock snapshot, shelf lives, flood spots), which is modelled (expiry per bag, demand, surge multipliers) and which is synthetic (donors, patients, requests). Call this whenever the user asks if the data is real, or before making claims about real-world stock.",
      inputSchema: {},
      annotations: READ,
    },
    () => guarded(async () => ok(DATA_SOURCES_MARKDOWN, { markdown: DATA_SOURCES_MARKDOWN, stockSnapshotAt: SNAPSHOT_FETCHED_AT })),
  );
}

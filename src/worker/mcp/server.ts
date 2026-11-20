/**
 * Builds a fresh McpServer for one request (stateless): tools, prompts and the
 * data-sources resource, all bound to that request's Deps, actor and auth.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DATA_SOURCES_MARKDOWN, DATA_SOURCES_URI, SERVER_INSTRUCTIONS } from "./content";
import type { McpContext } from "./context";
import { registerReadTools } from "./tools-read";
import { registerWriteTools } from "./tools-write";

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: "blood-bridge", title: "Blood Bridge — Mumbai blood network", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerReadTools(server, ctx);
  registerWriteTools(server, ctx);

  server.registerResource(
    "data-sources",
    DATA_SOURCES_URI,
    {
      title: "Blood Bridge data sources",
      description: "What is real public data, what is modelled, and what is synthetic in Blood Bridge.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: DATA_SOURCES_MARKDOWN }] }),
  );

  const user = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

  server.registerPrompt(
    "surge_drill",
    {
      title: "Run a doomsday drill",
      description: "Simulate a flood or mass-casualty surge in an area, find what runs out first, and propose transfers and donor drives — with human approval at each step.",
      argsSchema: {
        area: z.string().describe("Area to centre the drill on, e.g. Kurla, Andheri Subway, Hindmata"),
        kind: z.string().optional().describe("flood (default) or mass_casualty"),
      },
    },
    ({ area, kind }) =>
      user(
        `Run a doomsday drill: a simulated ${kind === "mass_casualty" ? "mass-casualty incident" : "flash flood"} in ${area}, Mumbai.
1. Call city_outlook to capture the baseline.
2. Call start_surge (kind ${kind === "mass_casualty" ? "mass_casualty" : "flood"}, area "${area}") WITHOUT confirm, show me the preview, and wait for my approval before confirming.
3. After it starts, call city_outlook again: tell me which blood group and component runs out first, in how many hours, and which sites are at risk.
4. Call list_transfer_suggestions and recommend the top 3 transfers with why. Preview each with approve_transfer and only confirm the ones I approve.
5. For any shortfall transfers can't close, preview send_donor_drive for the most affected bank and group.
6. Finish with a 3-line situation brief, and remind me the surge is simulated (call data_sources if I ask what's real).`,
      ),
  );

  server.registerPrompt(
    "find_blood_for_patient",
    {
      title: "Find blood for a patient",
      description: "Find and (with approval) reserve compatible blood for a patient at a Mumbai hospital.",
      argsSchema: {
        hospital: z.string().describe("Hospital name or id, e.g. LTMG Sion / hsp-sion-ltmgh"),
        bloodGroup: z.string().describe("Patient blood group, e.g. O-"),
        component: z.string().describe("whole_blood, red_cells, platelets or plasma"),
        units: z.string().describe("Units needed, e.g. 2"),
        urgency: z.string().optional().describe("critical, urgent (default) or routine"),
      },
    },
    ({ hospital, bloodGroup, component, units, urgency }) =>
      user(
        `A patient at ${hospital} needs ${units} unit(s) of ${bloodGroup} ${component}, ${urgency ?? "urgent"}.
If you don't know the hospital id, call list_sites with kind "hospital". Then call find_blood and show me the top 3 options with ETA, match type and data freshness. Flag any non-exact match as needing clinician confirmation (explain_compatibility can show why it's allowed — it's demo logic, not clinical guidance).
Recommend one, preview create_and_reserve for it, and only confirm after I say yes. Then call get_request and tell me the bank's confirm deadline.`,
      ),
  );

  server.registerPrompt(
    "shift_handover",
    {
      title: "Shift handover brief",
      description: "Summarise the city's blood situation and recent activity for an incoming coordinator.",
      argsSchema: {},
    },
    () =>
      user(
        "Give me a shift handover for the Mumbai blood network: call city_outlook, list_transfer_suggestions (top 5), recent_activity (last 15) and verify_ledger. Summarise in under 150 words: what runs out first, what is already moving, what needs a decision now, and whether the ledger is intact.",
      ),
  );

  return server;
}

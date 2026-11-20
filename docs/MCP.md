# Blood Bridge MCP server

Blood Bridge runs a remote [Model Context Protocol](https://modelcontextprotocol.io) server, so ChatGPT and Claude can operate the city's blood network directly. Every action the AI takes goes through the same services as the app. It appears live on `/stage` and `/command`, and the hash-chained ledger records it under the actor `ai:chatgpt` or `ai:claude`.

```
https://blood-bridge.blood-bridge.workers.dev/mcp
```

- **Transport:** Streamable HTTP, stateless (POST only, JSON responses). `GET /mcp` returns 405, as the spec allows for servers without a standalone stream.
- **Implementation:** `src/worker/mcp/` uses `@modelcontextprotocol/sdk` `McpServer` and the `@hono/mcp` `StreamableHTTPTransport`. A fresh server is built per request and calls the service layer directly.
- **Local:** `http://localhost:5173/mcp` (`pnpm dev`) or the `wrangler dev` port.

## Auth

| What | Token needed? |
|---|---|
| Read tools, dry-run previews, prompts, resource | No |
| Write tools with `confirm: true` | Yes: `MCP_TOKEN` |

Send the token either way:

- `Authorization: Bearer <MCP_TOKEN>` (Claude Code, Inspector, curl)
- `https://…/mcp?token=<MCP_TOKEN>` (for connector UIs that only take a URL, such as ChatGPT and Claude.ai)

Optional `&client=<name>` sets the ledger actor to `ai:<name>`. Without it, the actor comes from the User-Agent (`ai:chatgpt`, `ai:claude` or `ai:mcp`).

The token is a Worker secret (`wrangler secret put MCP_TOKEN`). For local dev it lives in `.dev.vars`, which is gitignored. If no token is configured, write tools are disabled and read tools still work. Confirmed AI writes are capped at 60 per hour; `POST /api/demo/reset` clears the cap.

A token in a URL can end up in logs. Rotate it after the event (`wrangler secret put MCP_TOKEN` with a new value).

## Connect a client

**ChatGPT** (Plus/Pro/Team/Enterprise, web):
1. Settings → Apps & Connectors → Advanced settings → turn on **Developer mode**.
2. Settings → Connectors → **Create**.
3. Name it `Blood Bridge`. Set the MCP server URL to `https://blood-bridge.blood-bridge.workers.dev/mcp?token=<MCP_TOKEN>&client=chatgpt` and Authentication to **No authentication**. Tick "I trust this application" and create it.
4. In a new chat, open **+** → Developer mode and enable the Blood Bridge connector. ChatGPT normally asks for approval before it runs a tool that is not read-only, which adds a second human-in-the-loop layer.

**Claude.ai / Claude Desktop** (Pro/Max/Team/Enterprise):
1. Settings → Connectors → **Add custom connector**.
2. Name it `Blood Bridge`. Set the URL to `https://blood-bridge.blood-bridge.workers.dev/mcp?token=<MCP_TOKEN>&client=claude`. Leave the OAuth fields empty.
3. In a chat, open the tools menu and make sure Blood Bridge is enabled. Claude Desktop picks up connectors added on claude.ai automatically.

**Claude Code:**
```bash
claude mcp add --transport http blood-bridge https://blood-bridge.blood-bridge.workers.dev/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
# read-only: drop the --header
```

**MCP Inspector (headless check):**
```bash
npx @modelcontextprotocol/inspector --cli https://blood-bridge.blood-bridge.workers.dev/mcp --transport http --method tools/list
```

## Tools

Data note: the sites are real (25 Mumbai blood banks and 6 municipal hospitals), and stock started from a real e-RaktKosh snapshot. Donors, patients, requests and surges are synthetic or simulated. Compatibility is simplified demo logic. The `data_sources` tool and the `bloodbridge://data-sources` resource spell this out.

### Read (open, `readOnlyHint`)

| Tool | Use it for |
|---|---|
| `list_sites` | Site ids, area, units by group, freshness and staleness |
| `find_blood` | Ranked banks for a hospital × group × component × units × urgency, with ETA, match type and freshness |
| `get_request` | A request's status, holding bank, confirm deadline and timeline |
| `city_outlook` | 72 h forecast: what runs out first, sites at risk, outcome now vs. with plan vs. baseline, and the active surge |
| `list_transfer_suggestions` | The planner's bank-to-bank moves, plus transfers already moving |
| `preview_donor_drive` | Eligibility funnel: how many donors a drive would reach and why others are skipped |
| `explain_compatibility` | Donor groups per component for a recipient (demo logic) |
| `verify_ledger` | Re-hash the audit chain and report intact or broken |
| `recent_activity` | Latest ledger entries; `aiOnly: true` shows only AI actions |
| `data_sources` | What is real vs modelled vs synthetic |

### Write (human-in-the-loop)

| Tool | Effect when confirmed |
|---|---|
| `create_and_reserve` | Creates a request and holds units at a bank (the top-ranked bank unless `bankSiteId` is given). The bank has 90 s to confirm before the request auto-reroutes. |
| `approve_transfer` | Moves units between banks; the transfer arc appears on `/command` |
| `start_surge` | Starts a SIMULATED flood or mass-casualty surge in an area (`"Kurla"`, `"Andheri Subway"`, …). `/command` enters surge mode. |
| `end_surge` | Ends the surge |
| `send_donor_drive` | Sends localised alerts to eligible, consenting donors; their phones light up on `/stage` |

**The human-in-the-loop rule:** every write tool takes `confirm`. If `confirm` is missing or false, the tool returns a **dry-run preview** that changes nothing and ends with "Ask the user to confirm". The tool mutates only when called again with `confirm: true`, and only if the connection carries the token. The server instructions tell the model to show the preview and wait for an explicit yes.

### Prompts and resource
- `surge_drill(area, kind?)`: a full doomsday drill. It records the baseline, previews and starts the surge, finds what runs out first, proposes transfers and donor drives, and writes a brief.
- `find_blood_for_patient(hospital, bloodGroup, component, units, urgency?)`: search, recommend, preview, reserve, then track.
- `shift_handover()`: a brief of under 150 words for the incoming coordinator.
- Resource `bloodbridge://data-sources`: the real-vs-simulated summary as markdown.

## 60-second judge script

Before you start, run `POST /api/demo/reset`, open `/command` and `/stage` on the big screen, and keep ChatGPT or Claude open with the connector enabled.

1. **"A flood just hit Kurla. What runs out first, and what should we move?"**
   The AI calls `city_outlook`, then previews `start_surge` and asks you to confirm.
2. **"Yes, start the drill."**
   `/command` flips to surge mode with stock-out countdowns. The AI names the first group to run out and the hours left.
3. **"Approve the top transfer."**
   The AI previews `approve_transfer`. Say "confirm" and the transfer arc draws on the map while the outcome meter improves.
4. **"A patient at LTMG Sion needs 2 units of O-negative platelets, critical. Reserve the best option."**
   `find_blood`, then a `create_and_reserve` preview, then confirm. The request appears on the hospital and bank panels on `/stage`.
5. **"Prove the AI didn't cheat: show what you did and verify the ledger."**
   `recent_activity` (aiOnly) lists every `ai:` action, and `verify_ledger` reports the chain intact.

Bonus: "Which of this data is real?" calls `data_sources`.

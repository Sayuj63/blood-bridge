# Blood Bridge

**When a patient needs blood now, one screen shows compatible, in-date stock across Mumbai's blood banks, reserves it in one tap, and — when the city is under stress — forecasts shortages and moves blood and donors before they run out.**

MindSprint 2026 · Open Innovation · Team Straw Hats · Live: https://blood-bridge.blood-bridge.workers.dev

## Demo routes
| Route | What it is |
|---|---|
| `/` | The problem, told as a scroll story (sources footnoted) |
| `/stage` | Hospital · Blood bank · Donor phone side by side + "Judges: scan to become a donor" QR |
| `/command` | Doomsday surge mode: stock-out countdowns, transfer arcs, before/after outcome meter, AI situation brief |
| `/hospital` `/bank` `/donor` | The three role views |
| `/ledger` | Tamper-evident hash-chained activity log (try "tamper", then "verify") |

## Real vs simulated
Real open data: 25 Mumbai blood banks + 6 municipal hospitals (data.gov.in, OpenStreetMap), live stock counts by group × component and each bank's last-update time (e-RaktKosh public snapshot), shelf lives (Drugs Rules G.S.R. 166(E) 2020), group shares and collection volumes (cited). Modelled: per-bag expiry, demand rates, surge multipliers. Synthetic: every donor, patient and request. Details: [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) · problem evidence: [`docs/PROBLEM_RESEARCH.md`](docs/PROBLEM_RESEARCH.md) · pitch: [`docs/JUDGE_PLAYBOOK.md`](docs/JUDGE_PLAYBOOK.md).

## Architecture
One Cloudflare Worker: React 19 SPA (static assets) + Hono API + **CityHub Durable Object** (WebSocket fan-out to every view, serialised hash-chained audit ledger, alarm that auto-reroutes requests a bank doesn't confirm in 90 s) + **D1** (Drizzle) + **Workers AI** open models (Hindi/Marathi donor alerts, surge brief, with template fallback). MapLibre + OpenFreeMap + deck.gl — no API keys. Domain logic (`src/shared`) is pure TypeScript shared by Worker and UI: per-component compatibility, ranking, FIFO expiry-aware forecast, transfer planner, consent-aware donor targeting.

## Run
```bash
pnpm install
pnpm db:migrate:local && pnpm dev     # then POST /api/demo/reset
pnpm test                             # domain unit tests
node scripts/smoke.mjs <base-url>     # end-to-end demo check (resets data!)
pnpm run deploy
```
Compatibility rules and eligibility intervals are simplified demo logic, labelled in the app; clinicians confirm every non-exact match.

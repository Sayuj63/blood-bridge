# Blood Bridge API — frontend guide

Everything the UI needs: base URL, conventions, every endpoint with its request and response shape, the realtime
protocol, and the main user flows in call order.

**Types are the source of truth.** Every request body is a Zod schema and every response is a TypeScript interface in
[`src/shared/api.ts`](../src/shared/api.ts) (domain enums in [`src/shared/domain.ts`](../src/shared/domain.ts)). Copy
or import that file and the compiler will keep you honest. A ready-made typed client lives in
[`src/web/lib/api.ts`](../src/web/lib/api.ts).

---

## Conventions

| | |
|---|---|
| **Base URL** | `https://blood-bridge.blood-bridge.workers.dev/api`, or your own local backend at `http://localhost:5173/api` (`pnpm install && pnpm db:migrate:local && pnpm dev`, then `POST /api/demo/reset`; no Cloudflare account needed) |
| **Format** | JSON in, JSON out. `Content-Type: application/json` on bodies. |
| **Time** | All timestamps are **epoch milliseconds (UTC)**. Display in IST (`Asia/Kolkata`). |
| **Who is acting** | Send `X-Actor` on every write, e.g. `hospital:hsp-sion-ltmgh`, `bank:bb-raheja-mahim`, `donor:DNR-AARAV`. It is written to the audit ledger. (Demo identity — there are no logins yet.) |
| **IDs** | Site IDs are real slugs (`bb-…` blood banks, `hsp-…` hospitals). **Never hardcode them** — read `GET /sites`. |
| **Errors** | Non-2xx responses are `{ "error": { "code": string, "message": string, "details"?: unknown } }`. Show `message` to users. |
| **CORS** | Open to any origin (no cookies are used), so a separately hosted frontend or `localhost:3000` can call it directly. |
| **Caching** | Heavy reads (`/sites`, `/sites/:id/stock`, `/forecast`, `/transfers`) are cached server-side and refreshed when data changes. Refetch on realtime events; **do not poll**. |

### Status codes

| Code | Meaning | Typical `error.code` |
|---|---|---|
| 200 / 201 | OK / created | |
| 400 | Malformed request | `bad_request` |
| 404 | Unknown ID | `not_found` |
| 409 | State conflict — refresh and retry | `conflict`, `duplicate_request` (details has `requestId`), `conflicting_reservation`, `phone_confirm_required`, `already_fulfilled`, `eraktkosh_via_relay`, `rakt_not_configured` |
| 422 | Validation failed — `details` maps field → messages | `validation_failed` |
| 429 | Rate limited (critical alerts: 3/hour/hospital) | `rate_limited` |
| 502 | Upstream system unreachable (e-RaktKosh, RAKT) | `eraktkosh_unavailable`, `rakt_unavailable` |

---

## Realtime (live updates)

Connect once per tab: `wss://blood-bridge.blood-bridge.workers.dev/api/realtime` (use `ws://` locally).

Server → client messages:

```jsonc
{ "type": "hello", "seq": 412 }                       // on connect
{ "type": "event", "event": {
    "seq": 413, "at": 1795250000000,
    "topics": ["reservations", "requests", "stock", "sites"],
    "headline": "Riverside needs 2 × O- PLT from S. L. Raheja",   // optional — show as a toast
    "tone": "info" | "success" | "warning" | "critical",          // optional
    "siteIds": ["bb-raheja-mahim", "hsp-sion-ltmgh"],             // optional — who it concerns
    "donorIds": ["DNR-AARAV"]                                     // optional — alerts reach only these phones
} }
{ "type": "pong" }                                    // reply to {"type":"ping"}
```

Send `{"type":"ping"}` every ~25 s and reconnect with backoff if the socket closes.

**Events say *what changed*, not the new data — refetch the matching queries:**

| Topic | Refetch |
|---|---|
| `sites` | `GET /sites` |
| `stock` | `GET /sites/:id/stock`, `GET /sites` |
| `requests`, `reservations` | `GET /requests…`, `GET /sites/:id/queue` |
| `transfers` | `GET /transfers` |
| `surge` | `GET /forecast`, `GET /surge/brief` |
| `donors`, `alerts` | `GET /donors/:id`, `GET /donors/:id/alerts`, `GET /sites/:id/incoming-donors` |
| `messaging` | `GET /messaging/status` |
| `audit` | `GET /audit` |

---

## Endpoints

### Meta & sites

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `GET /health` | — | `{ ok: true }` | |
| `GET /meta` | — | `MetaDTO` | City, policy numbers (stale threshold, confirm window…), areas for donor sign-up, `surgeZones`, `stockSnapshotAt`. Fetch once at startup. |
| `GET /sites` | — | `SiteDTO[]` | All blood banks + hospitals with coordinates, `freshnessMinutes`, `stale`, `availableByGroup`. |
| `GET /sites/:id/stock` | — | `SiteStockDTO` | A bank's stock grid (`cells`: group × component with on hand / reserved / expiring 48h / 7d / level) and its units soonest-expiring first. |
| `POST /sites/:id/sync` | — | `{ ok }` | Operator confirms the shelf count (refreshes freshness). |
| `POST /sites/:id/units` | `AddUnitsInput` `{ bloodGroup, component, count, expiresInDays? }` | `UnitDTO[]` | |
| `POST /units/:id/action` | `{ action: "use" \| "remove" \| "discard" }` | `UnitDTO` | |
| `POST /sites/:id/offer` | `{ unitIds: string[] }` | `{ offered }` | Hospital offers units for transfer. |

### Search, requests, reservations (hospital ↔ bank)

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `POST /search` | `SearchInput` `{ hospitalId, bloodGroup, component, unitsNeeded, urgency, neededBy }` | `SearchResultDTO` | Ranked options (`RankedOption`: ETA, freshness, `matchType`, `needsClinicianConfirmation`, `scoreBreakdown`). `noMatch` set when nothing compatible. No write. |
| `POST /requests` | `CreateRequestInput` = search fields + `ward` | `RequestDTO` (201) | 409 `duplicate_request` if the same ward has an identical open request (<10 min). |
| `GET /requests?hospitalId=` | — | `RequestDTO[]` | Today's requests for a hospital. |
| `GET /requests/:id` | — | `RequestDTO` | Includes every reservation (`ReservationDTO` with `timeline`, `confirmBy`, `holdExpiresAt`) and `active`. |
| `POST /requests/:id/reserve` | `{ bankSiteId }` | `RequestDTO` | Holds units at one bank. 409 `conflicting_reservation` if someone took them first → search again. |
| `GET /requests/:id/split-plan` | — | `{ remaining, plan: SplitPlan }` | Preview: how the uncovered units would split across banks. |
| `POST /requests/:id/reserve-split` | — | `SplitReservationDTO` | Reserve every uncovered unit across as few banks as possible. `shortBy` > 0 → suggest a critical alert. |
| `POST /requests/:id/critical` | — | `DonorDriveResultDTO` | Critical requests only: alerts every bank + eligible donors. 429 when rate-limited. |
| `GET /sites/:id/queue` | — | `QueueItemDTO[]` | Bank's incoming reservations, actionable + critical first. |
| `POST /reservations/:id/confirm` | `{ units? }` | `ReservationDTO` | Omit `units` to confirm all; fewer = partial confirm. |
| `POST /reservations/:id/decline` | `{ reason }` | `RequestDTO` | Auto-reroutes to the next-best bank. |
| `POST /reservations/:id/advance` | `{ to: "picked_up" \| "delivered" }` | `RequestDTO` | 409 `phone_confirm_required` if data was stale and not phone-confirmed. |
| `POST /reservations/:id/phone-confirm` | — | `ReservationDTO` | |

> If a bank doesn't confirm within `policy.confirmWindowSeconds` (90 s), the server expires the reservation and **reroutes automatically**; you'll get a `reservations` event.

### Forecast, transfers, surge (command dashboard)

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `GET /forecast` | — | `ForecastDTO` | `outlook` (per group/component, soonest stock-out first), `sites` (risk per site), `current` vs `withPlan` vs `baseline` (`OutcomeSummary`: `shortfall24h`, `expectedWaste`, `cellsAtRisk`, `earliestStockoutHours`…), active `surge`. |
| `GET /transfers?siteId=` | — | `TransferBoardDTO` | `suggestions` (with `key`, `reason`, `quantity`, `rescuedFromExpiry`), `active` transfers, `before`/`after`. Omit `siteId` for the whole city. |
| `POST /transfers` | `{ fromSiteId, toSiteId, bloodGroup, component, quantity }` | `TransferDTO` (201) | Approve (optionally with a modified quantity). |
| `POST /transfers/dismiss` | `{ fromSiteId, toSiteId, bloodGroup, component }` | `{ ok }` | |
| `POST /transfers/:id/complete` | — | `TransferDTO` | Receiver marks it received. |
| `POST /surge` | `{ kind: "flood" \| "mass_casualty", areaId? }` | `SurgeDTO` (201) | `areaId` from `meta.surgeZones` / `meta.areas`; defaults: flood → Kurla, mass casualty → Dadar. |
| `DELETE /surge` | — | `{ ok }` | Stand down. |
| `GET /surge/brief` | — | `SurgeBriefDTO` | 3-line situation brief; `source` is `workers-ai` or `template`. |

### Donors & alerts

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `GET /donors/personas` | — | `DonorDTO[]` | Demo donor profiles. |
| `POST /donors` | `DonorSignupInput` `{ name, phone, bloodGroup, areaId, language, consentAlerts, consentLocation, consentEligibility, lastDonationAt?, contactChannel?, contactPhone?, contactConsent? }` | `DonorSignupDTO` | `contactChannel: "whatsapp"` + `contactConsent: true` to get WhatsApp alerts. |
| `GET /donors/:id` | — | `DonorDTO` | Eligibility (`eligible`, `eligibleFrom`), history, honest impact. |
| `PATCH /donors/:id` | any of `{ consentAlerts, consentLocation, consentEligibility, language, quietHoursStart, quietHoursEnd, maxAlertsPerWeek }` | `DonorDTO` | |
| `POST /donors/:id/opt-out` | `{ optOut: boolean }` | `DonorDTO` | |
| `GET /donors/:id/alerts` | — | `DonorAlertDTO[]` | Address / code / window are `null` until the donor accepts. |
| `POST /alerts/:id/respond` | `{ response: "accept" \| "decline" }` | `DonorAlertDTO` | 409 `already_fulfilled` → show a thank-you. |
| `POST /drives/preview` | `{ bankSiteId, bloodGroup }` | `DonorDrivePreviewDTO` | Eligibility funnel **before** sending (skipped by group / consent / ineligible / range / quiet hours / weekly cap). |
| `POST /drives` | `{ bankSiteId, bloodGroup, component?, urgency?, donorsNeeded? }` | `DonorDriveResultDTO` (201) | |
| `GET /sites/:id/incoming-donors` | — | `IncomingDonorDTO[]` | Donors who said yes (contact visible only after they accepted). |
| `POST /alerts/:id/complete` | — | `{ ok }` | Bank records the donation; donor's eligibility clock restarts. |

### Connected systems

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `GET /sites/:id/integrations` | — | `IntegrationDTO[]` | e-RaktKosh, RAKT, eBloodConnect with `state` and `canSync`. |
| `POST /sites/:id/sync-eraktkosh` | — | `EraktkoshSyncDTO` | 409 `eraktkosh_via_relay` when the portal blocks the cloud but the India relay refreshed it recently. |
| `GET /eraktkosh/status` | — | `EraktkoshStatusDTO` | |
| `POST /sites/:id/sync-rakt` | — | `RaktSyncDTO` | 409 `rakt_not_configured` until a bank's RAKT key is set. |

### Messaging & ledger

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `GET /messaging/status` | — | `MessagingStatusDTO` | WhatsApp online / needs QR / offline. |
| `GET /messaging/contact` | — | `MessagingContactDTO` | Business WhatsApp number + `wa.me` link, when configured. |
| `GET /audit?siteId=&before=&limit=` | — | `AuditEntryDTO[]` | Newest first; page with `before=<seq>`. |
| `GET /audit/verify` | — | `AuditVerifyDTO` | `ok`, `brokenAt`. |
| `POST /demo/reset` | — | `{ sites, units, donors }` | Regenerates the demo city. **Wipes all demo state.** |
| `POST /demo/tamper` | — | `{ seq }` | Demo only: edits one ledger entry so verify fails. |

**Internal — not for the UI:** `/gateway/*` (laptop WhatsApp gateway + e-RaktKosh relay, bearer-token protected), `/whatsapp/webhook` (Meta), `/mcp` (AI connector, see [MCP.md](MCP.md)).

---

## Flows in call order

**Hospital — find and reserve (the 60-second demo)**
1. `GET /meta`, `GET /sites` → pick the hospital (`kind: "hospital"`).
2. `POST /search` → render `options` on the map + cards.
3. Reserve: `POST /requests` → `POST /requests/:id/reserve { bankSiteId }`; or, when `options[0].coversRequest` is false, `POST /requests/:id/reserve-split`.
4. Show the tracker from `GET /requests/:id`; refetch on `reservations` events. Count down to `active.confirmBy`.

**Blood bank — respond**
1. `GET /sites/:id/stock`, `GET /sites/:id/queue`.
2. On a new item: `POST /reservations/:id/confirm` (or `/decline { reason }`).
3. Later: `POST /reservations/:id/advance { to: "picked_up" }`.

**Donor — alert to donation**
1. Bank: `POST /drives/preview` → `POST /drives`.
2. Donor phone: on an `alerts` event containing its `donorId`, `GET /donors/:id/alerts` → full-screen alert.
3. `POST /alerts/:id/respond { response: "accept" }` → show address, window, code.
4. Bank: `GET /sites/:id/incoming-donors` → `POST /alerts/:id/complete`.

**Command — surge**
1. `POST /surge { kind: "mass_casualty" }` → `GET /forecast`, `GET /transfers`, `GET /surge/brief`.
2. `POST /transfers { … }` to approve → refetch on `transfers` / `surge` events; compare `current` vs `withPlan`.

---

## Quick test with curl

```bash
B=https://blood-bridge.blood-bridge.workers.dev/api
curl -s $B/sites | head -c 300
curl -s -X POST $B/search -H 'content-type: application/json' -H 'X-Actor: hospital:hsp-sion-ltmgh' \
  -d '{"hospitalId":"hsp-sion-ltmgh","bloodGroup":"O-","component":"platelets","unitsNeeded":2,"urgency":"urgent","neededBy":'$(( $(date +%s)*1000 + 3600000 ))'}'
```

The end-to-end script [`scripts/smoke.mjs`](../scripts/smoke.mjs) exercises every flow above in order — a runnable reference.

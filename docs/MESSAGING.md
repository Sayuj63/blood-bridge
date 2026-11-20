# WhatsApp & SMS channels

**The scramble happens on WhatsApp, so Blood Bridge answers there.** Families and ward staff already post "need 2 O− platelets near Sion" in WhatsApp groups, and donors live on WhatsApp and SMS. Blood Bridge meets them in that channel: anyone can ask for blood and get the nearest compatible stock back, donors can sign up and answer alerts with a one-word reply, and STOP always works.

## Two ways to send WhatsApp

| | **Official Cloud API** (recommended) | **open-wa gateway** (fallback) |
|---|---|---|
| Sender the donor sees | Business account "Blood Bridge" (Meta's own API) | A personal WhatsApp number |
| Runs where | Inside the Cloudflare Worker. No laptop | Node gateway on a laptop or VM, headless Chrome |
| Terms of Service | Allowed | Against WhatsApp's ToS, number can be banned |
| Cold messages (no chat in 24 h) | Approved template first, full text once they reply | Free-form |
| Groups | No | Yes (`WA_GROUPS=on`) |
| Turn on | Set `WA_PHONE_NUMBER_ID` + `WA_ACCESS_TOKEN` ([guide below](#get-a-free-official-blood-bridge-whatsapp-sender)) | `CHANNELS=whatsapp` in `gateway/.env` |

Exactly one of them sends WhatsApp. When the Cloud API is configured it wins (`WA_PROVIDER` defaults to `cloud`), and `POST /api/gateway/outbox/claim` stops handing WhatsApp rows to gateways, so nothing is sent twice. SMS still goes through the gateway either way. Set `WA_PROVIDER=gateway` to keep using open-wa while the Cloud API secrets are in place.

### Cloud API path (inside the Worker)

```
 Donor phone                 Meta (graph.facebook.com)                         Cloudflare Worker
 ───────────                 ─────────────────────────                         ─────────────────
                                                         request that queued WhatsApp ─▶ ctx.waitUntil(drain)
 WhatsApp ◀── text / template ── POST /v26.0/{WA_PHONE_NUMBER_ID}/messages ◀── drain: claim("cloud-api") → window? → ack
                                                                               1-minute cron ─▶ drain (backstop)
 WhatsApp ──▶ message ──▶ POST /api/whatsapp/webhook ──(X-Hub-Signature-256)──▶ 200 at once, then in waitUntil:
                            (statuses: sent/delivered/read/failed)                  bot (same handleInbound) → release held → receipts → drain
```

- **Same outbox, same lease.** The drainer calls the same `claim()` / `ack()` the gateway uses (`gatewayId: "cloud-api"`), so the opt-in recheck at claim time, retries with backoff, the WhatsApp→SMS fallback for alerts and the audit trail are unchanged. `src/worker/services/messaging-cloud.ts`.
- **When it runs.** Right after any API or MCP request that queued a WhatsApp row (`Deps.onQueued` → `ctx.waitUntil`), after every webhook delivery, and from the existing 1-minute cron. Retry backoff (5 s / 30 s / 120 s) is therefore picked up within a minute.
- **24 h window vs template.** For each claimed row the drainer reads `conversations.last_inbound_at` for that number (`chooseDelivery()` in `src/worker/messaging/whatsapp-cloud.ts`):
  - messaged us within 24 h → send the row as free-form **text**;
  - otherwise (e.g. a donor alert to someone quiet for days) → send the **template** `WA_TEMPLATE_ALERT` (default `hello_world`, `en_US`), set `outbox.template_sent_at`, and park the row as `pending` for up to 24 h without using an attempt;
  - the moment they reply (any message), the webhook releases parked rows for that number and the full alert text goes out inside the new window;
  - no reply within 24 h → the row fails with `no_reply_to_template` (alerts then fall back to SMS when possible). Alerts also expire on their own TTL first.
  - If Meta still answers `131047` (outside the window), the row is retried once behind a template.
- **Errors.** Graph error codes map to retryable (throttling `4`, `80007`, `130429`, `131056`; transient `1`, `2`, `131000`, `131016`; network errors and 5xx) or permanent (token `190`, permissions `10`/`200`, bad request `100`/`131008`/`131009`, not on WhatsApp `131026`, template problems `132xxx`, outside window `131047`, unregistered number `133010`).
- **Receipts.** `statuses[]` from the webhook update `outbox.delivery_status` by provider message id (indexed; never moves backwards). A late `failed` on a row already marked sent becomes a failure, with the usual SMS fallback for alerts.
- **Inbound.** `entry[].changes[].value.messages[]` text, template quick-reply buttons and interactive button/list replies go into the same bot as the gateway (`channel: "whatsapp"`, E.164 from `wa_id`). `inbound_messages` dedupes by `wamid`, so Meta's retries are harmless. Media messages are ignored.
- **Click-to-chat onboarding.** A web signup that ticks WhatsApp gets a single-use code (`donors.whatsapp_join_code`) and a primary **"Open WhatsApp: say hi to Blood Bridge"** button (`https://wa.me/<number>?text=JOIN%20K7Q2M9`). The donor messages first, which opens the 24 h window. The bot sees `JOIN K7Q2M9`, links that WhatsApp number to the profile, confirms the opt-in and replies in the donor's language, without the multi-step JOIN chat. The code is never returned by public reads (`/api/donors/:id`, personas), so nobody can link their number to someone else's profile. With the Cloud API on, the web signup no longer sends a cold welcome (it could only be a bare template). `/stage` shows a second QR for the business number next to the judge QR (`GET /api/messaging/contact`).

## Architecture (gateway path)

open-wa drives a real WhatsApp Web session in headless Chrome, so it cannot run inside a Cloudflare Worker. A small **gateway** runs on a laptop or VM and talks to the Worker over **outbound HTTPS only**. No tunnel, no public IP and no inbound firewall rule are needed (inbound SMS webhooks are the one exception; see below).

```
 Donor / family phone                     Gateway (Node, laptop or VM)                     Cloudflare Worker
 ────────────────────                     ────────────────────────────                     ─────────────────
                        ┌──────────────────────────────────────────┐
 WhatsApp ◀──────────▶  │ WhatsAppOpenWaAdapter  (open-wa, Chrome) │       POST /api/gateway/outbox/claim ──▶  outbox (D1)
                        │ SmsAndroidGatewayAdapter ─▶ Android+SIM  │ ◀──── messages + 30 s lease               pending → claimed
 SMS      ◀──────────▶  │ ConsoleAdapter (stdin/stdout, testing)   │       POST /api/gateway/outbox/:id/ack ──▶  sent | retry | failed
                        │                                          │                                            (WhatsApp ×2 failed → SMS copy)
                        │            Relay  (poll 2 s, backoff,    │       POST /api/gateway/inbound ───────▶  bot: parser + Workers AI
                        │            pacing, at-least-once guard)  │                                            → replies queued in outbox
                        │                                          │       POST /api/gateway/heartbeat ─────▶  gateway_channels
                        └──────────────────────────────────────────┘
                                                                           GET /api/messaging/status (public) ◀─ /stage "WhatsApp online"
   sendDrive() ─▶ enqueueAlertMessages() ─▶ outbox (opted-in donors only)        CityHub DO: realtime "messaging" topic + audit ledger
```

- **One outbound path.** Donor alerts, bot replies and confirmations all go through the `outbox` table. Rate limits, the 24 h reply window, STOP suppression and auditing therefore apply to every message the same way.
- **Claim / ack.** `claim` is a single conditional `UPDATE … WHERE id IN (…) AND <still claimable> RETURNING`, so two gateways can never claim the same row. Each claim issues a lease token. An ack must present that token, and a stale or replayed ack gets `409`. If a gateway crashes mid-send, the lease expires after 30 s and the row is claimable again.
- **Delivery semantics.** Delivery is at least once. The gateway remembers recent successful sends: if its ack was lost and the row comes back, it re-acks instead of sending twice. SMS sends pass the outbox id as the SMS Gateway message id, which gives provider-level idempotency.
- **Retries.** Retries back off at 5 s, then 30 s, then 120 s, with at most 3 attempts. A WhatsApp **alert** that fails twice is marked failed and re-queued as **SMS** when the number is SMS-capable (Indian mobiles yes, landlines no). A permanent error such as "not on WhatsApp" skips the retries.
- **Bot replies are queued, not returned.** `POST /inbound` responds with `{ intent, queued }`, and the gateway claims straight away, so a reply goes out within about 1 s.
- **Pluggable adapters.** `gateway/src/adapters/types.ts` defines `ChannelAdapter` (`start`, `send`, `stop`, `state`). The official **WhatsApp Business Cloud API** doesn't need the gateway at all: it runs inside the Worker (see above).

### Files

| Where | What |
|---|---|
| `src/worker/services/messaging.ts` | Outbox: enqueue (safety checks), claim (lease), ack (retry / SMS fallback), heartbeat, status, drive and signup hooks |
| `src/worker/services/messaging-bot.ts` | Inbound bot: STOP/START, JOIN flow, `JOIN <code>` click-to-chat linking, YES/NO to alerts, need lookup, HELP |
| `src/worker/messaging/whatsapp-cloud.ts` | Cloud API: Graph sender (`GRAPH_VERSION`), error mapping, window-vs-template decision, webhook signature + payload parsing, config |
| `src/worker/services/messaging-cloud.ts` | In-Worker drainer (claim → text/template → ack), held-row release, delivery receipts, webhook processing |
| `migrations/0002_whatsapp_cloud.sql` | `donors.whatsapp_join_code`, `outbox.template_sent_at`, `outbox.delivery_status`, index on `outbox.provider_message_id` (additive only) |
| `tests/whatsapp-cloud.test.ts` | Signature verification, webhook parsing (text, buttons, statuses), window vs template, Graph calls with mocked fetch |
| `src/worker/messaging/{parse,extract,phone,copy,policy}.ts` | Pure, unit-tested parser, Workers AI merge rules, E.164 normaliser, en/hi/mr copy, limits |
| `migrations/0001_messaging.sql` | `outbox`, `conversations`, `inbound_messages`, `gateway_channels`; donor `contact_channel`, `contact_address`, `contact_opt_in_at` |
| `gateway/` | Standalone Node + TypeScript gateway (`tsx`), with its own `package.json` |
| `tests/messaging.test.ts` | Parser, phone normaliser, AI-merge safety rules, copy |

## Safety rules

1. **Opt-in only.** Alerts go only to donors with `contactChannel ≠ none` **and** `contactOptInAt` set **and** not opted out. The rule is checked when the message is queued and again when it is claimed for sending, so a STOP that arrives in between still wins. Messaging the bot doesn't count as consent; only the explicit **YES** at the end of JOIN, or the consent tick box on the web form, does.
2. **Synthetic donors are never messaged.** The seeded donors keep the `none` default. A drive that reaches 10 eligible donors sends exactly as many messages as there are opted-in real people among them.
3. **STOP always works**, from anyone, at any step: STOP, UNSUBSCRIBE, "band karo", "बंद", "थांबवा". It opts every donor profile on that number out, cancels pending messages and suppresses the address. Nothing more is sent to that number except the STOP confirmation, until the person sends START. Both STOP and START are audited.
4. **Rate limits.** At most 12 outbound messages per recipient per hour (alerts, replies and notices together, which also breaks bot-to-bot loops). At most 40 inbound messages per sender per hour, after which the bot stays silent. On top of this sit the donor's existing weekly cap and quiet hours from the drive targeting.
5. **Reply window.** The bot replies only within 24 h of the person's last message, mirroring WhatsApp's customer-service window. In WhatsApp groups it answers blood requests only, and it never starts a multi-step chat there.
6. **Never clinical advice.** Replies carry stock, distance, data freshness ("updated 11h ago, call to confirm") and a phone number to call. Every listing says that only a hospital can reserve and links to `/hospital`. A non-exact group is labelled "compatible group, doctor must confirm".
7. **The model never invents a blood group.** Need extraction runs the deterministic parser first, which requires an explicit + or −. Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`, JSON-only prompt, Zod-validated, 4 s timeout) fills gaps, but its blood group and component are accepted only for Devanagari text the regex can't read, and its place must match a real locality or hospital. If Workers AI is down, the bot falls back to the parser alone. Every reply echoes the bot's interpretation of the request.
8. **Webhooks are signed.** `POST /api/whatsapp/webhook` checks `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with `WA_APP_SECRET`, constant-time compare) and rejects mismatches with `401`. Without `WA_APP_SECRET` it accepts unsigned payloads only on `localhost`; anywhere else it answers `503`, because an unsigned webhook could forge YES or STOP for any number. The verify handshake compares `hub.verify_token` with `WA_VERIFY_TOKEN`.
9. **Privacy in logs.** The audit ledger and gateway logs carry masked addresses (`+91••••••2345`), intents and counts. They never contain message bodies or tokens. Errors are scrubbed of phone numbers before they are stored.

## Setup

### 0. Worker

```bash
# Secret shared by Worker and gateway (already generated for local dev in .dev.vars and gateway/.env)
openssl rand -hex 32
pnpm db:migrate:local
pnpm build && npx wrangler dev --port 8791     # wrangler dev serves the Vite build in dist/
```

### 1. Gateway

```bash
pnpm --dir gateway install
cp gateway/.env.example gateway/.env            # set BLOOD_BRIDGE_URL and GATEWAY_TOKEN
CHANNELS=console pnpm --dir gateway start       # no phone: type messages, see replies
```

In console mode, each line you type is an inbound message from `CONSOLE_FROM`. Prefix a line with `+919820012345: ` to send as someone else.

### 2. WhatsApp (open-wa)

1. Use a **spare** WhatsApp number on a phone you control. Don't use a personal or business number (see the warning below).
2. In `gateway/.env` set `CHANNELS=whatsapp` (or `whatsapp,sms`).
3. Run `pnpm --dir gateway start`. A QR code prints in the terminal. On the spare phone open **WhatsApp → Linked devices → Link a device** and scan it.
4. The session is saved in `gateway/.session/` (gitignored; treat it like a password), so later starts reconnect without scanning. The `/stage` header shows **WhatsApp online**.
5. Optional: add the number to a ward or family WhatsApp group. With `WA_GROUPS=on`, it answers blood requests posted there.

### 3. SMS (SMS Gateway for Android)

1. Install **SMS Gateway for Android** (open source, https://sms-gate.app, by capcom6) on an Android phone with a SIM.
2. Pick a mode:
   - **Cloud server:** enable it in the app and copy the username and password. Set `SMS_MODE=cloud`, `SMS_USERNAME` and `SMS_PASSWORD`.
   - **Local server:** enable it in the app; the phone and the gateway must share a LAN. Set `SMS_MODE=local`, `SMS_LOCAL_URL=http://<phone-ip>:8080` and the local credentials.
3. Inbound SMS reach the gateway as `sms:received` webhooks on `SMS_WEBHOOK_PORT` (default 3977, path `/sms/webhook`). In local mode set `SMS_WEBHOOK_PUBLIC_URL=http://<laptop-LAN-ip>:3977/sms/webhook`, and the gateway registers it on start. Cloud mode needs a publicly reachable URL for inbound only; outbound SMS works without one. Set `SMS_WEBHOOK_SIGNING_KEY` to the key from the app to reject unsigned webhooks.
4. Set `CHANNELS=sms` (or `whatsapp,sms`) and start the gateway.

## Get a free official Blood Bridge WhatsApp sender

About 20 minutes, no credit card. You end up with Meta's free **test number**, which can message up to 5 phones you verify. That's enough for the demo, and the same code works unchanged with a real number later.

You need a personal Facebook account, a phone with WhatsApp for each recipient, and `wrangler` logged in (`npx wrangler login`).

### 1. Create the app

1. Go to **https://developers.facebook.com** → **My Apps** → **Create app**. If asked, register as a developer first (it confirms your phone or email).
2. Give it a name such as *Blood Bridge*. When asked for a use case, choose **Other**, then app type **Business**. (Newer versions of the flow offer **"Connect with customers through WhatsApp"** directly; that works too.)
3. When asked for a business portfolio, create one called *Blood Bridge*. It's free, and verification is not needed for the test number.
4. On the app dashboard, find **WhatsApp** in the product list → **Set up**. Meta creates a WhatsApp Business Account and a **test phone number** for you.

### 2. The test number and your 5 recipients

1. Open **WhatsApp → API Setup** in the left menu.
2. The **From** field shows the test number. Note it; it becomes `WA_DISPLAY_NUMBER` (e.g. `+1 555 123 4567`).
3. Under **To**, choose **Manage phone number list** → **Add phone number**. Enter a recipient's WhatsApp number. They receive a WhatsApp message with a code; enter it in the dialog. Repeat for up to **5** numbers (yours, teammates', the judges' phones).
4. Click **Send message**. The `hello_world` template should arrive on the verified phone. If it doesn't, the number isn't verified yet.

### 3. Name and picture

- A test number's **display name is fixed by Meta** (it shows as a test account). The name "Blood Bridge" needs a real number with an approved display name (step 8).
- You can still set the **profile picture, About text and description**: open **WhatsApp Manager** (business.facebook.com → WhatsApp accounts → *your account* → WhatsApp Manager) → **Phone numbers** → the test number → **Profile**. Use the Blood Bridge logo (`public/` has the brand mark) and *About: Blood stock and donor alerts for Mumbai. Reply STOP to opt out.*

### 4. Copy the Phone Number ID

On **WhatsApp → API Setup**, copy **Phone number ID**. This is a long number, not the phone number itself; it becomes `WA_PHONE_NUMBER_ID`. (The *WhatsApp Business Account ID* next to it isn't needed.)

### 5. Access token: temporary vs permanent

- **Temporary token.** The **Generate access token** button on API Setup gives a token that **expires after 24 hours**. Fine for a first test, but alerts stop working the next day with error `190`.
- **Permanent token (use this for the demo).**
  1. Go to **https://business.facebook.com** → **Settings** (Business settings) → **Users → System users** → **Add**. Name it `blood-bridge-worker`, role **Admin**.
  2. **Assign assets**: add the **app** (full control) and the **WhatsApp account** (full control).
  3. **Generate new token** → pick the Blood Bridge app → expiry **Never** → permissions **`whatsapp_business_messaging`** and **`whatsapp_business_management`** → **Generate**. Copy it now; Meta shows it only once. This becomes `WA_ACCESS_TOKEN`.

### 6. App Secret

App dashboard → **App settings → Basic** → **App secret** → **Show** (it asks for your password). This becomes `WA_APP_SECRET`. The Worker uses it to check that webhooks really come from Meta.

### 7. Set the Worker config, deploy, then connect the webhook

Secrets (each command prompts for the value; nothing lands in git):

```bash
npx wrangler secret put WA_ACCESS_TOKEN    # permanent System User token from step 5
npx wrangler secret put WA_APP_SECRET      # App secret from step 6
npx wrangler secret put WA_VERIFY_TOKEN    # any long random string, e.g. the output of: openssl rand -hex 24
```

Vars go in `wrangler.jsonc` (vars set in the dashboard are overwritten by the next deploy):

```jsonc
"vars": {
  "CITY": "Mumbai",
  "WA_PHONE_NUMBER_ID": "123456789012345",   // step 4
  "WA_DISPLAY_NUMBER": "+1 555 123 4567",    // the test number from step 2
  "WA_TEMPLATE_ALERT": "hello_world",        // or "your_template:en" once you have one approved
  "WA_PROVIDER": "cloud"                     // "gateway" = keep using the laptop open-wa sender
}
```

Then:

```bash
npx wrangler types src/worker/worker-configuration.d.ts   # refresh Env types
pnpm db:migrate:remote                                     # applies 0002_whatsapp_cloud.sql
pnpm run deploy
```

Now connect Meta to the Worker. The Worker must already be deployed with `WA_VERIFY_TOKEN`, because Meta calls it while you save:

1. App dashboard → **WhatsApp → Configuration** → **Webhook** → **Edit**.
2. **Callback URL:** `https://blood-bridge.blood-bridge.workers.dev/api/whatsapp/webhook`
3. **Verify token:** the same string you gave `WA_VERIFY_TOKEN`. Click **Verify and save**. Meta sends `GET …?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` and the Worker echoes the challenge.
4. Under **Webhook fields** → **Manage**, **Subscribe** to **`messages`**. This one field carries both inbound messages and delivery statuses.

Check it works:

```bash
curl -s https://blood-bridge.blood-bridge.workers.dev/api/messaging/contact   # shows the number + wa.me link
curl -s https://blood-bridge.blood-bridge.workers.dev/api/messaging/status    # whatsappProvider: "cloud"
```

From a verified phone, WhatsApp the test number `HELP`. The menu should come back within a couple of seconds, and `/stage` shows **WhatsApp online (official Cloud API)**. If nothing arrives, run `npx wrangler tail` and look for `graph 190` (token), `graph 131030` (recipient not in the 5-number list) or `bad_signature` (wrong App secret).

Local development: `.dev.vars` already has a random `WA_VERIFY_TOKEN`. Add `WA_PHONE_NUMBER_ID` and `WA_ACCESS_TOKEN` there to send from `pnpm dev`. Meta can't reach `localhost`, but you can POST a webhook body to `http://localhost:5173/api/whatsapp/webhook` with curl; unsigned bodies are accepted on localhost only when `WA_APP_SECRET` is unset.

### 8. Limits, and when to move to a real number

- **5 recipients.** The test number only delivers to the up-to-5 numbers verified in step 2. Anyone else gets nothing (`131030`). A judge whose phone isn't on the list can still use the web app; add their number in a minute if needed.
- **Templates for business-initiated messages.** A donor alert to someone who hasn't messaged Blood Bridge in 24 h can only go out as an approved template. The default `hello_world` is generic, so Blood Bridge sends it first and delivers the real alert as soon as the donor replies. Click-to-chat signup avoids this for new donors: they message first, so their first alerts arrive as normal text. For a better cold alert, create your own template in **WhatsApp Manager → Message templates** (category **Utility**, no variables, e.g. *"Blood Bridge: a blood bank near you needs donors of your blood group. Reply to this message to see the details, or STOP to opt out."* with a quick-reply button **Show details**). Once approved, set `WA_TEMPLATE_ALERT` to `name:language`.
- **Cost.** Test-number messages are free. On a real number, replies inside the 24 h window are free, and Meta charges per delivered template message (by category and country).
- **Moving to a real number** (when 5 recipients isn't enough, or you want the "Blood Bridge" name to show): in WhatsApp Manager → **Phone numbers** → **Add phone number**. Use a number that isn't already registered on the WhatsApp app (or delete that WhatsApp account first), verify it by SMS or voice, and submit the display name **Blood Bridge** for review. Add a payment method, and complete **Business verification** in Business settings to raise the messaging limits. Then update `WA_PHONE_NUMBER_ID` and `WA_DISPLAY_NUMBER` and redeploy. The token, App secret and webhook stay the same. If a new number gets no webhooks, subscribe the app to the WhatsApp Business Account once: `curl -X POST "https://graph.facebook.com/v26.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer $WA_ACCESS_TOKEN"`.

## Judge demo script (3 minutes)

Before you start, run `/api/demo/reset` (the **Reset demo** button on `/stage`) and make sure `/stage` shows **WhatsApp online**: "(official Cloud API)" with the business sender, or the gateway with open-wa. With no phone at all, use `CHANNELS=console`. With the Cloud API test number, the judges' phones must be among the 5 verified recipients. A judge who scans the stage QR and ticks WhatsApp taps **Open WhatsApp: say hi to Blood Bridge**, which links the number in one message instead of step 2's chat.

1. **The ask (30 s).** From any phone, WhatsApp the bot: *"Sion mein 2 O negative platelets chahiye"*. Within seconds it lists the top 3 banks with units, ETA, "updated 14h ago, call to confirm" and phone numbers, plus the line *"Only a hospital can reserve"*. Point out that the bot understood Hinglish and that it gives no clinical advice.
2. **The donor joins (45 s).** A judge sends **JOIN**, then answers *O-*, *Mahim*, *2* (Hindi) and **YES**. The ledger on `/ledger` shows "joined via WhatsApp (explicit YES)" with a masked number.
3. **The drive (45 s).** On `/stage`, the blood bank view sends an O− donor drive to S. L. Raheja (Mahim), or run `POST /api/drives`. The judge's phone gets the alert in Hindi with *"Reply YES if you can come…"*. The ten synthetic donors who were also alerted get nothing, because they never opted in.
4. **YES (30 s).** The judge replies **YES** and gets back the bank address, a 90-minute arrival window and a 6-digit code. The bank view's incoming-donors list updates live.
5. **STOP (15 s).** The judge sends **STOP** and gets the confirmation. Further messages from that number get no reply, and START brings it back.

## open-wa is unofficial

open-wa automates WhatsApp Web. **It is not an official WhatsApp API, and using it is against WhatsApp's Terms of Service.** Numbers used this way can be banned without warning. Use a **spare number** for demos only, never a personal or hospital number. The **official WhatsApp Business Cloud API** is built in (see [above](#get-a-free-official-blood-bridge-whatsapp-sender)) and is the path for anything beyond a throwaway demo. The outbox, bot, safety rules and audit trail are the same for both.

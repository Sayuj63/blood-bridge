# WhatsApp & SMS channels

**The scramble happens on WhatsApp, so Blood Bridge answers there.** Families and ward staff already post "need 2 O− platelets near Sion" in WhatsApp groups, and donors live on WhatsApp and SMS. Blood Bridge meets them in that channel: anyone can ask for blood and get the nearest compatible stock back, donors can sign up and answer alerts with a one-word reply, and STOP always works.

## Architecture

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
- **Pluggable adapters.** `gateway/src/adapters/types.ts` defines `ChannelAdapter` (`start`, `send`, `stop`, `state`). A production **WhatsApp Business Cloud API** adapter is another class behind the same interface, and the Worker side doesn't change.

### Files

| Where | What |
|---|---|
| `src/worker/services/messaging.ts` | Outbox: enqueue (safety checks), claim (lease), ack (retry / SMS fallback), heartbeat, status, drive and signup hooks |
| `src/worker/services/messaging-bot.ts` | Inbound bot: STOP/START, JOIN flow, YES/NO to alerts, need lookup, HELP |
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
8. **Privacy in logs.** The audit ledger and gateway logs carry masked addresses (`+91••••••2345`), intents and counts. They never contain message bodies or tokens. Errors are scrubbed of phone numbers before they are stored.

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

## Judge demo script (3 minutes)

Before you start, run `/api/demo/reset` (the **Reset demo** button on `/stage`) and make sure the gateway shows **WhatsApp online** on `/stage`. With no spare phone, use `CHANNELS=console`.

1. **The ask (30 s).** From any phone, WhatsApp the bot: *"Sion mein 2 O negative platelets chahiye"*. Within seconds it lists the top 3 banks with units, ETA, "updated 14h ago, call to confirm" and phone numbers, plus the line *"Only a hospital can reserve"*. Point out that the bot understood Hinglish and that it gives no clinical advice.
2. **The donor joins (45 s).** A judge sends **JOIN**, then answers *O-*, *Mahim*, *2* (Hindi) and **YES**. The ledger on `/ledger` shows "joined via WhatsApp (explicit YES)" with a masked number.
3. **The drive (45 s).** On `/stage`, the blood bank view sends an O− donor drive to S. L. Raheja (Mahim), or run `POST /api/drives`. The judge's phone gets the alert in Hindi with *"Reply YES if you can come…"*. The ten synthetic donors who were also alerted get nothing, because they never opted in.
4. **YES (30 s).** The judge replies **YES** and gets back the bank address, a 90-minute arrival window and a 6-digit code. The bank view's incoming-donors list updates live.
5. **STOP (15 s).** The judge sends **STOP** and gets the confirmation. Further messages from that number get no reply, and START brings it back.

## open-wa is unofficial

open-wa automates WhatsApp Web. **It is not an official WhatsApp API, and using it is against WhatsApp's Terms of Service.** Numbers used this way can be banned without warning. Use a **spare number** for demos only, never a personal or hospital number. A production deployment would use the **official WhatsApp Business Cloud API** (approved message templates for alerts, free-form replies inside the 24 h window) as another `ChannelAdapter`. The outbox, bot, safety rules and audit trail stay exactly as they are.

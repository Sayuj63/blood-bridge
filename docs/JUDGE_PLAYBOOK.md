# Blood Bridge — Judge Playbook

All stats referenced here come from `docs/PROBLEM_RESEARCH.md`, and the [n] keys refer to its reference list. Never say an UNVERIFIED figure out loud.

---

## 1. What wins hackathon judging

Published rubrics differ, but they converge on four or five criteria:

| Rubric (public) | Weights |
|---|---|
| Builder's-guide scorecard (BuilderBase) | Innovation 25, Technical execution 25, Impact 20, Presentation 15, (Design) |
| Unstop recommended scorecard | Problem understanding 15, Technical execution 25, Feasibility 15, Solution quality 10, Innovation 10, Business/user impact 10, Communication 15 |
| Notre Dame Hesburgh Hackathon | Impact 30% (fit to theme) |
| Global Travel Hackathon | Technical 40, Idea 30, Design 20, Wow factor 10 |
| Harvard HSIL 2027 | 10 criteria × 0–2 pts; **3-minute pitch + 5 min Q&A** |

Sources: intercom.help/builderbase (Hackathon Playbook ch.15), unstop.com/blog/hackathon-judging-criteria-for-hiring, libguides.library.nd.edu/hesburgh-hackathon/judging, github.com/Global-Travel-Hackathon/Evaluation-Criteria, hsph.harvard.edu HSIL 2027 rubric PDF (only the cover page was readable, which gave the format).

**What this means for us:**
1. **Problem clarity wins the first 30 seconds.** Judges score "problem understanding" before they've seen any code. Open with one Mumbai story and one number.
2. **A working live demo beats slides.** Technical execution is the largest single weight on most rubrics, and judges discount anything they don't see run. Keep a recorded backup and a seeded offline mode.
3. **Make the impact measurable on screen.** Show a number that moves, such as units saved from expiry, minutes to reserve, or lives at risk in surge mode. Don't just claim it.
4. **Show feasibility and adoption.** Name the buyer (hospital networks, SBTC/NBTC) and the integration path (sit on top of e-RaktKosh, don't replace it). Judges punish "we'll replace the government system."
5. **Fit the theme.** The theme is "Doomsday", so surge mode has to be central to the pitch, not a footnote.
6. **One wow moment.** It should be memorable and physical, like a judge's own phone buzzing.

---

## 2. The live demo flow (about 5 minutes)

**Screens:** `/stage` on the big screen (hospital, bank and donor phone side by side, plus a join QR); `/command` and `/ledger` in tabs behind it.
**People:** one person clicks, one talks. Rehearse it twice end to end.

### Before the judges arrive (10 minutes)
1. Open https://blood-bridge.blood-bridge.workers.dev/stage and click **Reset demo** (it asks to confirm). Never reset mid-pitch: the data is shared.
2. Open `/command` and `/ledger` in two more tabs.
3. If you'll show WhatsApp, start the laptop gateway (`cd gateway && npm start`) and check the stage header shows it connected. It also relays e-RaktKosh syncs, which Cloudflare's network can't reach directly.
4. Have a screen recording of this whole flow ready as a backup if the venue Wi-Fi drops.

### Beat 1: The problem (30 s), landing page `/`
Scroll the hero, then the scramble replay and the city map animation.
> "Imagine 2 a.m. in Mumbai: a mother is haemorrhaging after delivery. Haemorrhage causes 47% of maternal deaths in India [22]. Her husband is forwarding 'B-negative needed urgently, KEM' to 40 WhatsApp groups. Four kilometres away, two units sit in another bank, and one expires on Friday. India runs about a million units short a year [2], yet discarded 28 lakh units in five years, mostly to expiry [7][10]."

Click **Start the live demo**.

### Beat 2: One patient, end to end (90 s), stage
1. **Hospital panel:** pick O+, Red cells, Critical → **Find blood**. Every compatible, in-date unit in the city appears, ranked by distance and expiry. Click **Reserve**.
2. **Bank panel:** the request lands live with a 90-second countdown. *Say:* "If the bank doesn't answer, it reroutes itself." Click **Confirm**. (The bank panel follows whichever bank the request went to.)
3. **Hospital panel:** the tracker updates by itself. Click **Mark picked up**, then **Mark delivered** → "Fulfilled".
4. *Optional, if time:* reserve again and press **Decline** with a quick reason. The hospital is rerouted to the next-best bank and told why.

### Beat 3: The donor, the wow moment (60 s), stage
1. Ask a judge to **scan the QR** on the stage. They join in 20 seconds on their own phone (three steps, consent switches explained).
2. Bank panel → **Donor drive** → **Preview** (shows who's excluded and why: ineligible, out of range, quiet hours, weekly cap) → **Send**.
3. The alert pops up full-screen on the phone frame, and on the judge's phone if their group matches.
4. Tap **I can come** → a code and arrival window. In the bank, under **Incoming donors**, click **Mark donation complete** → the phone shows "Thank you, eligible again on …", and any other open alerts for that donor are withdrawn.
> "The bank sees the donor's name and number only after they say yes."

### Beat 4: Doomsday (90 s), `/command`
1. Click **Mass casualty · Dadar**. Use this one: it's the dramatic scenario.
2. **Impact strip** (top): normal day → now. Unmet demand over 72 hours jumps from about 32 to about 1,800 units, and 13 stock lines run out inside 24 hours.
3. **Map:** the red surge zone and transfer routes. **Outlook** (left): which groups run dry first.
4. **Situation brief** (right): the AI summary. If it shows "Template (AI unavailable)", own it: "we label it honestly."
5. **Approve** two transfers: "N moving" goes up, and "Averted since the surge began" and the outcome meter move.
6. **End surge** (it asks to confirm).
> "Every unit we move before it expires is a unit nobody has to beg for. Platelets last five days [11]."

### Beat 5: Trust (30 s), `/ledger`
**Verify** (chain intact) → **Tamper** → **Verify** again: it names the exact broken entry.
> "Nobody can quietly hoard or sell a unit."

### Beat 6: Close (30 s)
> "Real banks and real stock from e-RaktKosh and data.gov.in; simulated patients and donors. Alerts reach WhatsApp. There's an MCP server, so a coordinator can run this drill from ChatGPT or Claude. We don't replace e-RaktKosh, we add holds, transfers and surge planning on top. It's open source and runs on free tiers: zero cost. We're asking for a 90-day pilot with SBTC Mumbai and one hospital network, 10 banks, measuring discards avoided and minutes to reserve."

If time allows, type "run a doomsday drill in Dadar" into Claude with the MCP connected, and show it preview the surge before confirming.

### If something goes wrong
| Problem | Do this |
|---|---|
| The request went to a different bank | Nothing: the stage bank panel follows it automatically. |
| The judge's phone gets no alert | Their group or area may not match. Show the phone frame instead; it always receives the drive. |
| AI brief says "Template" | Keep going; the numbers are the same forecast. |
| WhatsApp gateway offline | Skip it; web alerts carry the demo. |
| Wi-Fi drops | Switch to the recording. |
| A surge is already running | Click End surge, then start Mass casualty. |

---

## 3. Three-minute version (if the slot is short)
Beat 1 (20 s) → Beat 2 steps 1–3 (50 s) → Beat 3 with the judge's phone (40 s) → Beat 4 steps 1, 2, 5 (50 s) → Beat 6 (20 s). Skip the ledger and mention it in Q&A.

---

## 4. Tech stack

Everything is open source and runs on free tiers.

| Layer | What we use | Why |
|---|---|---|
| Hosting | **Cloudflare Workers**: one Worker serves the web app, the API (`/api`) and the MCP server (`/mcp`); a cron trigger runs syncs and sweeps | Free, global, one deploy |
| Realtime and coordination | **Cloudflare Durable Object** (`CityHub`): WebSocket fan-out to every screen, a serialised hash-chained audit ledger, the auto-reroute and hold-release timer, and a read cache | Live updates across hospital, bank and donor screens, and a tamper-evident log |
| Database | **Turso** (libSQL/SQLite, AWS Mumbai) with Cloudflare D1 as fallback, via **Drizzle ORM**; SQL migrations | Free tier without D1's daily read cap |
| API | **Hono** (TypeScript), **Zod** validation shared by client and server | Small, fast, typed end to end |
| AI | **Cloudflare Workers AI**: Llama 3.1 8B for the surge brief and WhatsApp message understanding, M2M100 for Hindi and Marathi alerts; template fallback when unavailable | Open models, free allocation |
| AI assistants | **Model Context Protocol** server (`@modelcontextprotocol/sdk`, `@hono/mcp`): read and write tools, works in ChatGPT and Claude | A coordinator can run the system by chat |
| Frontend | **React 19**, **Vite 8**, **React Router 7**, **TanStack Query**, **Tailwind CSS v4**, **Motion** (animations), **Sonner** (notifications), **Lucide** icons, **Recharts** | Modern, fast, accessible |
| Maps | **MapLibre GL** with **OpenFreeMap** vector tiles (OpenStreetMap data), **deck.gl** transfer arcs, **Natural Earth** + d3-geo for the landing world map | Fully open, no API keys |
| Scanning and labels | **ZXing** (camera barcode scan), **qrcode** (unit labels and the join QR) | Works in the browser |
| Messaging | **open-wa** (WhatsApp Web automation) on a small Node gateway, with a privacy filter; WhatsApp Cloud API supported | Free alerts on a real number |
| Data | **data.gov.in** blood bank directory (GODL-India), **OpenStreetMap** coordinates (ODbL), **e-RaktKosh** public stock (synced every 30 minutes through the gateway relay), **RAKT** API connector | Real banks, real stock |
| Quality | **TypeScript** strict, **Vitest** (135 tests on compatibility, ranking, forecast, transfers, splits, eligibility), Playwright UI walk-through | |

Full details: `README.md`, `docs/API.md`, `docs/MCP.md`, `docs/MESSAGING.md`, `docs/DATA_SOURCES.md`.

---

## 5. What judges score, and where we hit it
| Criterion | Where it shows |
|---|---|
| Problem understanding | Beat 1: one story, two verified numbers |
| Technical execution | Beats 2–5 run live across three screens in real time |
| Impact you can see | Impact strip, averted counter, "saved from expiry" |
| Feasibility and adoption | Sits on top of e-RaktKosh; RAKT connector; zero running cost |
| Theme ("Doomsday") | Beat 4: surge mode is the centre of the pitch |
| Wow factor | Beat 3: the judge's own phone gets the alert |

---

## 6. Likely judge questions (crisp answers)

**Q: Privacy — you're holding donor health data. What about the DPDP Act 2023?**
A: Donors opt in explicitly and for a stated purpose, alerts only. We store blood group, an area-level location (not an address) and contact details, nothing else. Location, eligibility sharing and alerts are separate switches, and "Opt out of everything" withdraws all of them and any pending alert in one tap. Patients are referenced by hospital request ID, not name. The database runs in AWS Mumbai (ap-south-1), and the hash-chained ledger records every action and who took it.

**Q: Clinical liability — what if you show a unit that turns out to be wrong?**
A: We're a coordination layer, not a clinical decision-maker. A hold is a reservation request. Cross-match and issue still happen at the blood bank under its licence and SOPs. We never override the blood centre's final check.

**Q: Data freshness — e-RaktKosh is often stale. Why would yours be better?**
A: Three things. Every listing carries a freshness badge and stale banks are ranked lower. Reserving a unit forces a real-time confirm from the bank. And transfers and holds create updates as a side effect, so banks update because it's how they get requests, not as extra paperwork.

**Q: Why would blood banks bother updating?**
A: Updating is how they get value. They get transfer offers that prevent their own expiry losses, and every discarded unit is a sunk processing cost. Also, the 2007 National Blood Policy already makes hospitals responsible for arranging blood [12], so we make it easier to meet a duty they already have.

**Q: How is this different from e-RaktKosh?**
A: e-RaktKosh is a directory and stock register: it shows availability. We add the actions: one-tap holds with timers, bank-to-bank transfers driven by expiry, surge forecasting, and consented donor alerts. We already read e-RaktKosh's public stock and reconcile it into our inventory; we also ship a RAKT connector, and eBloodConnect is waiting on partner access.

**Q: Business model?**
A: Hospital networks pay a per-bed SaaS fee, justified by discards avoided and staff hours saved. State Blood Transfusion Councils license the surge and disaster-readiness dashboard. Donors and patients always use it for free. We never charge for blood.

**Q: Scaling beyond Mumbai?**
A: The data model is city-agnostic: banks, units, components, expiry and geohash. Onboarding a city means importing its blood-bank list and connecting to e-RaktKosh. We'd start with the 58 Mumbai banks [5], then the 410 across Maharashtra.

**Q: Isn't the surge forecast just made up?**
A: It's a transparent model: current stock, minus a demand curve per casualty type, plus incoming donations. The multipliers (2× to 3× demand, 5× for O-negative red cells in a mass-casualty event) come from the mass-casualty literature and are in the open in the code. It's for planning, not prophecy. Its value is spotting which group runs out first, hours ahead.

**Q: What stops hoarding or misuse of holds?**
A: Holds expire automatically after 45 minutes and the units go back to stock, unconfirmed requests reroute after 90 seconds, and every action is in the hash-chained ledger.

**Q: What did you actually build in the hackathon versus mock?**
A: Be honest. **Real:** the 31 Mumbai sites (data.gov.in + OpenStreetMap) and their stock, synced from e-RaktKosh. **Live and working:** reserve → confirm → pickup → delivery, auto-reroute, split reservations, surge forecast, transfer engine, donor alerts (web + WhatsApp), ledger, MCP server. **Simulated:** patients, donors and the surge itself, and every screen says so.

**Q: What does it cost to run?**
A: ₹0 today. Cloudflare Workers free tier, Turso free tier, Workers AI free allocation, OpenFreeMap tiles, and a self-hosted WhatsApp link. Everything is open source.

**Q: Why does the flood look milder than mass casualty?**
A: Because Mumbai's banks hold about three days of stock and flood demand is 2× to 3×, so the city bends before it breaks. A mass-casualty event is 3× to 5× in a tight radius, which is where coordination saves lives within hours. We didn't inflate the numbers to make the demo louder.

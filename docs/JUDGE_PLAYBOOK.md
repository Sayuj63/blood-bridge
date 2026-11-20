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

## 2. Three-minute pitch script

**0:00–0:25 — Problem (one story, one number)** *(the story is an illustrative composite; say "imagine", not "last night")*
> "Imagine 2 a.m. in Mumbai: a mother is haemorrhaging after delivery. Haemorrhage causes 47% of maternal deaths in India [22]. Her husband is forwarding a WhatsApp message to 40 groups: 'B-negative needed urgently, KEM.' Four kilometres away, two B-negative units are sitting in another blood bank, and one of them expires on Friday."

**0:25–0:50 — Stakes (paradox + scale)**
> "India runs about a million units short every year [2], yet it threw away 28 lakh units in five years, mostly to expiry [7][10]. Mumbai has 58 blood banks [5] and no shared way to hold a unit. And the national policy says families shouldn't be doing this hunt at all. Hospitals are supposed to arrange the blood [12][13]."

**0:50–2:10 — Live demo (five beats, about 15 seconds each)**
1. **Request → reserve in 60 seconds.** A clinician picks the patient's group and component. One screen shows compatible, in-date units across nearby banks, ranked by distance and expiry. One tap holds the unit and a timer starts. *Say:* "That was 41 seconds. Compare that to the WhatsApp scramble you just saw." (Do not quote a specific 'hours' figure; none is verified.)
2. **Doomsday surge mode.** Flip the "26 July flood" switch. Roads close, two banks go offline, and casualties are injected. The forecast shows which groups run out first (O-negative in N hours) and a "lives at risk" meter climbs.
3. **Expiry-aware transfer changes the outcome.** The system proposes moving 12 near-expiry platelet units from Bank A, where they'd expire unused, to Bank C, which is in the surge zone. Approve it, and the outcome meter drops and "units saved from expiry" ticks up.
4. **Donor alert on a real phone.** The system sends a targeted alert to consented O-negative donors within 5 km. A phone on stage buzzes. Ideally it's a judge's phone (see Wow #1).
5. **Tamper-evident ledger.** Open the audit view: every reserve, transfer and release is hash-chained, so editing one row breaks the chain visibly. *Say:* "Nobody can quietly hoard or sell a unit."

**2:10–2:35 — Impact**
> "Every unit we move before it expires is a unit nobody has to beg for. Platelets last five days [11]. At one Chennai hospital, 97% of discards were simply expired [10]. Blood Bridge turns expiry dates into transfer orders."

**2:35–2:50 — Adoption path and who pays**
> "We don't replace e-RaktKosh. We read its stock and add what it doesn't have: holds, transfers and surge forecasting. Hospital networks pay per bed per month, because one prevented discard covers the subscription. State Blood Transfusion Councils license the surge dashboard for disaster preparedness. Donors always use it for free."

**2:50–3:00 — Ask**
> "We're asking for a pilot introduction to SBTC Mumbai and one hospital network, with 10 blood banks for 90 days, to measure discards avoided and minutes to reserve."

---

## 3. "Crazy but buildable" demo ideas (ranked)

| # | Idea | What the judge sees | Why it lands | Effort |
|---|---|---|---|---|
| **1 ★** | **Judge becomes the donor** | A QR code on screen. The judge scans it, consents in two taps, and picks a blood group. During surge mode their own phone buzzes with "O-neg needed at KEM, 3.2 km, can you come?" | It's physical and personal, and it proves the alert pipeline works for real. Judges remember their own phone. | M (web push or SMS via Twilio/WhatsApp sandbox) |
| **2 ★** | **Scramble replay split-screen** | Left side: a fake WhatsApp chat replaying a real-style night, with forwards, wrong numbers and "already arranged" messages, and a clock racing to hours. Right side: Blood Bridge reserving the same unit in 41 s. | It makes the problem visceral before any feature is shown, and it's the strongest problem-first opening. | S (scripted animation, two timers) |
| **3 ★** | **Surge mode "lives at risk" meter + transfer counterfactual** | Flip on "26/7 flood". The map dims banks, depletion curves fall by group, and a red counter climbs. Approve the transfers and the counter falls. A banner reads "Without Blood Bridge tonight: 18 units expire, 7 requests unmet." | It ties straight to the theme, and one click visibly changes the outcome, which is measurable impact. | M |
| 4 | **Bombay blood needle-in-a-haystack** | Request "Bombay phenotype (hh)". The city map lights up thousands of O donors, then they all fade except two consented donors. Callout: "discovered in Mumbai, 1952, 1 in 10,000" [20]. | It's a local pride hook and shows why matching beyond ABO matters. | S |
| 5 | **Expiry heatmap "money burning" view** | A grid of every unit in the city coloured by hours to expiry, with a running counter of the ₹ and units about to be wasted. Clicking "rebalance" turns the reds green. | It makes the waste paradox visible at a glance. | S |
| 6 | **Multilingual alert** | The same donor alert renders in Marathi, Hindi and English. The judge toggles the language on their phone. | It shows we know the city, and it's inclusive. | S (static templates; no live MT needed) |
| 7 | **Voice/SMS fallback when the network is down** | In surge mode, "mobile data down" is toggled. The alert falls back to a plain SMS, or a pre-recorded IVR call plays on speaker. | Doomsday realism: the system degrades gracefully. | M (Twilio voice/SMS) |
| 8 | **Stale data detector** | Each bank shows a "last updated 14 h ago" badge. Stale banks are down-ranked and auto-pinged for a one-tap stock confirm. | It answers the data-freshness question visually, before a judge asks it. | S |
| 9 | **Tamper-break ledger** | The presenter edits a reservation row in the DB live. The ledger view turns red at that block and everything after it. | It makes hoarding and fraud prevention concrete in ten seconds. | S (SHA-256 chain) |
| 10 | **Thalassemia calendar** | A recurring-patient view shows "Aarav, 9, transfusion due every 21 days". The system pre-reserves compatible units three days ahead, so there's no monthly scramble. | It's a human face for chronic demand. Sion's thalassemia need alone exceeded its camp collection [6]. | S |
| 11 | **Ambulance ETA vs unit ETA race** | Two progress bars: the patient arriving at the hospital, and the reserved unit being couriered from a bank. Blood Bridge picks the bank that wins the race, not the nearest one. | It makes "golden hour" logistics tangible. | M |
| 12 | **Balasore "generosity overflow" mode** | Simulated donor walk-ins flood one bank. The system redirects donors to banks that actually need their group, and shows surplus units that should be redistributed. | It shows that disasters bring too much blood in the wrong place, not only too little (use the verified 500-units-overnight figure only [17]). | M |

**Recommended top 3: #1 (judge becomes donor), #2 (scramble replay), #3 (surge meter + counterfactual).** Open with #2, run #3 mid-demo, and close the demo with #1.

---

## 4. Likely judge questions (crisp answers)

**Q: Privacy — you're holding donor health data. What about the DPDP Act 2023?**
A: Donors opt in explicitly and for a stated purpose, alerts only. We store blood group, an approximate location (a geohash, not an address) and contact details, nothing else. Donors can withdraw consent in one tap, and we delete their data. Patients are referenced by hospital request ID, not name. Data stays in India. The audit log records who accessed what.

**Q: Clinical liability — what if you show a unit that turns out to be wrong?**
A: We're a coordination layer, not a clinical decision-maker. A hold is a reservation request. Cross-match and issue still happen at the blood bank under its licence and SOPs. We never override the blood centre's final check.

**Q: Data freshness — e-RaktKosh is often stale. Why would yours be better?**
A: Three things. Every listing carries a freshness badge and stale banks are ranked lower. Reserving a unit forces a real-time confirm from the bank. And transfers and holds create updates as a side effect, so banks update because it's how they get requests, not as extra paperwork.

**Q: Why would blood banks bother updating?**
A: Updating is how they get value. They get transfer offers that prevent their own expiry losses, and every discarded unit is a sunk processing cost. Also, the 2007 National Blood Policy already makes hospitals responsible for arranging blood [12], so we make it easier to meet a duty they already have.

**Q: How is this different from e-RaktKosh?**
A: e-RaktKosh is a directory and stock register: it shows availability. We add the actions: one-tap holds with timers, bank-to-bank transfers driven by expiry, surge forecasting, and consented donor alerts. We plan to read e-RaktKosh data rather than compete with it.

**Q: Business model?**
A: Hospital networks pay a per-bed SaaS fee, justified by discards avoided and staff hours saved. State Blood Transfusion Councils license the surge and disaster-readiness dashboard. Donors and patients always use it for free. We never charge for blood.

**Q: Scaling beyond Mumbai?**
A: The data model is city-agnostic: banks, units, components, expiry and geohash. Onboarding a city means importing its blood-bank list and connecting to e-RaktKosh. We'd start with the 58 Mumbai banks [5], then the 410 across Maharashtra.

**Q: Isn't the surge forecast just made up?**
A: It's a transparent model: current stock, minus a demand curve per casualty type, plus incoming donations. Every parameter is shown and editable. It's for planning, not prophecy. Its value is spotting which group runs out first, hours ahead.

**Q: What stops hoarding or misuse of holds?**
A: Holds expire automatically, every action is in the hash-chained ledger, and we report per-hospital hold-to-use ratios.

**Q: What did you actually build in the hackathon versus mock?**
A: Be honest. Name what's live (reserve flow, surge sim, transfer engine, alerts, ledger) and what's seeded (bank inventory is synthetic, modelled on real Mumbai bank locations).

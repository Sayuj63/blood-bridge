# UI QA report: every page, tested as a user (21 Nov 2026)

Method: Playwright driving a real browser against a local copy, with hospital, bank and donor open in separate
tabs so live updates and notifications are tested across screens. All flows were clicked through the UI, not
called through the API.

**Verdict:** every feature works end to end. What feels like "nothing happening", especially in surge mode, is
**weak feedback and weak drama**, not broken buttons. Fix the P0 items before the demo.

---

## What works (verified)

| Area | Flow tested | Result |
|---|---|---|
| Hospital | Pick group/component/urgency → Find blood → ranked results + map → Reserve | Works |
| Hospital ↔ Bank | Bank sees request live with countdown → Confirm → hospital tracker updates live (timestamps) → Picked up → Delivered → "Fulfilled" | Works, live across tabs |
| Hospital | Split reservation (12 units) → "All 12 units held across 3 banks" | Works |
| Hospital | Critical — alert everyone (tracker button) → 38 donors alerted, all banks notified | Works |
| Bank | Decline with quick reason → hospital auto-rerouted to next bank, explained on tracker | Works |
| Bank | Partial confirm (1 of 2) | Works (seen in ledger) |
| Bank | Add units, Mark used, Remove, Label (QR), Camera dialog, Scan box finds unit | Works |
| Bank | Connected systems card, Activity feed with ledger numbers | Works |
| Bank | Transfers: Approve, Mark received | Works |
| Bank | Donor drive: Preview funnel (excluded by reason) → Send to 10 donors | Works |
| Donor | Full-screen alert arrives live → I can come → code + arrival window | Works |
| Bank ↔ Donor | Incoming donors shows name, phone, code → Mark donation complete → donor phone shows "Donation complete, eligible again 19 Feb 2027" live | Works |
| Donor | Certificate, calendar reminder, 4 consent switches, Opt out (with confirm) → Opt back in, Quick join (3 steps) | Works |
| Command | Flood / Mass casualty start, banner, AI brief, outlook tabs, Approve (averted 0 → 6), Modify qty, Dismiss, Request donors dialog → Send, End surge | Works |
| Ledger | Verify (chain intact) → Tamper → Verify (broken at #2) | Works |
| Stage | 3 panels, Hide QR, Reset demo | Works |
| Landing | Info / Contact scroll, Book now → donor join, Gallery → stage | Works |

---

## Findings to fix (priority order)

### P0: hurts the live demo

1. **Surge has little visible drama.** Flood: earliest stock-out is 1d 7h, so "unmet in next 24h" goes 1 → 0 and
   approving the plan averts 1 unit. Real banks hold ~3 days of stock and flood multipliers are 2–3×, so no one
   runs out within a day. Mass casualty is dramatic (68 → 47 unmet in 24h, 9 sites at risk).
   *Fix:* lead the demo with **Mass casualty**; add a clear before/after strip that animates when a surge starts
   ("Sites running out in 24h: 0 → 9"); highlight changed rows in the outlook.
2. **Transfer count looks frozen.** "12 suggested" before the surge, after the surge, and after each approval
   (the planner tops the list up). *Fix:* show "new since surge" and "approved" counts, flash approved cards into
   "In motion".
3. **Stage bank panel is hard-wired to S. L. Raheja**, but after a live e-RaktKosh sync the top-ranked bank for
   the demo request became Lokmanya Tilak. The request then lands at a bank the stage isn't showing.
   *Fix:* make the stage bank panel follow the bank of the most recent reservation (or pin the demo to snapshot data).
4. **Pending alerts survive a donation.** Right after "Donation complete, eligible again in Feb 2027", the same
   donor gets another "please come" alert. *Fix (backend):* when a donation is recorded, close the donor's other
   open alerts; *(UI)* never show alerts while the donor is ineligible.
5. **Notifications fire twice (sometimes three times) per action**, e.g. "Transfer approved: 31 × B+ …" from the
   button plus the same from the live update. *Fix:* the acting tab suppresses the realtime toast for its own action.
6. **Notifications aren't filtered by site.** A bank tab sees toasts about other banks' requests
   ("…needs 4 × O− PLT from Tata Memorial" on Raheja's screen). *Fix:* filter toasts by `siteIds` / `donorIds`
   for the screen's acting site.

### P1: confusing or missing feedback

7. **End surge and Reset demo have no confirmation**, so one stray click ends the scenario mid-pitch.
8. **Reset demo shows no feedback on the stage** (the reset works; ledger entry #1 confirms it).
9. **Refresh brief does nothing visible** (the brief is cached per surge). Show "regenerated at hh:mm" or a spinner.
10. **Map sites on Command aren't clickable.** 31 markers, no detail. Add a side card (stock by group, freshness, risk).
11. **Other scenario button is disabled during a surge** with no explanation. Add a tooltip "End the current surge first", or allow switching.
12. **Two "Critical — alert everyone" buttons** on the hospital screen (form + tracker). The form one tries to
    create a duplicate request and errors; only the tracker one alerts. Keep one, clearly scoped.
13. **Two different countdowns on one bank queue card** ("Auto-reroutes in 0m 29s" and "…in 1m").
14. **Consent switches save silently.** Add a small "Saved" confirmation.
15. **Hospital "Our stock" tab is empty.** Real data has no hospital-held stock. Hide the tab or show an explained empty state.

### P2: polish

16. "Dry in 0m" on transfer cards should read **"dry now"**.
17. "Avert 1 more **units**" (pluralisation).
18. Delivered toast shows an internal ID ("REQ-DVJZK6: delivered to …"). Use the ward and hospital instead.
19. After every reset the hourly e-RaktKosh auto-sync logs a failure as ledger entry #2 when the relay isn't
    running. Suppress the auto attempt right after a reset.

---

## Suggested UI work for the frontend developer

- **Notification system:** one toast per action, scoped to the acting site, with a small notification centre (bell) listing recent events.
- **Surge storytelling:** an animated "impact strip" across the top of Command when a surge starts, and changed values highlighted.
- **Command map:** clickable sites with a detail card, and a legend that matches the calm severity ramp.
- **Confirmations:** for destructive or global actions (End surge, Reset demo, Tamper).
- **Stage:** auto-follow the active bank and donor so the three panels always show the same story.

#!/usr/bin/env node
/**
 * End-to-end smoke test of the judge demo against a running instance.
 *   node scripts/smoke.mjs [baseUrl]      (default http://127.0.0.1:8799)
 * Resets the simulated city, so never point this at a live demo mid-pitch.
 */
const base = (process.argv[2] ?? "http://127.0.0.1:8799").replace(/\/$/, "");

async function api(method, path, body, actor = "smoke-test") {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Actor": actor },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const reset = await api("POST", "/demo/reset");
check("reset", reset.status === 200, JSON.stringify(reset.json));

const sites = await api("GET", "/sites");
const hospital = sites.json.find((s) => s.kind === "hospital");
check("sites", sites.json.length > 0 && hospital, `${sites.json.length} sites`);

const need = {
  hospitalId: hospital.id,
  bloodGroup: "O-",
  component: "platelets",
  unitsNeeded: 2,
  urgency: "urgent",
  neededBy: Date.now() + 3_600_000,
};
const search = await api("POST", "/search", need);
check("search ranks options", search.json.options?.length > 0,
  search.json.options?.map((o) => `#${o.rank} ${o.siteId} ${o.etaMinutes}min ${o.matchType}${o.stale ? " STALE" : ""}`).join(" | "));
const top = search.json.options[0];

const created = await api("POST", "/requests", { ...need, ward: "Trauma ICU" });
check("create request", created.status === 201, created.json.id);
const dup = await api("POST", "/requests", { ...need, ward: "Trauma ICU" });
check("duplicate detection", dup.status === 409 && dup.json.error.code === "duplicate_request");

const reserved = await api("POST", `/requests/${created.json.id}/reserve`, { bankSiteId: top.siteId });
const res = reserved.json.active;
check("reserve holds units", res?.status === "requested" && res.units.length === 2, `${res?.id} eta ${res?.etaMinutes}min`);

const queue = await api("GET", `/sites/${top.siteId}/queue`);
check("bank queue shows request", queue.json.some((q) => q.reservation.id === res.id));

const confirmed = await api("POST", `/reservations/${res.id}/confirm`, {});
check("bank confirms", confirmed.json.status === "reserved", confirmed.json.timeline?.filter((t) => t.at).map((t) => t.step).join(" → "));

await api("POST", `/reservations/${res.id}/advance`, { to: "picked_up" });
const delivered = await api("POST", `/reservations/${res.id}/advance`, { to: "delivered" });
check("delivered → request fulfilled", delivered.json.status === "fulfilled");

const invalid = await api("POST", "/search", { hospitalId: hospital.id, bloodGroup: "Q+" });
check("validation errors are 422", invalid.status === 422, Object.keys(invalid.json.error?.details ?? {}).join(","));

const calm = await api("GET", "/forecast");
check("forecast (calm)", calm.status === 200, `shortfall ${calm.json.current.shortfall}, waste ${calm.json.current.expectedWaste}`);

const surge = await api("POST", "/surge", { kind: "flood" });
check("surge starts", surge.status === 201, `${surge.json.label} @ ${surge.json.areaName}`);
const hot = await api("GET", "/forecast");
check("surge raises shortfall", hot.json.current.shortfall > calm.json.current.shortfall,
  `shortfall ${hot.json.current.shortfall} → with plan ${hot.json.withPlan.shortfall}; first out: ${hot.json.outlook.slice(0, 3).map((o) => `${o.bloodGroup} ${o.component} ${o.stockoutHours}h`).join(", ")}`);

const board = await api("GET", "/transfers");
check("transfer suggestions", board.json.suggestions.length > 0, `${board.json.suggestions.length} suggestions; top: ${board.json.suggestions[0]?.reason}`);
const s0 = board.json.suggestions[0];
const approved = await api("POST", "/transfers", { fromSiteId: s0.fromSiteId, toSiteId: s0.toSiteId, bloodGroup: s0.bloodGroup, component: s0.component, quantity: s0.quantity });
check("approve transfer", approved.status === 201, `${approved.json.id} ${approved.json.quantity} units`);
const after = await api("GET", "/forecast");
check("approval improves outlook", after.json.current.shortfall <= hot.json.current.shortfall, `shortfall ${hot.json.current.shortfall} → ${after.json.current.shortfall}`);

const brief = await api("GET", "/surge/brief");
check("surge brief", brief.json.text?.length > 0, `${brief.json.source}`);

const personas = await api("GET", "/donors/personas");
const donor = personas.json.find((d) => d.bloodGroup === "O-" && d.eligible);
const preview = await api("POST", "/drives/preview", { bankSiteId: top.siteId, bloodGroup: "O-" });
check("drive preview funnel", preview.json.eligibleCount > 0, JSON.stringify(preview.json.skipped));
const drive = await api("POST", "/drives", { bankSiteId: top.siteId, bloodGroup: "O-", donorsNeeded: 1 });
check("drive sends alerts", drive.status === 201, `${drive.json.sent} sent`);
const alerts = await api("GET", `/donors/${donor.id}/alerts`);
const alert = alerts.json[0];
check("persona received alert", alert?.status === "sent" && alert.bankAddress === null, alert?.message);
const yes = await api("POST", `/alerts/${alert.id}/respond`, { response: "accept" });
check("donor accepts → details revealed", yes.json.confirmationCode && yes.json.bankAddress, `code ${yes.json.confirmationCode}, ${yes.json.arrivalWindow}`);
const incoming = await api("GET", `/sites/${top.siteId}/incoming-donors`);
check("bank sees incoming donor", incoming.json.length === 1);
const done = await api("POST", `/alerts/${alert.id}/complete`);
const donorAfter = await api("GET", `/donors/${donor.id}`);
check("donation resets eligibility", done.status === 200 && donorAfter.json.eligible === false);

const verify = await api("GET", "/audit/verify");
check("ledger verifies", verify.json.ok, `${verify.json.checked} entries`);
await api("POST", "/demo/tamper");
const broken = await api("GET", "/audit/verify");
check("tampering is detected", broken.json.ok === false, `broken at #${broken.json.brokenAt}`);

await api("DELETE", "/surge");
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);

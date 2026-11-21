/**
 * India-based relay for e-RaktKosh, the national blood-availability portal.
 * e-RaktKosh refuses connections from cloud servers (Cloudflare gets HTTP 522), but answers
 * normally from an Indian connection, so this gateway fetches the public stock endpoint and
 * pushes the raw rows to Blood Bridge, which parses and reconciles them.
 */
import type { BloodBridgeApi } from "./api.ts";
import type { Logger } from "./log.ts";

const ENDPOINT = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/nearbyBB.cnt";
const USER_AGENT = "Mozilla/5.0 (BloodBridge/1.0; MindSprint 2026 hackathon)";
/** Mumbai and Mumbai Suburban, Maharashtra. */
const DISTRICTS = ["519", "518"];
/** e-RaktKosh component codes Blood Bridge models (red cells, plasma, platelets, whole blood). */
const COMPONENTS = ["11", "12", "28", "30", "29", "13", "19", "18", "23", "20", "14"];
export const RELAY_EVERY_MS = 30 * 60_000;

async function fetchOne(districtCode: string, componentCode: string) {
  const q = new URLSearchParams({ hmode: "GETNEARBYSTOCKDETAILS", stateCode: "27", districtCode, bloodGroup: "all", bloodComponent: componentCode, lang: "0" });
  const res = await fetch(`${ENDPOINT}?${q}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`e-RaktKosh HTTP ${res.status}`);
  const body = (await res.json()) as { data?: string[][] };
  return { componentCode, rows: body.data ?? [] };
}

export async function relayEraktkosh(api: BloodBridgeApi, log: Logger): Promise<void> {
  try {
    const jobs = DISTRICTS.flatMap((d) => COMPONENTS.map((c) => [d, c] as const));
    const results = [];
    for (let i = 0; i < jobs.length; i += 4) results.push(...(await Promise.all(jobs.slice(i, i + 4).map(([d, c]) => fetchOne(d, c)))));
    const out = await api.eraktkosh(results);
    log.info("e-RaktKosh relayed", { banks: out.banks.length, added: out.added, removed: out.removed });
  } catch (err) {
    log.warn("e-RaktKosh relay failed; will retry", { error: err as Error });
  }
}

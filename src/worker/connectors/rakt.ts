/**
 * Connector for RAKT, a blood bank management system used by Indian blood centres.
 * Built against RAKT's published OpenAPI schema (https://rakt.in/api/schema/):
 *   GET /api/v1/blood-bags/   (Authorization: "Api-Key <key>", scoped to one organisation)
 *   BloodBags { id, segment_blood_group: "O Rh Neg" | …, created_at (collection), components: BloodComponent[] }
 *   BloodComponent { id, name (free text, e.g. "PRBC", "FFP", "RDP"), in_stock, issue_no }
 * Unlike e-RaktKosh (counts only), RAKT gives per-bag data, so expiry = collection + legal shelf life.
 */
import type { BloodGroup, Component } from "../../shared/domain";

export interface RaktComponent {
  id: number | string;
  name: string;
  in_stock?: number | boolean | null;
  issue_no?: string | null;
}

export interface RaktBag {
  id: number | string;
  segment_blood_group?: string | null;
  created_at?: string | null;
  components?: RaktComponent[];
}

export interface RaktUnit {
  /** Stable across syncs: one Blood Bridge unit per RAKT component. */
  id: string;
  bloodGroup: BloodGroup;
  component: Component;
  collectedAt: number;
  expiresAt: number;
}

const GROUPS: Record<string, BloodGroup> = {
  "A Rh Pos": "A+",
  "A Rh Neg": "A-",
  "B Rh Pos": "B+",
  "B Rh Neg": "B-",
  "O Rh Pos": "O+",
  "O Rh Neg": "O-",
  "AB Rh Pos": "AB+",
  "AB Rh Neg": "AB-",
  // "Oh Rh Pos(Bombay)" / "Oh Rh Neg(Bombay)" are not modelled yet (see roadmap: rare-donor registry).
};

/** Map RAKT's free-text component names. Platelet-rich plasma and cryo products are not modelled. */
export function mapComponent(name: string): Component | null {
  const n = name.toLowerCase();
  if (/cryo|platelet rich|\bprp\b/.test(n)) return null;
  if (/platelet|\brdp\b|\bsdp\b|\bplt\b|apheresis/.test(n)) return "platelets";
  if (/plasma|\bffp\b|\bfp\b/.test(n)) return "plasma";
  if (/red|rbc|prbc|packed|sagm/.test(n)) return "red_cells";
  if (/whole|\bwb\b/.test(n)) return "whole_blood";
  return null;
}

const inStock = (c: RaktComponent) => (typeof c.in_stock === "boolean" ? c.in_stock : Number(c.in_stock ?? 0) > 0) && !c.issue_no;

/** Available, in-date units from a RAKT blood-bag listing. */
export function parseRaktBags(bags: RaktBag[], now: number, shelfLifeDays: Record<Component, number>): RaktUnit[] {
  const units: RaktUnit[] = [];
  for (const bag of bags) {
    const group = GROUPS[bag.segment_blood_group?.trim() ?? ""];
    const collectedAt = bag.created_at ? Date.parse(bag.created_at) : NaN;
    if (!group || Number.isNaN(collectedAt)) continue;
    for (const c of bag.components ?? []) {
      const component = mapComponent(c.name);
      if (!component || !inStock(c)) continue;
      const expiresAt = collectedAt + shelfLifeDays[component] * 86_400_000;
      if (expiresAt <= now) continue;
      units.push({ id: `RAKT-${bag.id}-${c.id}`, bloodGroup: group, component, collectedAt, expiresAt });
    }
  }
  return units;
}

/** Fetch every blood bag for the key's organisation. Handles both plain arrays and DRF-style pages. */
export async function fetchRaktBags(baseUrl: string, apiKey: string): Promise<RaktBag[]> {
  const bags: RaktBag[] = [];
  let url: string | null = `${baseUrl.replace(/\/$/, "")}/api/v1/blood-bags/`;
  for (let page = 0; url && page < 50; page++) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Api-Key ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401 || res.status === 403) throw new Error("RAKT rejected the API key");
    if (!res.ok) throw new Error(`RAKT returned HTTP ${res.status}`);
    const body = (await res.json()) as RaktBag[] | { results?: RaktBag[]; next?: string | null };
    if (Array.isArray(body)) return bags.concat(body);
    bags.push(...(body.results ?? []));
    url = body.next ?? null;
  }
  return bags;
}

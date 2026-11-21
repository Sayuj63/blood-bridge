/**
 * Pure parsing of e-RaktKosh's public stock endpoint (MoHFW / NBTC), ported from
 * data/scripts/build_mumbai.py so the Worker and the offline pipeline agree exactly.
 *
 * Each row: [srNo, "name<br/>address<br/>Phone..", category, availabilityHtml,
 *            lastUpdated "YYYY-MM-DD HH:MM:SS" (IST), type]
 */
import banksJson from "../../../data/mumbai/blood_banks.json";
import { BLOOD_GROUPS, COMPONENTS, type BloodGroup, type Component } from "../../shared/domain";

/** e-RaktKosh component code → Blood Bridge component. 16/17/21 (PRP, cryo) are not modelled. */
export const COMPONENT_MAP: Record<string, Component> = {
  "11": "whole_blood",
  "12": "red_cells",
  "28": "red_cells",
  "30": "red_cells",
  "29": "red_cells",
  "13": "plasma",
  "19": "plasma",
  "18": "plasma",
  "23": "platelets",
  "20": "platelets",
  "14": "platelets",
};

export const DISTRICT_CODES = ["519", "518"] as const; // Mumbai, Mumbai Suburban
export const STATE_CODE = "27"; // Maharashtra

export type EraktkoshRow = [string, string, string, string, string, string];
export interface EraktkoshResult {
  componentCode: string;
  rows: EraktkoshRow[];
}

export type Counts = Record<BloodGroup, Record<Component, number>>;

export interface ParsedSnapshot {
  /** Our bank id → reported counts. Only banks present in the response are included. */
  stock: Record<string, Counts>;
  /** Our bank id → e-RaktKosh last-updated time (epoch ms). */
  updatedAt: Record<string, number>;
}

/** Our bank id keyed by the exact e-RaktKosh name recorded in each bank's `sourceId`. */
const BANK_BY_EK_NAME = new Map(
  (banksJson as { id: string; sourceId: string }[])
    .map((b) => [b.sourceId.split("eraktkosh:")[1]?.trim(), b.id] as const)
    .filter((e): e is readonly [string, string] => Boolean(e[0])),
);

const emptyCounts = (): Counts =>
  Object.fromEntries(BLOOD_GROUPS.map((g) => [g, Object.fromEntries(COMPONENTS.map((c) => [c, 0]))])) as Counts;

/** e-RaktKosh reports IST wall-clock time without an offset. */
export const parseIst = (s: string): number => Date.parse(`${s.trim().replace(" ", "T")}+05:30`);

const GROUP_RE = /((?:AB|A|B|O)[+-])Ve:(\d+)/g;

export function parseResults(results: EraktkoshResult[]): ParsedSnapshot {
  const stock: Record<string, Counts> = {};
  const updatedAt: Record<string, number> = {};
  for (const res of results) {
    const component = COMPONENT_MAP[res.componentCode];
    for (const row of res.rows) {
      const bankId = BANK_BY_EK_NAME.get(row[1].split("<br/>")[0].trim());
      if (!bankId) continue;
      const updated = row[4] ? parseIst(row[4]) : NaN;
      if (!Number.isNaN(updated)) updatedAt[bankId] = Math.max(updatedAt[bankId] ?? 0, updated);
      const counts = (stock[bankId] ??= emptyCounts());
      if (!component) continue;
      for (const [, group, n] of row[3].matchAll(GROUP_RE)) counts[group as BloodGroup][component] += Number(n);
    }
  }
  return { stock, updatedAt };
}

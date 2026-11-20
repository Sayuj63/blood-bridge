/**
 * STATS — every number the landing page shows about the problem.
 *
 * Rule: never invent a number. HERO_STATS is copied verbatim from the verified
 * JSON in docs/PROBLEM_RESEARCH.md §6; SION is a verified alternate from the same
 * doc (ref [6]). Snapshot figures are computed from data/mumbai/stock_snapshot.json.
 * Claims the doc lists as unverified must never be added here.
 */
import { formatISTDateTime } from "../../lib/format";
import { SNAPSHOT_AT, SNAPSHOT_FACTS } from "./data";

export interface LandingStat {
  key: string;
  /** Display value exactly as sourced, e.g. "28 lakh", "~1 million", "97%". */
  value: string;
  label: string;
  source: string;
  url: string;
}

/** docs/PROBLEM_RESEARCH.md §6 "Hero stats (landing page)". */
export const HERO_STATS: LandingStat[] = [
  {"key":"gap","value":"~1 million","label":"units short every year in India","source":"Mammen et al., PLoS One, 2022","url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8986005"},
  {"key":"discarded5y","value":"28 lakh","label":"blood units discarded in five years","source":"NACO via RTI, Medical Dialogues, 2017","url":"https://medicaldialogues.in/wasting-the-essence-of-life-2-8-million-blood-components-discarded-in-last-five-years"},
  {"key":"expiry","value":"97%","label":"of discards at one Chennai hospital: expired","source":"Cureus, 2024","url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11143397"},
  {"key":"mumbaibanks","value":"58","label":"Mumbai blood banks, no shared reservation","source":"SBTC via Free Press Journal, 2026","url":"https://www.freepressjournal.in/mumbai/mumbai-faces-severe-summer-blood-shortage-as-hospitals-struggle-to-maintain-critical-stock"},
  {"key":"stgeorge","value":"4 units","label":"left at St George Hospital, May 2026","source":"Free Press Journal, 2026","url":"https://www.freepressjournal.in/mumbai/mumbai-faces-severe-summer-blood-shortage-as-hospitals-struggle-to-maintain-critical-stock"},
  {"key":"maternal","value":"47%","label":"of maternal deaths caused by haemorrhage","source":"Meh et al., BJOG, 2022","url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC9292773"},
  {"key":"thal","value":"1–1.5 lakh","label":"Indian children need lifelong transfusions (thalassemia)","source":"Union Health Minister via Tribune, 2020","url":"https://www.tribuneindia.com/news/health/india-has-largest-number-of-kids-with-thalassemia-major-127968"},
  {"key":"bombay","value":"1 in 10,000","label":"have Bombay blood, discovered in Mumbai, 1952","source":"Indian J Hematol Blood Transfus, 2013","url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4115078"},
];

export const heroStat = (key: string): LandingStat => {
  const s = HERO_STATS.find((x) => x.key === key);
  if (!s) throw new Error(`Unknown hero stat: ${key}`);
  return s;
};

/** Sion Hospital, 2025: camp collection vs. thalassemia need alone. PROBLEM_RESEARCH.md alternates, ref [6]. */
export const SION = {
  collected: 13_872,
  needed: 15_052,
  source: "Free Press Journal, Jul 2026",
  url: "https://www.freepressjournal.in/mumbai/sion-hospital-blood-bank-faces-shortage-as-donations-drop-thalassemia-patients-at-risk",
} as const;

/** Our own e-RaktKosh snapshot, for the "directory can't see the shelf" beat. */
export const SNAPSHOT_SOURCE = {
  source: `Our e-RaktKosh snapshot of ${SNAPSHOT_FACTS.centres} Mumbai centres, ${formatISTDateTime(SNAPSHOT_AT)}`,
  url: "https://eraktkosh.mohfw.gov.in",
} as const;

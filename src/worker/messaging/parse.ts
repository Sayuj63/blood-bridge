/**
 * Deterministic chat parsing for the WhatsApp/SMS bot. Pure, unit-tested.
 *
 * This is both the fast path and the safety net: Workers AI may enrich a request,
 * but a blood group is only ever taken from text the parser can see (see extract.ts).
 * Handles English, Hinglish (Latin script) and common Hindi/Marathi words.
 */
import { BLOOD_GROUPS, type BloodGroup, type Component, type Language, type Urgency } from "../../shared/domain";

export type Keyword = "stop" | "start" | "help" | "join" | "yes" | "no";

export interface Place {
  id: string;
  name: string;
  kind: "hospital" | "area";
  lat: number;
  lng: number;
  /** Extra names people actually type ("Sion hospital", "LTMGH"). */
  aliases?: string[];
}

export interface NeedDraft {
  bloodGroup: BloodGroup | null;
  component: Component | null;
  units: number | null;
  urgency: Urgency | null;
  place: Place | null;
}

/** Lowercase, unify dashes/minus signs, collapse whitespace, drop trailing punctuation. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[−‒–—]/g, "-")
    .replace(/[​-‍﻿]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const bare = (text: string) => normalizeText(text).replace(/[.!?,;:'"()]+/g, "").trim();

// Whole-message keywords. Matching the whole message keeps "no" inside a sentence from declining an alert.
const KEYWORDS: Record<Keyword, readonly string[]> = {
  stop: ["stop", "unsubscribe", "stop all", "stopall", "cancel alerts", "opt out", "optout", "band karo", "बंद", "बंद करो", "थांबवा"],
  start: ["start", "unstop", "resume", "subscribe"],
  help: ["help", "menu", "hi", "hello", "hey", "namaste", "info", "madad", "मदद", "नमस्ते", "मेनू"],
  join: ["join", "register", "donate", "become a donor", "i want to donate", "donor", "signup", "sign up", "जुड़ें", "रजिस्टर", "नोंदणी"],
  yes: ["yes", "y", "1", "haan", "han", "haa", "ha", "hā", "ho", "yes i can", "i can come", "coming", "हाँ", "हां", "हा", "हो", "ji haan", "haan ji"],
  no: ["no", "n", "2", "nahi", "nahin", "nai", "na", "not now", "can't", "cannot", "नहीं", "नही", "नाही"],
};

export function keyword(text: string): Keyword | null {
  const t = bare(text);
  if (!t) return null;
  for (const k of Object.keys(KEYWORDS) as Keyword[]) {
    if (KEYWORDS[k].includes(t)) return k;
  }
  return null;
}

/* ───────────────────────────── Need extraction ───────────────────────────── */

// Rh must be explicit: a bare "O" or "A" is far too ambiguous ("need a donor"), so we ask instead.
const RH = String.raw`(\+ve|-ve|\+|-|positive|negative|pos|neg|ve\+|ve-)`;
const GROUP_RE = new RegExp(String.raw`(?:^|[^a-z0-9])(ab|a|b|o)[\s-]?${RH}(?=$|[^a-z])`, "i");

/** Explicit ABO + Rh only ("O-", "o negative", "B +ve", "AB pos"). */
export function parseBloodGroup(text: string): BloodGroup | null {
  const m = GROUP_RE.exec(normalizeText(text));
  if (!m) return null;
  const abo = m[1].toUpperCase();
  const rh = m[2].includes("+") || m[2].startsWith("pos") ? "+" : "-";
  const group = `${abo}${rh}`;
  return (BLOOD_GROUPS as readonly string[]).includes(group) ? (group as BloodGroup) : null;
}

const COMPONENT_WORDS: [Component, RegExp][] = [
  ["platelets", /\b(platelets?|plt|sdp|rdp|apheresis)\b|प्लेटलेट/],
  ["plasma", /\b(plasma|ffp|cryo)\b|प्लाज़्मा|प्लाज्मा/],
  ["red_cells", /\b(prbc|pcv|rbc|packed cells?|packed red|red cells?|red blood cells?)\b/],
  ["whole_blood", /\b(whole blood|wb)\b/],
];

export function parseComponent(text: string): Component | null {
  const t = normalizeText(text);
  for (const [c, re] of COMPONENT_WORDS) if (re.test(t)) return c;
  return null;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ek: 1, teen: 3, char: 4, paanch: 5 };

/** "2 units", "3 bags", "2 O-", "two units". Capped at 20, like the hospital form. */
export function parseUnits(text: string): number | null {
  const t = normalizeText(text);
  const unitWord = String.raw`(?:units?|bags?|bottles?|pints?|packs?|yunit)`;
  const patterns = [
    new RegExp(String.raw`\b(\d{1,2})\s*${unitWord}\b`),
    new RegExp(String.raw`\b(\d{1,2})\s*(?:x\s*)?(?:ab|a|b|o)[\s-]?${RH}`),
    new RegExp(String.raw`\b(${Object.keys(NUMBER_WORDS).join("|")})\s+${unitWord}\b`),
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (!m) continue;
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
    if (n >= 1) return Math.min(n, 20);
  }
  return null;
}

export function parseUrgency(text: string): Urgency | null {
  const t = normalizeText(text);
  if (/\b(emergency|critical|sos|asap|immediately|right now|turant|abhi|fauran)\b|तुरंत|इमरजेंसी|ताबडतोब/.test(t)) return "critical";
  if (/\b(urgent|urgently|jaldi|today|aaj|tonight)\b|जल्दी|लवकर/.test(t)) return "urgent";
  if (/\b(this week|routine|planned|tomorrow|kal)\b/.test(t)) return "routine";
  return null;
}

const NEED_WORDS =
  /\b(need|needed|needs|require|required|requirement|want|wanted|looking for|chahiye|chahie|chaiye|zaroorat|zarurat|jarurat|blood|platelets?|plasma|ffp|sdp|prbc|donor needed|khoon)\b|चाहिए|ज़रूरत|जरूरत|खून|रक्त|पाहिजे|हवे/;

/** Does this message read like a request for blood? */
export function looksLikeNeed(text: string): boolean {
  const t = normalizeText(text);
  return parseBloodGroup(t) !== null || NEED_WORDS.test(t);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Find the hospital or locality a message mentions. Longest name wins; on a tie a
 * hospital beats an area (it's a more precise origin).
 */
export function matchPlace(text: string, places: readonly Place[], kinds: readonly Place["kind"][] = ["hospital", "area"]): Place | null {
  const t = normalizeText(text);
  let best: { place: Place; len: number } | null = null;
  for (const place of places) {
    if (!kinds.includes(place.kind)) continue;
    for (const name of [place.name, ...(place.aliases ?? [])]) {
      const n = normalizeText(name);
      if (n.length < 3) continue;
      if (!new RegExp(String.raw`(?:^|[^a-z0-9])${escapeRe(n)}(?=$|[^a-z0-9])`).test(t)) continue;
      const better =
        !best || n.length > best.len || (n.length === best.len && place.kind === "hospital" && best.place.kind === "area");
      if (better) best = { place, len: n.length };
    }
  }
  return best?.place ?? null;
}

export function parseNeed(text: string, places: readonly Place[]): NeedDraft {
  return {
    bloodGroup: parseBloodGroup(text),
    component: parseComponent(text),
    units: parseUnits(text),
    urgency: parseUrgency(text),
    place: matchPlace(text, places),
  };
}

/* ───────────────────────────── Language ───────────────────────────── */

/** Answer to "which language?" during JOIN. */
export function parseLanguageChoice(text: string): Language | null {
  const t = bare(text);
  if (["1", "en", "eng", "english", "angrezi"].includes(t)) return "en";
  if (["2", "hi", "hindi", "हिन्दी", "हिंदी"].includes(t)) return "hi";
  if (["3", "mr", "marathi", "मराठी"].includes(t)) return "mr";
  return null;
}

const DEVANAGARI = /[ऀ-ॿ]/;
const MARATHI_HINTS = /आहे|पाहिजे|हवे|नाही|मला|आम्हाला|थांबवा|लवकर/;

/** Reply language for a sender we know nothing about: Devanagari → hi/mr, otherwise English. */
export function detectLanguage(text: string): Language {
  if (!DEVANAGARI.test(text)) return "en";
  return MARATHI_HINTS.test(text) ? "mr" : "hi";
}

export const hasDevanagari = (text: string): boolean => DEVANAGARI.test(text);

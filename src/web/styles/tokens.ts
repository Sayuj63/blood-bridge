/**
 * TypeScript mirror of the colour tokens that canvas/WebGL layers need
 * (MapLibre paint, deck.gl layers) and cannot read from CSS variables.
 * Keep in sync with styles/index.css.
 */
import type { BloodGroup } from "../../shared/domain";

export type Rgb = readonly [number, number, number];
export type ThemeName = "clinical" | "command";

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** One colour per blood group: ABO picks the hue family, Rh-negative is the lighter tint. */
export const BLOOD_GROUP_HEX: Record<BloodGroup, string> = {
  "O-": "#2dd4bf",
  "O+": "#0b7d73",
  "A-": "#7cb4fb",
  "A+": "#2563eb",
  "B-": "#f58fc4",
  "B+": "#d61f74",
  "AB-": "#c4b5fd",
  "AB+": "#7c3aed",
};

/** Text colour that reaches AA contrast on each group colour. */
export const BLOOD_GROUP_ON: Record<BloodGroup, string> = {
  "O-": "#04201d",
  "O+": "#ffffff",
  "A-": "#06182f",
  "A+": "#ffffff",
  "B-": "#2a0616",
  "B+": "#ffffff",
  "AB-": "#170d33",
  "AB+": "#ffffff",
};

export const bloodGroupRgb = (g: BloodGroup): Rgb => hexToRgb(BLOOD_GROUP_HEX[g]);

/** Semantic tones shared by map markers and badges. */
export type Tone = "neutral" | "accent" | "bridge" | "critical" | "warn" | "ok" | "info";

const TONE_HEX: Record<ThemeName, Record<Tone, string>> = {
  clinical: {
    neutral: "#42556a",
    accent: "#b0122c",
    bridge: "#0a7383",
    critical: "#b42318",
    warn: "#a14a05",
    ok: "#13703f",
    info: "#1d5fb8",
  },
  command: {
    neutral: "#a3b5c7",
    accent: "#ff4058",
    bridge: "#38d6c8",
    critical: "#ff5a5f",
    warn: "#f7b23b",
    ok: "#3dd68c",
    info: "#6cb2ff",
  },
};

export const toneHex = (theme: ThemeName, tone: Tone): string => TONE_HEX[theme][tone];
export const toneRgb = (theme: ThemeName, tone: Tone): Rgb => hexToRgb(TONE_HEX[theme][tone]);

/** OpenFreeMap vector styles — open data, no API key. */
export const MAP_STYLE_URL: Record<ThemeName, string> = {
  clinical: "https://tiles.openfreemap.org/styles/positron",
  command: "https://tiles.openfreemap.org/styles/dark",
};

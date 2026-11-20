import type { Tone } from "../../styles/tokens";

/** Severity by hours until stock-out. Shared by bars, markers and labels so they always agree. */
export function stockoutTone(hours: number | null): Tone {
  if (hours === null) return "ok";
  if (hours < 6) return "critical";
  if (hours < 24) return "warn";
  return "info";
}

export const TONE_BG: Record<Tone, string> = {
  neutral: "bg-ink-faint",
  accent: "bg-accent",
  bridge: "bg-bridge",
  critical: "bg-critical",
  warn: "bg-warn",
  ok: "bg-ok",
  info: "bg-info",
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink-muted",
  accent: "text-accent",
  bridge: "text-bridge",
  critical: "text-critical",
  warn: "text-warn",
  ok: "text-ok",
  info: "text-info",
};

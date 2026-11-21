/**
 * "Remind me when I'm eligible again" as an RFC 5545 calendar file:
 * one all-day event on the eligible date with a display alarm the day before.
 */
import { donorPageUrl } from "./links";

/** IST calendar date of an instant, as YYYYMMDD (the eligible date the donor sees is an IST date). */
function istDate(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

/** The day after a YYYYMMDD date (DTEND of an all-day event is exclusive). */
function nextDay(yyyymmdd: string): string {
  const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

const utcStamp = (ms: number): string => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** TEXT value escaping (RFC 5545 §3.3.11). */
const esc = (s: string): string => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold content lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function eligibilityReminderIcs({ donorId, eligibleFrom, now = Date.now() }: { donorId: string; eligibleFrom: number; now?: number }): string {
  const day = istDate(eligibleFrom);
  const url = `${donorPageUrl()}?donor=${encodeURIComponent(donorId)}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blood Bridge//Donor reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:eligible-${donorId}-${day}@blood-bridge`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${nextDay(day)}`,
    `SUMMARY:${esc(`You can donate blood again (Blood Bridge) ${url}`)}`,
    `DESCRIPTION:${esc(
      `From today you're eligible to donate again under the demo interval. Open Blood Bridge to switch alerts back on or see banks near you: ${url}\nThe bank checks you're well to donate on the day.`,
    )}`,
    `URL:${url}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-P1D",
    `DESCRIPTION:${esc("Tomorrow you can donate blood again")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

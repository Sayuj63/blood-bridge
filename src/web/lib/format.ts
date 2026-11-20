/** Display formatting. All times are shown in India Standard Time regardless of the viewer's zone. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const istTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const istTimeSeconds = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "14:05 IST" */
export const formatIST = (ms: number, withSeconds = false): string =>
  `${(withSeconds ? istTimeSeconds : istTime).format(ms)} IST`;

/** "20 Nov, 14:05 IST" */
export const formatISTDateTime = (ms: number): string => `${istDateTime.format(ms)} IST`;

/**
 * Compact duration from hours: 0.5 → "30m", 3.25 → "3h 15m", 52 → "2d 4h".
 * Negative values clamp to "0m".
 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0m";
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const m = totalMinutes % 60;
    return m ? `${totalHours}h ${m}m` : `${totalHours}h`;
  }
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Duration from milliseconds, including seconds under an hour: "4m 09s", "1h 12m". */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  }
  return formatHours(s / 3600);
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". Future times read "in 4 min". */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const diff = now - ms;
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";
  let text: string;
  if (abs < HOUR) text = `${Math.round(abs / MINUTE)} min`;
  else if (abs < 24 * HOUR) text = `${Math.round(abs / HOUR)} h`;
  else text = `${Math.round(abs / (24 * HOUR))} d`;
  return diff >= 0 ? `${text} ago` : `in ${text}`;
}

/** Minutes since a sync, phrased for a freshness pill: "synced 3 min ago". */
export function freshnessLabel(minutes: number): string {
  if (minutes < 1) return "synced just now";
  if (minutes < 60) return `synced ${Math.round(minutes)} min ago`;
  return `synced ${formatHours(minutes / 60)} ago`;
}

/** First n hex characters of a hash, for display. */
export const shortHash = (hash: string, n = 10): string => hash.slice(0, n);

/** "1 unit" / "3 units" */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** Blood group for screen readers: "O-" → "O negative". */
export const spokenGroup = (g: string): string =>
  `${g.slice(0, -1)} ${g.endsWith("-") ? "negative" : "positive"}`;

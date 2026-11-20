/**
 * Structured JSON logs on stderr (stdout is reserved for the console adapter and the QR code).
 * Redaction is built in: message bodies are reduced to their length, phone numbers are masked,
 * and anything that looks like a token is dropped.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Fields = Record<string, unknown>;

export function maskAddress(address: string): string {
  if (address.endsWith("@g.us")) return `group…${address.replace(/@g\.us$/, "").slice(-4)}`;
  const digits = address.replace(/\D/g, "");
  if (digits.length < 6) return "••••";
  return `${address.startsWith("+91") ? "+91" : "+"}${"•".repeat(Math.max(2, digits.length - (address.startsWith("+91") ? 2 : 0) - 4))}${digits.slice(-4)}`;
}

const BODY_KEYS = new Set(["body", "text", "message"]);
const ADDRESS_KEYS = new Set(["to", "from", "address", "phone"]);
const SECRET_KEYS = /token|password|secret|authorization|signing/i;

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SECRET_KEYS.test(k)) continue;
    if (BODY_KEYS.has(k) && typeof v === "string") out[`${k}Chars`] = v.length;
    else if (ADDRESS_KEYS.has(k) && typeof v === "string") out[k] = maskAddress(v);
    else if (v instanceof Error) out[k] = { name: v.name, message: scrub(v.message) };
    else out[k] = v;
  }
  return out;
}

/** Remove phone-number-like digit runs from free text (errors from providers often echo numbers). */
export const scrub = (s: string) => s.replace(/\+?\d[\d\s-]{6,}\d/g, "[number]").slice(0, 400);

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

export function createLogger(level: Level, base: Fields = {}): Logger {
  const emit = (l: Level, msg: string, fields: Fields = {}) => {
    if (ORDER[l] < ORDER[level]) return;
    process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level: l, msg, ...base, ...redact(fields) })}\n`);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (f) => createLogger(level, { ...base, ...f }),
  };
}

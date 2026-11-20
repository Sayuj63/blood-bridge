/**
 * Phone numbers and channel addresses. Pure functions, no Worker globals, unit-tested.
 *
 * Every number the system stores or messages is E.164 (`+919820012345`). Input arrives
 * in many shapes: "98200 12345", "098200-12345", "+91 98200 12345", "0091…",
 * "919820012345@c.us" (open-wa), "whatsapp:+91…". India (+91) is the default country.
 */

const DEFAULT_COUNTRY_CODE = "91";

/** Normalise a phone number to E.164, or null when it can't be a dialable number. */
export function normalizePhone(raw: string, defaultCountryCode: string = DEFAULT_COUNTRY_CODE): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  s = s.replace(/^(whatsapp|sms|tel):/, "").replace(/@(c\.us|s\.whatsapp\.net)$/, "");
  const hasPlus = s.startsWith("+");
  // Anything other than digits and common separators means it isn't a phone number.
  if (!/^\+?[\d\s().-]+$/.test(s)) return null;
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) return validE164(digits);
  if (digits.startsWith("00")) return validE164(digits.slice(2));

  if (defaultCountryCode === "91") {
    // 10-digit Indian mobile: starts 6–9.
    if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
    // Domestic trunk prefix: 0 + 10 digits (mobile or STD landline, e.g. 022 2412 3456).
    if (/^0\d{10}$/.test(digits)) return `+91${digits.slice(1)}`;
    // Country code typed without '+': 91 + 10-digit mobile.
    if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
    return null;
  }

  // Other default countries: strip a single trunk zero and prefix the country code.
  if (digits.startsWith("0")) digits = digits.slice(1);
  return validE164(`${defaultCountryCode}${digits}`);
}

function validE164(digits: string): string | null {
  // E.164: up to 15 digits, country code never starts with 0. 8 is a practical minimum.
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

export const isE164 = (s: string): boolean => /^\+[1-9]\d{7,14}$/.test(s);

export const isIndianMobile = (e164: string): boolean => /^\+91[6-9]\d{9}$/.test(e164);

/**
 * Can this number receive SMS? Indian numbers must be mobiles (landlines can't);
 * elsewhere we can't tell from the number alone, so assume yes.
 */
export function smsCapable(e164: string): boolean {
  if (!isE164(e164)) return false;
  return e164.startsWith("+91") ? isIndianMobile(e164) : true;
}

/** WhatsApp group chat id as delivered by open-wa (e.g. "120363041234567890@g.us"). Replies only, never alerts. */
export const isWhatsAppGroup = (address: string): boolean => /^[\d-]{6,40}@g\.us$/.test(address);

/**
 * Normalise an inbound/outbound channel address: E.164 for people, the raw id for
 * WhatsApp groups. Returns null for anything else.
 */
export function normalizeAddress(channel: "whatsapp" | "sms", raw: string): string | null {
  const trimmed = raw.trim();
  if (channel === "whatsapp" && isWhatsAppGroup(trimmed)) return trimmed;
  return normalizePhone(trimmed);
}

/** For logs and the audit ledger: never a full number. "+91••••••2345", "group…7890". */
export function maskAddress(address: string): string {
  if (isWhatsAppGroup(address)) return `group…${address.replace(/@g\.us$/, "").slice(-4)}`;
  const digits = address.replace(/\D/g, "");
  if (digits.length < 6) return "••••";
  const indian = address.startsWith("+91");
  const hidden = (indian ? digits.length - 2 : digits.length) - 4;
  return `${indian ? "+91" : "+"}${"•".repeat(Math.max(2, hidden))}${digits.slice(-4)}`;
}

/** Last four digits, for friendly labels like "WhatsApp donor ··2345". */
export const lastFour = (address: string): string => address.replace(/\D/g, "").slice(-4);

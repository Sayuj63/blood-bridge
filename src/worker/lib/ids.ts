const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Short, readable, prefixed IDs (e.g. "REQ-7KQ2M9"). Crypto-random, no ambiguous characters. */
export function newId(prefix: string, length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${out}`;
}

/** 6-digit confirmation code a donor shows at the blood bank desk. */
export function confirmationCode(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return String(n % 1_000_000).padStart(6, "0");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Single-use WhatsApp click-to-chat code, e.g. "K7Q2M9" (no prefix: it is typed after JOIN). */
export const joinCode = (): string => newId("J", 6).slice(2);

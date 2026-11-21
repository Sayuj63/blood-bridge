/**
 * WhatsApp Cloud API bindings, all optional: the app runs with none of them set.
 * Secrets: WA_ACCESS_TOKEN, WA_APP_SECRET, WA_VERIFY_TOKEN (wrangler secret put …).
 * Vars: WA_PHONE_NUMBER_ID, WA_DISPLAY_NUMBER, WA_TEMPLATE_ALERT, WA_PROVIDER (cloud | gateway).
 * `wrangler types` only sees keys that are in .dev.vars / wrangler.jsonc, and marks those
 * required; code reads every WA_* through readWaEnv(), which treats them all as optional.
 */
interface Env {
  WA_ACCESS_TOKEN?: string;
  WA_APP_SECRET?: string;
  WA_VERIFY_TOKEN?: string;
  WA_PHONE_NUMBER_ID?: string;
  WA_DISPLAY_NUMBER?: string;
  WA_TEMPLATE_ALERT?: string;
  WA_PROVIDER?: string;
  /** RAKT connector (optional): secret API key, the bank it belongs to, and an optional base URL. */
  RAKT_API_KEY?: string;
  RAKT_SITE_ID?: string;
  RAKT_BASE_URL?: string;
  /** SMS channel is off unless "true" (no WhatsApp → SMS fallback). */
  SMS_ENABLED?: string;
  /** Turso (libSQL) database. When set, it replaces D1: libsql://<db>-<org>.turso.io + a token secret. */
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

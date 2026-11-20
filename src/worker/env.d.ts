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
}

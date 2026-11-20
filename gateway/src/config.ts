import { existsSync } from "node:fs";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Load gateway/.env if present (Node's built-in loader; real env vars win). */
export function loadEnvFile(): string | null {
  const path = fileURLToPath(new URL("../.env", import.meta.url));
  if (!existsSync(path)) return null;
  process.loadEnvFile(path);
  return path;
}

const bool = z
  .enum(["true", "false", "1", "0", "on", "off", "yes", "no"])
  .transform((v) => ["true", "1", "on", "yes"].includes(v));

const CHANNEL_NAMES = ["whatsapp", "sms", "console"] as const;

const schema = z
  .object({
    BLOOD_BRIDGE_URL: z.url().transform((u) => u.replace(/\/+$/, "")),
    GATEWAY_TOKEN: z.string().min(24, "GATEWAY_TOKEN must be at least 24 characters (and match the Worker's secret)"),
    GATEWAY_ID: z
      .string()
      .regex(/^[\w.:-]{1,64}$/)
      .default(hostname().replace(/[^\w.:-]/g, "-").slice(0, 64) || "gateway"),
    CHANNELS: z
      .string()
      .default("console")
      .transform((s) => [...new Set(s.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean))])
      .pipe(z.array(z.enum(CHANNEL_NAMES)).min(1)),
    POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(2000),
    HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(2000).max(60_000).default(15_000),
    SEND_GAP_MS: z.coerce.number().int().min(0).max(60_000).default(1500),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    CONSOLE_CHANNEL: z.enum(["whatsapp", "sms"]).default("whatsapp"),
    CONSOLE_FROM: z.string().default("+919800000001"),

    WA_SESSION_ID: z.string().regex(/^[\w-]{1,40}$/).default("blood-bridge"),
    WA_SESSION_DIR: z.string().default(".session"),
    WA_HEADLESS: bool.default(true),
    WA_GROUPS: bool.default(true),
    WA_CHROME_PATH: z.string().optional(),

    SMS_MODE: z.enum(["cloud", "local"]).default("cloud"),
    SMS_USERNAME: z.string().default(""),
    SMS_PASSWORD: z.string().default(""),
    SMS_LOCAL_URL: z.url().optional(),
    SMS_CLOUD_URL: z.url().default("https://api.sms-gate.app/3rdparty/v1"),
    SMS_SIM_NUMBER: z.coerce.number().int().min(1).max(4).optional(),
    SMS_WEBHOOK_PORT: z.coerce.number().int().min(0).max(65_535).default(3977),
    SMS_WEBHOOK_PUBLIC_URL: z.url().optional(),
    SMS_WEBHOOK_SIGNING_KEY: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.CHANNELS.includes("console") && c.CHANNELS.length > 1) {
      ctx.addIssue({ code: "custom", path: ["CHANNELS"], message: "Use `console` on its own (it stands in for a real channel)" });
    }
    if (c.CHANNELS.includes("sms")) {
      if (!c.SMS_USERNAME || !c.SMS_PASSWORD) ctx.addIssue({ code: "custom", path: ["SMS_USERNAME"], message: "SMS needs SMS_USERNAME and SMS_PASSWORD from the app" });
      if (c.SMS_MODE === "local" && !c.SMS_LOCAL_URL) ctx.addIssue({ code: "custom", path: ["SMS_LOCAL_URL"], message: "SMS_MODE=local needs SMS_LOCAL_URL (the phone's address)" });
    }
  });

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    // Field names and messages only: never echo values (they may be secrets).
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".") || "config"}: ${i.message}`).join("\n");
    throw new Error(`Invalid gateway configuration:\n${issues}\nSee gateway/.env.example.`);
  }
  return parsed.data;
}

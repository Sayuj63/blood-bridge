/**
 * Blood Bridge messaging gateway.
 *
 *   WhatsApp (open-wa) ─┐                           ┌─ POST /api/gateway/outbox/claim
 *   SMS (Android)      ─┼─ adapters ─ Relay ─HTTPS──┼─ POST /api/gateway/outbox/:id/ack
 *   Console (testing)  ─┘                           ├─ POST /api/gateway/inbound
 *                                                   └─ POST /api/gateway/heartbeat
 *
 * Runs on a laptop or VM and only makes outbound requests, so no tunnel or public IP is needed.
 *   pnpm --dir gateway start            # uses gateway/.env
 *   CHANNELS=console pnpm --dir gateway start
 */
import { BloodBridgeApi } from "./api.ts";
import { loadConfig, loadEnvFile, type Config } from "./config.ts";
import { createLogger, type Logger } from "./log.ts";
import { Relay } from "./relay.ts";
import { ConsoleAdapter } from "./adapters/console.ts";
import type { ChannelAdapter } from "./adapters/types.ts";

const VERSION = "0.1.0";

async function buildAdapters(cfg: Config, log: Logger): Promise<ChannelAdapter[]> {
  const adapters: ChannelAdapter[] = [];
  for (const name of cfg.CHANNELS) {
    if (name === "console") {
      adapters.push(new ConsoleAdapter(cfg.CONSOLE_CHANNEL, cfg.CONSOLE_FROM));
    } else if (name === "whatsapp") {
      // Loaded lazily: open-wa pulls in a headless browser stack that console/SMS runs don't need.
      const { WhatsAppOpenWaAdapter } = await import("./adapters/whatsapp-openwa.ts");
      adapters.push(
        new WhatsAppOpenWaAdapter(
          { sessionId: cfg.WA_SESSION_ID, sessionDir: cfg.WA_SESSION_DIR, headless: cfg.WA_HEADLESS, groups: cfg.WA_GROUPS, chromePath: cfg.WA_CHROME_PATH },
          log.child({ adapter: "open-wa" }),
        ),
      );
    } else if (name === "sms") {
      const { SmsAndroidGatewayAdapter } = await import("./adapters/sms-android.ts");
      adapters.push(
        new SmsAndroidGatewayAdapter(
          {
            mode: cfg.SMS_MODE,
            username: cfg.SMS_USERNAME,
            password: cfg.SMS_PASSWORD,
            baseUrl: cfg.SMS_MODE === "local" ? cfg.SMS_LOCAL_URL! : cfg.SMS_CLOUD_URL,
            simNumber: cfg.SMS_SIM_NUMBER,
            webhookPort: cfg.SMS_WEBHOOK_PORT,
            webhookPublicUrl: cfg.SMS_WEBHOOK_PUBLIC_URL,
            signingKey: cfg.SMS_WEBHOOK_SIGNING_KEY,
          },
          log.child({ adapter: "sms" }),
        ),
      );
    }
  }
  return adapters;
}

/**
 * The gateway owns SIGINT/SIGTERM. open-wa's Effect runtime and Puppeteer each install
 * handlers that exit the process immediately, before our drain and final "offline"
 * heartbeat. We drop any handler added after ours; browser cleanup still runs through
 * WhatsAppOpenWaAdapter.stop() and Puppeteer's own process "exit" hook.
 */
function ownSignals(handler: (signal: NodeJS.Signals) => void): void {
  const ours = new Map<NodeJS.Signals, () => void>();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const listener = () => handler(signal);
    ours.set(signal, listener);
    process.on(signal, listener);
  }
  process.on("newListener", (event, listener) => {
    if ((event === "SIGINT" || event === "SIGTERM") && listener !== ours.get(event)) {
      // newListener fires before the listener is attached; remove it right after.
      queueMicrotask(() => process.removeListener(event, listener as () => void));
    }
  });
}

async function main(): Promise<void> {
  const envFile = loadEnvFile();
  let cfg: Config;
  try {
    cfg = loadConfig();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(2);
  }
  const log = createLogger(cfg.LOG_LEVEL, { service: "blood-bridge-gateway", gatewayId: cfg.GATEWAY_ID });
  log.info("starting", { version: VERSION, channels: cfg.CHANNELS, worker: cfg.BLOOD_BRIDGE_URL, envFile: envFile ? ".env" : "environment only" });

  const api = new BloodBridgeApi(cfg.BLOOD_BRIDGE_URL, cfg.GATEWAY_TOKEN, VERSION);
  const relay = new Relay(
    api,
    await buildAdapters(cfg, log),
    {
      gatewayId: cfg.GATEWAY_ID,
      version: VERSION,
      pollIntervalMs: cfg.POLL_INTERVAL_MS,
      heartbeatIntervalMs: cfg.HEARTBEAT_INTERVAL_MS,
      sendGapMs: cfg.SEND_GAP_MS,
    },
    log,
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      log.warn("second signal: exiting immediately", { signal });
      process.exit(1);
    }
    shuttingDown = true;
    log.info("shutting down", { signal });
    const force = setTimeout(() => {
      log.error("shutdown timed out; exiting");
      process.exit(1);
    }, 15_000);
    force.unref();
    try {
      await relay.stop();
    } finally {
      log.info("stopped");
      process.exit(0);
    }
  };
  ownSignals((signal) => void shutdown(signal));
  process.on("unhandledRejection", (reason) => log.error("unhandled rejection", { error: reason instanceof Error ? reason : new Error(String(reason)) }));

  await relay.start();
  log.info("relay running", { pollIntervalMs: cfg.POLL_INTERVAL_MS });
}

main().catch((err: Error) => {
  process.stderr.write(`Gateway failed to start: ${err.message}\n`);
  process.exit(1);
});

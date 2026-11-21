import { app } from "./app";
import { createDb } from "./db/client";
import { hubStub, remoteHub } from "./deps";
import { autoSyncEraktkosh } from "./services/eraktkosh";
import { mcpApp } from "./mcp";
import { kickWhatsAppCloud } from "./services/messaging-cloud";

export { CityHub } from "./hub";

export default {
  /** /mcp is the remote MCP server (see docs/MCP.md); everything else is the /api app. */
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    return pathname === "/mcp" ? mcpApp.fetch(request, env, ctx) : app.fetch(request, env, ctx);
  },
  /**
   * Cron backstop (every minute): make sure the hub's sweep alarm is armed even if an RPC was
   * lost, drain WhatsApp through the Cloud API (retry backoff, a dropped waitUntil), and pull
   * live stock from e-RaktKosh at most once an hour.
   */
  async scheduled(_controller, env, ctx) {
    kickWhatsAppCloud(env, (p) => ctx.waitUntil(p));
    ctx.waitUntil(autoSyncEraktkosh({ db: createDb(env), env, hub: remoteHub(env), now: Date.now() }));
    await hubStub(env).scheduleSweep(Date.now());
  },
} satisfies ExportedHandler<Env>;

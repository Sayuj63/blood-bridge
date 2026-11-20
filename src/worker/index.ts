import { app } from "./app";
import { hubStub } from "./deps";
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
   * lost, and drain WhatsApp through the Cloud API (retry backoff, a dropped waitUntil).
   */
  async scheduled(_controller, env, ctx) {
    kickWhatsAppCloud(env, (p) => ctx.waitUntil(p));
    await hubStub(env).scheduleSweep(Date.now());
  },
} satisfies ExportedHandler<Env>;

import { app } from "./app";
import { hubStub } from "./deps";
import { mcpApp } from "./mcp";

export { CityHub } from "./hub";

export default {
  /** /mcp is the remote MCP server (see docs/MCP.md); everything else is the /api app. */
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    return pathname === "/mcp" ? mcpApp.fetch(request, env, ctx) : app.fetch(request, env, ctx);
  },
  /** Cron backstop: make sure the hub's sweep alarm is armed even if an RPC was lost. */
  async scheduled(_controller, env) {
    await hubStub(env).scheduleSweep(Date.now());
  },
} satisfies ExportedHandler<Env>;

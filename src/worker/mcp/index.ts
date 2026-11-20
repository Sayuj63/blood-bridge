/**
 * Remote MCP endpoint at /mcp (Streamable HTTP, stateless, JSON responses).
 * Every POST gets its own McpServer + transport bound to fresh Deps, so there is
 * no session state to lose across Worker isolates.
 *
 * Auth: read tools are open. Write tools need MCP_TOKEN, sent as
 * `Authorization: Bearer <token>` or `?token=<token>` (for connectors that can
 * only carry a URL). The ledger actor is `ai:<client>`, from `?client=` or the
 * User-Agent.
 */
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createDb } from "../db/client";
import { remoteHub } from "../deps";
import { sha256Hex } from "../lib/ids";
import type { McpContext } from "./context";
import { buildMcpServer } from "./server";

type McpEnv = { Bindings: Env };

async function tokenMatches(presented: string | undefined, expected: string | undefined): Promise<boolean> {
  if (!presented || !expected) return false;
  // Compare digests so the comparison time doesn't depend on how much of the token matched.
  const [a, b] = await Promise.all([sha256Hex(presented), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clientName(c: Context<McpEnv>): string {
  const explicit = c.req.query("client");
  if (explicit) return explicit.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) || "mcp";
  const ua = (c.req.header("User-Agent") ?? "").toLowerCase();
  if (ua.includes("openai") || ua.includes("chatgpt")) return "chatgpt";
  if (ua.includes("claude") || ua.includes("anthropic")) return "claude";
  if (ua.includes("inspector")) return "inspector";
  return "mcp";
}

const jsonRpcError = (c: Context<McpEnv>, status: 400 | 405 | 500, message: string) =>
  c.json({ jsonrpc: "2.0", error: { code: status === 500 ? -32603 : -32000, message }, id: null }, status);

export const mcpApp = new Hono<McpEnv>();

mcpApp.use(
  "/mcp",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Accept", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-ID"],
    exposeHeaders: ["Mcp-Session-Id", "Mcp-Protocol-Version"],
  }),
);

mcpApp.post("/mcp", async (c) => {
  try {
    const bearer = c.req.header("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const presented = bearer ?? c.req.query("token") ?? undefined;
    const expected = c.env.MCP_TOKEN || undefined;
    const ctx: McpContext = {
      deps: { db: createDb(c.env.DB), env: c.env, hub: remoteHub(c.env), now: Date.now() },
      actor: `ai:${clientName(c)}`,
      authorized: await tokenMatches(presented, expected),
      writesEnabled: Boolean(expected),
    };
    const server = buildMcpServer(ctx);
    const transport = new StreamableHTTPTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const res = await transport.handleRequest(c);
    c.header("Cache-Control", "no-store");
    return res ?? c.body(null, 202);
  } catch (err) {
    // The transport signals protocol errors (bad JSON, wrong Accept, etc.) as HTTPExceptions carrying a JSON-RPC body.
    if (err instanceof HTTPException) return err.getResponse();
    console.error("mcp request failed", err);
    return jsonRpcError(c, 500, "Internal server error");
  }
});

// Stateless server: no standalone SSE stream and no sessions to delete.
mcpApp.on(["GET", "DELETE"], "/mcp", (c) => {
  c.header("Allow", "POST, OPTIONS");
  return jsonRpcError(c, 405, "Method not allowed. This MCP server is stateless; POST JSON-RPC to /mcp.");
});

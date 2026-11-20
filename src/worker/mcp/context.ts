/**
 * Shared plumbing for the MCP server: the per-request context every tool sees,
 * result helpers (text + structuredContent), and error mapping to MCP tool errors.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { sql } from "drizzle-orm";
import { AREAS, SURGE_ZONES, type Area } from "../seed";
import * as schema from "../db/schema";
import type { Deps } from "../deps";
import { AppError } from "../lib/http";

export interface McpContext {
  deps: Deps;
  /** Ledger actor for writes, always `ai:<client>`. */
  actor: string;
  /** Request carried a valid MCP token. */
  authorized: boolean;
  /** The server has an MCP_TOKEN configured at all. */
  writesEnabled: boolean;
}

export type ToolResult = CallToolResult;

export function ok(text: string, data: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text }], structuredContent: data };
}

export function toolError(message: string, data: Record<string, unknown> = {}): ToolResult {
  return { content: [{ type: "text", text: message }], structuredContent: { error: message, ...data }, isError: true };
}

/** Run a tool body; domain errors become actionable tool errors, never a 500. */
export async function guarded(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      return toolError(`${err.message} (${err.code})`, { code: err.code, details: err.details ?? null });
    }
    console.error("mcp tool failed", err);
    return toolError("Blood Bridge hit an internal error running this tool. Try again, or use a read tool to check current state.", {
      code: "internal",
    });
  }
}

/* ── Human-in-the-loop write gate ── */

export const CONFIRM_DESCRIPTION =
  "Set true ONLY after the human user has explicitly approved this exact action in the conversation. Omit or false returns a dry-run preview and changes nothing.";

export function dryRun(text: string, data: Record<string, unknown>): ToolResult {
  return ok(
    `DRY RUN — nothing has changed.\n${text}\n\nAsk the user to confirm. If they approve, call this tool again with the same arguments and confirm: true.`,
    { dryRun: true, ...data },
  );
}

/** Returns an error result when this request may not mutate, else null. */
export async function writeGate(ctx: McpContext): Promise<ToolResult | null> {
  if (!ctx.writesEnabled) {
    return toolError("Write tools are disabled on this server (no MCP_TOKEN configured). Read tools still work.", { code: "writes_disabled" });
  }
  if (!ctx.authorized) {
    return toolError(
      "This action needs the operator token. Reconnect the connector with `Authorization: Bearer <token>` or `?token=<token>` on the /mcp URL. Read tools and dry-run previews work without it.",
      { code: "unauthorized" },
    );
  }
  // Anti-runaway guard: confirmed AI writes per hour, shared across clients. Cleared by demo reset.
  const limit = 60;
  const windowStart = Math.floor(ctx.deps.now / 3_600_000) * 3_600_000;
  const [row] = await ctx.deps.db
    .insert(schema.rateLimits)
    .values({ key: "mcp:write", windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.windowStart],
      set: { count: sql`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count });
  if (row.count > limit) {
    return toolError(`AI write limit reached (${limit} confirmed actions per hour). Ask a human operator to act in the app.`, { code: "rate_limited" });
  }
  return null;
}

/* ── Formatting ── */

export const istTime = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

export const hours = (h: number | null) => (h === null ? "not within 72h" : h <= 0 ? "already out" : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);

/** Default "needed by" from urgency, in minutes from now. */
export const NEEDED_WITHIN_MIN = { critical: 60, urgent: 240, routine: 1440 } as const;

/** Resolve an area by id or loose name ("Kurla", "andheri subway"). Surge zones win ties. */
export function resolveArea(input: string): Area | undefined {
  const q = input.trim().toLowerCase();
  const all = [...SURGE_ZONES, ...AREAS];
  return (
    all.find((a) => a.id.toLowerCase() === q || a.name.toLowerCase() === q) ??
    all.find((a) => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()))
  );
}

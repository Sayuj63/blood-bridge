import { and, asc, desc, eq, lt, type SQL } from "drizzle-orm";
import type { AuditEntryDTO, AuditVerifyDTO } from "../../shared/api";
import { schema } from "../db/client";
import type { Deps } from "../deps";
import { auditDigestInput, GENESIS_HASH } from "../hub";
import { notFound } from "../lib/http";
import { sha256Hex } from "../lib/ids";

type AuditRow = typeof schema.auditLog.$inferSelect;

const toDTO = ({ payload: _, ...row }: AuditRow): AuditEntryDTO => row;

export async function listAudit(deps: Deps, opts: { siteId?: string; before?: number; limit: number }): Promise<AuditEntryDTO[]> {
  const filters: SQL[] = [];
  if (opts.siteId) filters.push(eq(schema.auditLog.siteId, opts.siteId));
  if (opts.before) filters.push(lt(schema.auditLog.seq, opts.before));
  const rows = await deps.db
    .select()
    .from(schema.auditLog)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(schema.auditLog.seq))
    .limit(opts.limit);
  return rows.map(toDTO);
}

/** Recompute every hash from genesis. Any edited, inserted or deleted row breaks the chain. */
export async function verifyAudit(deps: Deps): Promise<AuditVerifyDTO> {
  const rows = await deps.db.select().from(schema.auditLog).orderBy(asc(schema.auditLog.seq));
  let prev = GENESIS_HASH;
  for (const row of rows) {
    const expected = await sha256Hex(auditDigestInput({ ...row, prevHash: prev }));
    if (row.prevHash !== prev || row.hash !== expected) {
      return { ok: false, checked: rows.length, brokenAt: row.seq, headHash: rows.at(-1)?.hash ?? null };
    }
    prev = row.hash;
  }
  return { ok: true, checked: rows.length, brokenAt: null, headHash: rows.at(-1)?.hash ?? null };
}

/**
 * DEMO ONLY: quietly rewrite one historic entry the way an insider might,
 * so judges can watch verification catch it. Reset restores a clean chain.
 */
export async function tamperAudit(deps: Deps, seq?: number): Promise<{ seq: number }> {
  const [target] = await deps.db
    .select()
    .from(schema.auditLog)
    .where(seq ? eq(schema.auditLog.seq, seq) : undefined)
    .orderBy(asc(schema.auditLog.seq))
    .limit(seq ? 1 : 1)
    .offset(seq ? 0 : 1);
  if (!target) throw notFound("Audit entry");
  await deps.db
    .update(schema.auditLog)
    .set({ summary: `${target.summary} [edited]` })
    .where(eq(schema.auditLog.seq, target.seq));
  await deps.hub.publish({ topics: ["audit"], headline: `Ledger entry #${target.seq} was modified outside the system`, tone: "critical" });
  return { seq: target.seq };
}

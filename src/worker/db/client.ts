import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql/web";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

/**
 * Database for this request. Turso (libSQL, hosted SQLite — same dialect, schema and migrations
 * as D1) when TURSO_DATABASE_URL is set; Cloudflare D1 otherwise. Both expose the same Drizzle
 * SQLite query builder (select/insert/update/delete/returning/batch), so services are unchanged;
 * the libSQL instance is typed as the D1 one because only that shared surface is used.
 */
export function createDb(env: Pick<Env, "DB" | "TURSO_DATABASE_URL" | "TURSO_AUTH_TOKEN">): Db {
  if (env.TURSO_DATABASE_URL) {
    return drizzleLibsql({ connection: { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN }, schema }) as unknown as Db;
  }
  return drizzle(env.DB, { schema });
}

/** D1 allows at most 100 bound parameters per statement. */
const MAX_PARAMS = 100;

/** Insert many rows in parameter-safe chunks, sent as one atomic batch. */
export async function insertMany<T extends Record<string, unknown>>(
  db: Db,
  table: Parameters<Db["insert"]>[0],
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]).length;
  const perStatement = Math.max(1, Math.floor(MAX_PARAMS / columns));
  const statements: BatchItem<"sqlite">[] = [];
  for (let i = 0; i < rows.length; i += perStatement) {
    statements.push(db.insert(table).values(rows.slice(i, i + perStatement) as never));
  }
  // Batches are atomic in D1; keep each batch to a sane size.
  for (let i = 0; i < statements.length; i += 50) {
    const chunk = statements.slice(i, i + 50);
    await db.batch(chunk as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
}

export { schema };

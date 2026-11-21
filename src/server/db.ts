import "dotenv/config";
import { Pool } from "pg";
const globalDb = globalThis as unknown as { reachPool?: Pool };
export const db =
  globalDb.reachPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://reach:reach_local_only@localhost:5432/reach",
    max: 8,
  });
if (process.env.NODE_ENV !== "production") globalDb.reachPool = db;
export async function query<T = Record<string, any>>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  return (await db.query(sql, args)).rows;
}
export async function transaction(fn: (q: typeof query) => Promise<void>) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await fn(async (sql, args = []) => (await c.query(sql, args)).rows);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

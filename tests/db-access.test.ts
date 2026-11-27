import { afterAll, describe, expect, it } from 'vitest';
import { query, db } from '../src/server/db';
describe.skipIf(process.env.RUN_DB_TESTS !== 'true')('server-only data access', () => {
  it('protects all application tables with RLS and denies public grants while keeping owner access', async () => {
    const tables = await query<{relname:string;relrowsecurity:boolean}>(`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`);
    expect(tables.length).toBeGreaterThanOrEqual(18);
    expect(tables.every(t=>t.relrowsecurity)).toBe(true);
    const grants = await query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relkind='r' AND a.grantee=0`);
    expect(grants).toEqual([]);
    expect((await query('SELECT id FROM settings LIMIT 1')).length).toBe(1);
  });
});
afterAll(()=>db.end());

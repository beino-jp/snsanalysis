import {afterAll,describe,expect,it} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {claimPasswordLink,sessionVersion,checkSessionVersion} from '../src/server/session-version';
import {query,db} from '../src/server/db';
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('password links and session invalidation',()=>{
 it('allows a link once, invalidates older sessions, and never stores the token or password',async()=>{
  const email='auth-test-'+randomUUID()+'@example.test',token=randomUUID()+randomUUID();
  const sessionId='auth-session:'+createHash('sha256').update(email).digest('hex'),tokenId='auth-setup:'+createHash('sha256').update(token).digest('hex');
  try{
   const old=await sessionVersion(email);expect(await sessionVersion(email)).toBe(old);expect(await checkSessionVersion(email,old)).toBe(true);
   const fresh=await claimPasswordLink(token,email);expect(fresh).not.toBe(old);expect(await checkSessionVersion(email,old)).toBe(false);expect(await checkSessionVersion(email,fresh)).toBe(true);
   await expect(claimPasswordLink(token,email)).rejects.toThrow('LINK_ALREADY_USED');
   const records=await query('SELECT payload FROM settings WHERE id=ANY($1::text[])',[[sessionId,tokenId]]);expect(JSON.stringify(records)).not.toContain(token);
  }finally{await query('DELETE FROM settings WHERE id=ANY($1::text[])',[[sessionId,tokenId]]);}
 });
});
afterAll(()=>db.end());

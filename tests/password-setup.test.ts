import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({getUser:vi.fn(),claim:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:f.getUser}})}));
vi.mock('../src/server/session-version',()=>({claimPasswordLink:f.claim,sessionVersion:vi.fn(),checkSessionVersion:vi.fn()}));
import {finishPasswordSetup} from '../src/server/password-setup';
const token='fake-valid-user-token-for-test';
beforeEach(()=>{
 vi.resetAllMocks();
 for(const[k,v]of Object.entries({NODE_ENV:'test',DEMO_AUTH:'false',DATA_PROVIDER:'mock',LLM_PROVIDER:'mock',SESSION_SECRET:'test-only-signature-key-with-more-than-32-chars',SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test-anon-key',ALLOWED_EMAILS:'tester@example.test'}))vi.stubEnv(k,v);
 f.getUser.mockResolvedValue({data:{user:{email:'tester@example.test',email_confirmed_at:'2026-11-28T00:00:00Z'}},error:null});f.claim.mockResolvedValue('new-version');
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('verifies the bearer with Supabase before setting a password and issues a rotated app session',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal('fetch',fetcher);
 const cookie=await finishPasswordSetup({accessToken:token,password:'a-long-test-password'});
 expect(f.getUser).toHaveBeenCalledWith(token);expect(f.claim).toHaveBeenCalledWith(token,'tester@example.test');
 expect(fetcher).toHaveBeenCalledTimes(1);
 const [url,init]=fetcher.mock.calls[0];expect(url).toBe('https://example.supabase.co/auth/v1/user');expect(init.method).toBe('PUT');expect(init.redirect).toBe('error');expect(init.headers.Authorization).toBe('Bearer '+token);
 const payload=JSON.parse(Buffer.from(cookie.split('.')[0],'base64url').toString());expect(payload.email).toBe('tester@example.test');expect(payload.version).toBe('new-version');expect(JSON.stringify(payload)).not.toContain(token);
});
it('rejects expired, unconfirmed and uninvited users before changing credentials',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 for(const result of [{data:{user:null},error:{message:'token-secret'}},{data:{user:{email:'tester@example.test'}},error:null},{data:{user:{email:'stranger@example.test',email_confirmed_at:'2026-11-28'}},error:null}]){
  f.getUser.mockResolvedValueOnce(result);
  await expect(finishPasswordSetup({accessToken:token,password:'a-long-test-password'})).rejects.toThrow('INVITATION_NOT_ALLOWED');
 }
 expect(fetcher).not.toHaveBeenCalled();expect(f.claim).not.toHaveBeenCalled();
});
it('does not retry ambiguous password updates or expose provider response bodies',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:false,text:()=>Promise.resolve('secret-provider-response')});vi.stubGlobal('fetch',fetcher);
 await expect(finishPasswordSetup({accessToken:token,password:'a-long-test-password'})).rejects.toThrow('PASSWORD_UPDATE_UNCONFIRMED');expect(fetcher).toHaveBeenCalledTimes(1);
});

import {it,expect,vi,afterEach} from 'vitest';
const state=vi.hoisted(()=>({cookie:'',origin:'https://test.example.com',host:'test.example.com',version:'first'}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:state.cookie})}),headers:async()=>({get:(key:string)=>key==='origin'?state.origin:state.host})}));
vi.mock('../src/server/db',()=>({query:vi.fn(async()=>[{payload:{version:state.version}}]),transaction:vi.fn()}));
import {requireAuth,requireMutation,requireInternalAuth,signSession} from '../src/server/auth';
afterEach(()=>vi.unstubAllEnvs());
function setup(){
 vi.stubEnv('NODE_ENV','test');vi.stubEnv('DEMO_AUTH','false');vi.stubEnv('DATA_PROVIDER','mock');vi.stubEnv('LLM_PROVIDER','mock');vi.stubEnv('SESSION_SECRET','test-secret-long-enough-for-validation');vi.stubEnv('ALLOWED_EMAILS','tester@example.com');vi.stubEnv('APP_ORIGIN','https://test.example.com');
 state.version='first';state.cookie=signSession('tester@example.com','first');state.origin='https://test.example.com';state.host='test.example.com';
}
it('rechecks the email allowlist for an existing session',async()=>{
 setup();expect(await requireAuth()).toBe('tester@example.com');
 vi.stubEnv('ALLOWED_EMAILS','another@example.com');await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
});
it('rejects a different request origin even when a forwarded host matches it',async()=>{
 setup();await expect(requireMutation()).resolves.toBe("tester@example.com");
 state.origin='https://other.example.com';state.host='other.example.com';
 await expect(requireMutation()).rejects.toThrow('FORBIDDEN');
});

it('prevents invited clients from reading internal raw-data routes and rechecks admin revocation',async()=>{
 setup();vi.stubEnv('ADMIN_EMAILS','');await expect(requireInternalAuth()).rejects.toThrow('FORBIDDEN');
 vi.stubEnv('ADMIN_EMAILS','tester@example.com');expect(await requireInternalAuth()).toBe('tester@example.com');
 vi.stubEnv('ADMIN_EMAILS','');await expect(requireInternalAuth()).rejects.toThrow('FORBIDDEN');
});

it('rejects earlier application cookies after password setup rotates the session version',async()=>{
 setup();expect(await requireAuth()).toBe('tester@example.com');
 state.version='rotated';await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
 state.cookie=signSession('tester@example.com','rotated');expect(await requireAuth()).toBe('tester@example.com');
});

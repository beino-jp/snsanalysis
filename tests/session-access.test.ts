import {it,expect,vi,afterEach} from 'vitest';
const state=vi.hoisted(()=>({cookie:'',origin:'https://test.example.com',host:'test.example.com'}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:state.cookie})}),headers:async()=>({get:(key:string)=>key==='origin'?state.origin:state.host})}));
import {requireAuth,requireMutation,signSession} from '../src/server/auth';
afterEach(()=>vi.unstubAllEnvs());
function setup(){
 vi.stubEnv('NODE_ENV','test');vi.stubEnv('DEMO_AUTH','false');vi.stubEnv('DATA_PROVIDER','mock');vi.stubEnv('LLM_PROVIDER','mock');vi.stubEnv('SESSION_SECRET','test-secret-long-enough-for-validation');vi.stubEnv('ALLOWED_EMAILS','tester@example.com');vi.stubEnv('APP_ORIGIN','https://test.example.com');
 state.cookie=signSession('tester@example.com');state.origin='https://test.example.com';state.host='test.example.com';
}
it('rechecks the email allowlist for an existing session',async()=>{
 setup();expect(await requireAuth()).toBe('tester@example.com');
 vi.stubEnv('ALLOWED_EMAILS','another@example.com');await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
});
it('rejects a different request origin even when a forwarded host matches it',async()=>{
 setup();await expect(requireMutation()).resolves.toBeUndefined();
 state.origin='https://other.example.com';state.host='other.example.com';
 await expect(requireMutation()).rejects.toThrow('FORBIDDEN');
});

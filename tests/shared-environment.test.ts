import {it,expect,afterEach,vi} from 'vitest';
import {assertConfiguration} from '../src/server/config';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LoginForm from '../src/components/login-form';
afterEach(()=>vi.unstubAllEnvs());
function shared(){
 for(const [k,v] of Object.entries({NODE_ENV:'production',DATA_PROVIDER:'mock',LLM_PROVIDER:'mock',DEMO_AUTH:'false',APP_ORIGIN:'https://test.example.com',DATABASE_URL:'postgresql://test',SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test-key',ALLOWED_EMAILS:'tester@example.com',SESSION_SECRET:'a-unique-session-secret-that-has-over-32-characters'}))vi.stubEnv(k,v);
}
it('allows mocked providers with invitation auth but never demo credentials on a shared production server',()=>{
 shared();expect(()=>assertConfiguration()).not.toThrow();
 vi.stubEnv('DEMO_AUTH','true');expect(()=>assertConfiguration()).toThrow();
});
it('blocks HTTP, missing allowlist, example signing keys and missing database in shared mode',()=>{
 for(const [key,value] of [['APP_ORIGIN','http://test.example.com'],['ALLOWED_EMAILS',''],['SESSION_SECRET','replace-with-at-least-32-random-characters'],['DATABASE_URL','']]){
  shared();vi.stubEnv(key,value);expect(()=>assertConfiguration()).toThrow();
 }
});
it('does not show demo passwords or prefill a demo email in the normal invite login',()=>{
 const html=renderToStaticMarkup(createElement(LoginForm,{}));
 expect(html).not.toContain('local-demo');expect(html).not.toContain('demo@reach.local');
 expect(html).toContain('招待された');
 const demo=renderToStaticMarkup(createElement(LoginForm,{demo:true}));expect(demo).toContain('local-demo');
});

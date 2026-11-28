import {afterEach,expect,it,vi} from 'vitest';
import {authStep,reportAuthFailure} from '../src/server/auth-diagnostics';
afterEach(()=>vi.restoreAllMocks());
it('retains the innermost failed step without logging SQL, account details or credentials',async()=>{
 const logger=vi.spyOn(console,'error').mockImplementation(()=>{});
 const failure=Object.assign(new Error('postgres://user:password@db.example.test SELECT user@example.test token-fixture'),{code:'28P01',detail:'secret detail'});
 try{await authStep('session_cookie',()=>authStep('database_session',()=>{throw failure;}));}
 catch(error){reportAuthFailure('password_setup',error);}
 expect(logger).toHaveBeenCalledExactlyOnceWith(JSON.stringify({event:'AUTH_FLOW_FAILED',operation:'password_setup',stage:'database_session',reason:'28P01'}));
});
it('redacts arbitrary messages, provider codes, nested causes and thrown values',async()=>{
 const logger=vi.spyOn(console,'error').mockImplementation(()=>{});
 for(const value of [Object.assign(new Error('secret-token'),{code:'secret-provider-code',cause:new Error('secret-password')}),'secret-string',{message:'secret-account'}]){
  try{await authStep('supabase_verify',()=>{throw value;});}catch(error){reportAuthFailure('password_setup',error);}
 }
 expect(logger).toHaveBeenCalledTimes(3);
 for(const [message]of logger.mock.calls)expect(JSON.parse(message)).toEqual({event:'AUTH_FLOW_FAILED',operation:'password_setup',stage:'supabase_verify',reason:'UNCLASSIFIED'});
});
it('preserves known failure identifiers and does not retry or log successful operations',async()=>{
 const logger=vi.spyOn(console,'error').mockImplementation(()=>{});
 const attempt=vi.fn(()=>{throw Error('LINK_ALREADY_USED');});
 await expect(authStep('database_session',attempt)).rejects.toMatchObject({stage:'database_session',reason:'LINK_ALREADY_USED'});
 expect(attempt).toHaveBeenCalledTimes(1);
 await expect(authStep('supabase_login',()=>42)).resolves.toBe(42);
 expect(logger).not.toHaveBeenCalled();
});

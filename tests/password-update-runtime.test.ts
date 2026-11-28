import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it} from 'vitest';
import ts from 'typescript';
import {Miniflare,Response as MockResponse,convertV4MiniflareOptions} from 'miniflare';

let runtime:Miniflare;
let status=200;
let requests:{url:string;method:string;authorization:string|null;body:string}[]=[];
beforeAll(()=>{
 // Execute the production helper in workerd; replacing global fetch in Node
 // would miss Workers' unsupported redirect:error mode.
 const source=ts.transpileModule(readFileSync('src/server/password-update.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 runtime=new Miniflare(convertV4MiniflareOptions({
  modules:true,compatibilityDate:'2026-11-27',compatibilityFlags:['nodejs_compat'],
  script:source+`\nexport default {async fetch(){try{await updateSupabasePassword('https://auth-fixture.invalid','fixture-key','fixture-bearer','fixture-only-password');return Response.json({ok:true});}catch(error){return Response.json({ok:false,error:error.message});}}};`,
  outboundService:async request=>{
   requests.push({url:request.url,method:request.method,authorization:request.headers.get('authorization'),body:await request.text()});
   if(request.url!=='https://auth-fixture.invalid/auth/v1/user')throw Error('UNEXPECTED_OUTBOUND_REQUEST');
   return new MockResponse(status===200?'{}':'fixture-provider-response-must-not-be-exposed',{
    status,headers:status>=300&&status<400?{location:'https://redirect-fixture.invalid/credential-target'}:{},
   });
  },
 }));
});
afterAll(async()=>{await runtime?.dispose();});
it('sends a password update successfully in the actual Workers runtime',async()=>{
 status=200;requests=[];
 const response=await runtime.dispatchFetch('https://local-test.invalid/');
 expect(await response.json()).toEqual({ok:true});
 expect(requests).toEqual([{url:'https://auth-fixture.invalid/auth/v1/user',method:'PUT',authorization:'Bearer fixture-bearer',body:JSON.stringify({password:'fixture-only-password'})}]);
});
it.each([302,307,400,503])('rejects HTTP %s without following, retrying or exposing the provider body',async code=>{
 status=code;requests=[];
 const response=await runtime.dispatchFetch('https://local-test.invalid/');
 expect(await response.json()).toEqual({ok:false,error:'PASSWORD_UPDATE_UNCONFIRMED'});
 expect(requests).toHaveLength(1);
 expect(requests[0].url).toBe('https://auth-fixture.invalid/auth/v1/user');
});

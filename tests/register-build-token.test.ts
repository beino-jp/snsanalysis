import {expect,it,vi} from 'vitest';
import {registerBuildToken} from '../scripts/register-cloudflare-build-token.mjs';
const token='fake_local_only_token_not_a_secret';
const id='a'.repeat(32),account='b'.repeat(32);
const ok=(result:unknown)=>({ok:true,status:200,json:async()=>({success:true,result})});
function replies(list:unknown[]){return vi.fn().mockResolvedValueOnce(ok({id,status:'active'})).mockResolvedValueOnce(ok([{id:account,name:'beino'}])).mockResolvedValueOnce(ok(list));}
it('registers only the verified token in the selected account and leaves other build tokens untouched',async()=>{
 const fetcher=replies([{build_token_name:'another-app',cloudflare_token_id:'c'.repeat(32)}]).mockResolvedValueOnce(ok({cloudflare_token_id:id,build_token_name:'beino-insight-test-build',build_token_uuid:'fake-uuid'}));
 expect(await registerBuildToken(token,fetcher)).toContain('完了');
 expect(fetcher).toHaveBeenCalledTimes(4);
 const [url,init]=fetcher.mock.calls[3];expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/'+account+'/builds/tokens');expect(init.method).toBe('POST');expect(init.redirect).toBe('error');
 expect(JSON.parse(init.body)).toEqual({build_token_name:'beino-insight-test-build',build_token_secret:token,cloudflare_token_id:id});
 expect(fetcher.mock.calls.every(([url,init])=>url.startsWith('https://api.cloudflare.com/client/v4/')&&['GET','POST'].includes(init.method))).toBe(true);
});
it('does not duplicate registration or overwrite another token with the same name',async()=>{
 const same=replies([{cloudflare_token_id:id,build_token_name:'beino-insight-test-build'}]);expect(await registerBuildToken(token,same)).toContain('登録済み');expect(same).toHaveBeenCalledTimes(3);
 const collision=replies([{cloudflare_token_id:'c'.repeat(32),build_token_name:'beino-insight-test-build'}]);await expect(registerBuildToken(token,collision)).rejects.toThrow('同名');expect(collision).toHaveBeenCalledTimes(3);
});
it('does not retry or expose provider response bodies on authorization errors',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({error:token})});
 await expect(registerBuildToken(token,fetcher)).rejects.toThrow('権限');expect(fetcher).toHaveBeenCalledTimes(1);
 try{await registerBuildToken(token,fetcher);}catch(error){expect((error as Error).message).not.toContain(token);}
});

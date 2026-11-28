import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {assertConfiguration} from './config';
import {signSession} from './auth';
import {claimPasswordLink} from './session-version';
export const passwordInput=z.object({accessToken:z.string().min(20).max(6000),password:z.string().min(12).max(128)});
export async function finishPasswordSetup(raw:unknown){
 assertConfiguration();
 if(process.env.DEMO_AUTH!=='false')throw Error('INVITATION_AUTH_REQUIRED');
 const {accessToken,password}=passwordInput.parse(raw);
 const base=new URL(process.env.SUPABASE_URL!);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/')throw Error('INVALID_AUTH_ORIGIN');
 const client=createClient(base.origin,process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getUser(accessToken);
 const email=data.user?.email?.toLowerCase();
 if(error||!email||!data.user?.email_confirmed_at||!(process.env.ALLOWED_EMAILS??'').split(',').map(e=>e.trim().toLowerCase()).includes(email))throw Error('INVITATION_NOT_ALLOWED');
 const version=await claimPasswordLink(accessToken,email);
 // Same authenticated endpoint as supabase-js updateUser, without persisting a refresh token.
 const response=await fetch(base.origin+'/auth/v1/user',{method:'PUT',redirect:'error',headers:{apikey:process.env.SUPABASE_ANON_KEY!,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('PASSWORD_UPDATE_UNCONFIRMED');
 return signSession(email,version);
}

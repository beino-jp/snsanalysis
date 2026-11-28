import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {assertConfiguration} from './config';
import {signSession} from './auth';
import {claimPasswordLink} from './session-version';
import {authStep} from './auth-diagnostics';
import {updateSupabasePassword} from './password-update';
export const passwordInput=z.object({accessToken:z.string().min(20).max(6000),password:z.string().min(12).max(128)});
export async function finishPasswordSetup(raw:unknown){
 await authStep('configuration',assertConfiguration);
 if(process.env.DEMO_AUTH!=='false')throw Error('INVITATION_AUTH_REQUIRED');
 const {accessToken,password}=await authStep('input',()=>passwordInput.parse(raw));
 const base=await authStep('configuration',()=>{
 const base=new URL(process.env.SUPABASE_URL!);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/')throw Error('INVALID_AUTH_ORIGIN');
 return base;
 });
 const user=await authStep('supabase_verify',async()=>{
 const client=createClient(base.origin,process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getUser(accessToken);
 if(error||!data.user)throw Error('INVITATION_NOT_ALLOWED');
 return data.user;
 });
 const email=await authStep('invitation_access',()=>{
 const email=user.email?.toLowerCase();
 if(!email||!user.email_confirmed_at||!(process.env.ALLOWED_EMAILS??'').split(',').map(e=>e.trim().toLowerCase()).includes(email))throw Error('INVITATION_NOT_ALLOWED');
 return email;
 });
 const version=await authStep('database_session',()=>claimPasswordLink(accessToken,email));
 // Same authenticated endpoint as supabase-js updateUser, without persisting a refresh token.
 await authStep('password_update',()=>updateSupabasePassword(base.origin,process.env.SUPABASE_ANON_KEY!,accessToken,password));
 return authStep('session_cookie',()=>signSession(email,version));
}

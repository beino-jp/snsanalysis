import {createHash,randomUUID} from 'node:crypto';
import {query,transaction} from './db';
const sessionKey=(email:string)=>'auth-session:'+createHash('sha256').update(email.toLowerCase()).digest('hex');
export async function sessionVersion(email:string){
 const rows=await query("INSERT INTO settings(id,payload) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id RETURNING payload",[sessionKey(email),JSON.stringify({version:randomUUID()})]);
 return String(rows[0].payload.version);
}
export async function checkSessionVersion(email:string,version:unknown){
 if(typeof version!=='string')return false;
 const rows=await query('SELECT payload FROM settings WHERE id=$1',[sessionKey(email)]);
 return rows[0]?.payload.version===version;
}
export async function claimPasswordLink(token:string,email:string){
 const key='auth-setup:'+createHash('sha256').update(token).digest('hex');
 const version=randomUUID();
 await transaction(async q=>{
  const claimed=await q('INSERT INTO settings(id,payload) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[key,JSON.stringify({kind:'password-link',createdAt:new Date().toISOString()})]);
  if(!claimed.length)throw Error('LINK_ALREADY_USED');
  // Password changes invalidate older application cookies before the external update.
  await q('INSERT INTO settings(id,payload) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload',[sessionKey(email),JSON.stringify({version})]);
 });
 return version;
}

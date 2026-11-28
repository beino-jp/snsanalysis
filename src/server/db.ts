import 'dotenv/config';
import {AsyncLocalStorage} from 'node:async_hooks';
import {Client,Pool} from 'pg';
// Workflows supply their own binding. No client/connection is reused across Worker requests.
const context=new AsyncLocalStorage<string>();
const globalDb=globalThis as unknown as {reachPool?:Pool};
let pool:Pool|undefined;
function localPool(){
 pool??=globalDb.reachPool??new Pool({connectionString:process.env.DATABASE_URL??'postgresql://reach:reach_local_only@localhost:5432/reach',max:8,connectionTimeoutMillis:10000});
 if(process.env.NODE_ENV!=='production')globalDb.reachPool=pool;
 return pool;
}
export function withDatabaseUrl<T>(url:string,operation:()=>Promise<T>){
 if(!/^postgres(?:ql)?:\/\//.test(url))throw Error('DATABASE_BINDING_MISSING');
 return context.run(url,operation);
}
async function workerUrl(){
 const supplied=context.getStore();if(supplied)return supplied;
 if(process.env.DEPLOY_TARGET!=='cloudflare')return null;
 const {getCloudflareContext}=await import('@opennextjs/cloudflare');
 const {env}=await getCloudflareContext({async:true});
 const url=(env as {HYPERDRIVE?:{connectionString:string}}).HYPERDRIVE?.connectionString;
 if(!url)throw Error('DATABASE_BINDING_MISSING');
 return url;
}
function workerClient(url:string){
 const client=new Client({connectionString:url,connectionTimeoutMillis:10000});
 // pg-cloudflare can report socket shutdown after end(); keep it handled.
 // Errors during connect/query still reject the corresponding operation.
 client.on('error',()=>{});
 return client;
}
export const db={async end(){if(pool)await pool.end();}};
export async function query<T=Record<string,any>>(sql:string,args:unknown[]=[]):Promise<T[]>{
 const url=await workerUrl();
 if(!url)return (await localPool().query(sql,args)).rows;
 const client=workerClient(url);
 try{await client.connect();return (await client.query(sql,args)).rows;}finally{await client.end();}
}
export async function transaction(fn:(q:typeof query)=>Promise<void>){
 const url=await workerUrl();
 const client=url?workerClient(url):await localPool().connect();
 try{
  if(url)await (client as Client).connect();
  await client.query('BEGIN');
  await fn(async(sql,args=[]) => (await client.query(sql,args)).rows);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
 finally{if(url)await (client as Client).end();else (client as import('pg').PoolClient).release();}
}

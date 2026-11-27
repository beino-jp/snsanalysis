import { randomUUID } from 'node:crypto';
import { transaction, query } from '../db';
import { z } from 'zod';
import { validateUrl } from '../jobs';
export const LIVE_CEILING_YEN = 300;
export const liveRequest = z.object({url:z.string().max(500),requestKey:z.string().uuid(),confirmed:z.literal(true)});
export function liveLimits() {
  const monthly = Number(process.env.LIVE_MONTHLY_API_BUDGET_YEN);
  if (process.env.DEMO_AUTH !== 'false' || (process.env.SESSION_SECRET?.length??0)<32 || process.env.LIVE_ANALYSIS_ENABLED !== 'true' || !Number.isInteger(monthly) || monthly < 300 || monthly > 6000) throw Error('LIVE_DISABLED');
  if ((process.env.OPENAI_MODEL ?? 'gpt-4.1-mini') !== 'gpt-4.1-mini' || Number(process.env.OPENAI_INPUT_USD_PER_MILLION) !== 0.4 || Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION) !== 1.6) throw Error('PRICING_REVIEW_REQUIRED');
  if (!process.env.APIFY_TOKEN || !process.env.OPENAI_API_KEY) throw Error('LIVE_DISABLED');
  return {monthly};
}
export function liveUrl(value:string){
  const url=validateUrl(value);
  if (!new URL(url).pathname.startsWith('/p/')) throw Error('POST_URL_REQUIRED');
  return url;
}
export async function reserveLive(owner:string,input:z.infer<typeof liveRequest>) {
  const {monthly}=liveLimits(),url=liveUrl(input.url);
  const email=owner.toLowerCase();
  const period=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());
  let result={id:'',created:false};
  await transaction(async q=>{
    await q('INSERT INTO live_budget_months(period) VALUES($1) ON CONFLICT DO NOTHING',[period]);
    const ledger=(await q('SELECT * FROM live_budget_months WHERE period=$1 FOR UPDATE',[period]))[0];
    const old=(await q('SELECT id,url FROM live_analyses WHERE owner_email=$1 AND request_key=$2',[email,input.requestKey]))[0];
    if(old){if(old.url!==url)throw Error('REQUEST_KEY_CONFLICT');result={id:old.id,created:false};return;}
    const active=(await q("SELECT id FROM live_analyses WHERE owner_email=$1 AND url=$2 AND status NOT IN ('completed','cancelled') LIMIT 1",[email,url]))[0];
    if(active){result={id:active.id,created:false};return;}
    if(ledger.spent_yen+ledger.reserved_yen+LIVE_CEILING_YEN>monthly)throw Error('MONTHLY_BUDGET_LIMIT');
    const id=randomUUID();
    await q('INSERT INTO live_analyses(id,owner_email,request_key,url,period,ceiling_yen) VALUES($1,$2,$3,$4,$5,$6)',[id,email,input.requestKey,url,period,LIVE_CEILING_YEN]);
    await q('UPDATE live_budget_months SET reserved_yen=reserved_yen+$2 WHERE period=$1',[period,LIVE_CEILING_YEN]);
    result={id,created:true};
  });
  return result;
}
export async function settleLive(id:string,costUsd:number,report:unknown){
  if(!Number.isFinite(costUsd)||costUsd<0)throw Error('COST_UNKNOWN');
  const yen=Math.ceil(costUsd*300);
  await transaction(async q=>{
    const r=(await q('SELECT * FROM live_analyses WHERE id=$1 FOR UPDATE',[id]))[0];
    if(!r)throw Error('NOT_FOUND');
    if(r.actual_yen!==null)return;
    await q('UPDATE live_budget_months SET reserved_yen=reserved_yen-$2,spent_yen=spent_yen+$3 WHERE period=$1',[r.period,r.ceiling_yen,yen]);
    await q("UPDATE live_analyses SET status=$2,actual_yen=$3,cost_usd=$4,report=$5,checkpoint='{}',completed_at=now() WHERE id=$1",[id,yen>r.ceiling_yen?'budget_stopped':'completed',yen,costUsd,JSON.stringify(report)]);
  });
}
export async function ownedLive(owner:string,id?:string){
  return query(`SELECT id,url,status,ceiling_yen,actual_yen,cost_usd,report,error,created_at,completed_at FROM live_analyses WHERE owner_email=$1 ${id?'AND id=$2':''} ORDER BY created_at DESC LIMIT 50`,id?[owner.toLowerCase(),id]:[owner.toLowerCase()]);
}

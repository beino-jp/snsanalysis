import { afterAll,afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { query,db } from '../src/server/db';
import { liveLimits,reserveLive,settleLive,ownedLive } from '../src/server/live/budget';
import { paidOnce } from '../src/server/live/pipeline';
function config(){
  for(const [k,v] of Object.entries({LIVE_ANALYSIS_ENABLED:'true',LIVE_MONTHLY_API_BUDGET_YEN:'300',DEMO_AUTH:'false',SESSION_SECRET:'local-test-only-32-character-secret',APIFY_TOKEN:'test',OPENAI_API_KEY:'test',OPENAI_MODEL:'gpt-4.1-mini',OPENAI_INPUT_USD_PER_MILLION:'0.4',OPENAI_OUTPUT_USD_PER_MILLION:'1.6'}))vi.stubEnv(k,v);
}
afterEach(()=>vi.unstubAllEnvs());
it('refuses live analysis without explicit enablement, reviewed prices and invitation-only authentication',()=>{
  config();expect(()=>liveLimits()).not.toThrow();
  for(const [key,value] of [['DEMO_AUTH','true'],['LIVE_ANALYSIS_ENABLED','false'],['LIVE_MONTHLY_API_BUDGET_YEN','10000'],['OPENAI_MODEL','another-model'],['OPENAI_INPUT_USD_PER_MILLION','1']]){
    config();vi.stubEnv(key,value);expect(()=>liveLimits()).toThrow();
  }
});
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('live budget and durable intent',()=>{
  const owner=`budget-${randomUUID()}@example.test`;
  // Isolate ledger balances transactionally from unrelated fixture jobs.
  let period:string,old:{spent_yen:number;reserved_yen:number}|undefined;
  beforeEach(async()=>{
    config();period=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());
    old=(await query<any>('SELECT * FROM live_budget_months WHERE period=$1',[period]))[0];
    await query('INSERT INTO live_budget_months(period) VALUES($1) ON CONFLICT(period) DO UPDATE SET spent_yen=0,reserved_yen=0',[period]);
  });
  afterEach(async()=>{
    await query('DELETE FROM live_analyses WHERE owner_email=$1',[owner]);
    if(old)await query('UPDATE live_budget_months SET spent_yen=$2,reserved_yen=$3 WHERE period=$1',[period,old.spent_yen,old.reserved_yen]);
    else await query('DELETE FROM live_budget_months WHERE period=$1',[period]);
  });
  const request=(tag:string)=>({url:`https://www.instagram.com/p/TEST_${tag}/`,requestKey:randomUUID(),confirmed:true as const});
  it('atomically admits only one competing reservation, never double-charges duplicate requests, and enforces ownership',async()=>{
    const a=request('A'),b=request('B');
    const results=await Promise.allSettled([reserveLive(owner,a),reserveLive(owner,b)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const winner=results[0].status==='fulfilled'?a:b;
    const first=await reserveLive(owner,winner),again=await reserveLive(owner,winner);
    expect(again.id).toBe(first.id);expect(again.created).toBe(false);
    const samePost=await reserveLive(owner,{...winner,requestKey:randomUUID()});expect(samePost.id).toBe(first.id);
    expect(await ownedLive('unrelated@example.test',first.id)).toEqual([]);
    const ledger=(await query('SELECT * FROM live_budget_months WHERE period=$1',[period]))[0];expect(ledger.reserved_yen).toBe(300);
    await settleLive(first.id,0.1,{test:true});await settleLive(first.id,0.1,{test:true});
    const settled=(await query('SELECT * FROM live_budget_months WHERE period=$1',[period]))[0];expect(settled.spent_yen).toBe(30);expect(settled.reserved_yen).toBe(0);
  });
  it('never retries an ambiguous paid call and retains its reserved budget',async()=>{
    const {id}=await reserveLive(owner,request('C'));
    const provider=vi.fn().mockRejectedValue(Error('network disconnected'));
    await expect(paidOnce(id,'acquire',provider)).rejects.toThrow();
    await expect(paidOnce(id,'acquire',provider)).rejects.toThrow('PAID_OPERATION_UNCONFIRMED');
    expect(provider).toHaveBeenCalledTimes(1);
    const ledger=(await query('SELECT * FROM live_budget_months WHERE period=$1',[period]))[0];expect(ledger.reserved_yen).toBe(300);
  });
});
afterAll(()=>db.end());

import {afterAll,afterEach,describe,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {query,db} from '../src/server/db';
const calls=vi.hoisted(()=>({probe:vi.fn(),ai:vi.fn()}));
vi.mock('../scripts/lib/instagram-probe.mjs',async importOriginal=>{
  const real=await importOriginal<any>();return {...real,executeProbe:calls.probe};
});
vi.mock('openai',()=>({default:class {chat={completions:{create:calls.ai}};}}));
import {reserveLive} from '../src/server/live/budget';
import {runLiveStage} from '../src/server/live/pipeline';
import {liveView} from '../src/server/live/view';
afterEach(()=>vi.unstubAllEnvs());
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('real pipeline with fake external services',()=>{
 it('checkpoints all stages, excludes the post owner, preserves unknowns, deletes raw checkpoints on completion and settles once',async()=>{
  for(const[k,v]of Object.entries({DEMO_AUTH:'false',SESSION_SECRET:'local-test-only-32-character-secret',LIVE_ANALYSIS_ENABLED:'true',LIVE_MONTHLY_API_BUDGET_YEN:'6000',APIFY_TOKEN:'test',OPENAI_API_KEY:'test',OPENAI_MODEL:'gpt-4.1-mini',OPENAI_INPUT_USD_PER_MILLION:'0.4',OPENAI_OUTPUT_USD_PER_MILLION:'1.6'}))vi.stubEnv(k,v);
  const owner=`pipeline-${randomUUID()}@example.test`;
  const period=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());
  const previous=(await query('SELECT * FROM live_budget_months WHERE period=$1',[period]))[0];
  const {id}=await reserveLive(owner,{url:'https://www.instagram.com/p/FIXTURE_ONLY/',requestKey:randomUUID(),confirmed:true});
  calls.probe.mockImplementation(async(_client,plan,journal,save,onItems)=>{
    for(const step of plan.steps){
      if(step.key==='post'){
        await onItems('post',[{ownerUsername:'PostOwner'}]);
        journal.runs.push({key:'post',actor:step.actor,status:'verified',cleanup:'deleted',costUsd:0.005,summary:{postRecords:1,displayedLikes:100,displayedComments:50}});
      }else if(step.key==='comments'){
        await onItems('comments',[{ownerUsername:'POSTOWNER',text:'own comment'},{ownerUsername:'PublicPerson',text:'hello'},{ownerUsername:'PrivatePerson',text:'nice'}]);
        journal.runs.push({key:'comments',actor:step.actor,status:'verified',cleanup:'deleted',costUsd:0.01,summary:{commentRecords:3,uniqueCommenters:3}});
      }else{
        await onItems('profiles',[{username:'publicperson',biography:'旅行が好きです',private:false,latestPosts:[]},{username:'privateperson',private:true,biography:'not used'}]);
        journal.runs.push({key:'profiles',status:'verified',cleanup:'deleted',costUsd:0.02});
      }
      await save();
    }
    journal.status='completed';await save();
  });
  const unknown={value:'不明',confidence:0,reason:'明示情報なし',evidence:[]};
  calls.ai.mockResolvedValue({usage:{prompt_tokens:100,completion_tokens:100},choices:[{finish_reason:'stop',message:{content:JSON.stringify({username:'publicperson',status:'analyzed',gender:unknown,age:unknown,interests:[{value:'旅行',confidence:0.8,reason:'本人の記述',evidence:['旅行が好きです']}],description:''})}}]});
  try{
    await runLiveStage(id,'acquire');await runLiveStage(id,'acquire'); // replay cannot reacquire
    await runLiveStage(id,'profiles');
    for(let i=0;i<20;i++)await runLiveStage(id,i);
    await runLiveStage(id,'finish');await runLiveStage(id,'finish');
    const row=(await query('SELECT * FROM live_analyses WHERE id=$1',[id]))[0];
    expect(row.status).toBe('completed');expect(row.checkpoint).toEqual({});
    expect(row.actual_yen).toBe(11);expect(calls.probe).toHaveBeenCalledTimes(2);expect(calls.ai).toHaveBeenCalledTimes(1);
    const view=liveView(row);expect(view.report?.analyzedPeople).toBe(2);expect(view.report?.gender).toEqual({'不明':2});expect(view.report?.privatePeople).toBe(1);expect(view.report?.interests).toEqual([{label:'旅行',count:1}]);
    expect(JSON.stringify(view)).not.toContain('旅行が好きです');expect(JSON.stringify(view)).not.toContain('publicperson');
  }finally{
    await query('DELETE FROM live_analyses WHERE id=$1',[id]);
    if(previous)await query('UPDATE live_budget_months SET spent_yen=$2,reserved_yen=$3 WHERE period=$1',[period,previous.spent_yen,previous.reserved_yen]);
    else await query('DELETE FROM live_budget_months WHERE period=$1',[period]);
  }
 });
});
afterAll(()=>db.end());

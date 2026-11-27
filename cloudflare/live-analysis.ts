import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { withDatabaseUrl } from '../src/server/db';
import { runLiveStage, stopLive } from '../src/server/live/pipeline';
interface Env {HYPERDRIVE:{connectionString:string}}
export class LiveAnalysisWorkflow extends WorkflowEntrypoint<Env,{id:string}>{
  async run(event:WorkflowEvent<{id:string}>,step:WorkflowStep){
    const id=event.payload.id;
    if(!/^[0-9a-f-]{36}$/.test(id))throw Error('INVALID_JOB_ID');
    const db=<T>(fn:()=>Promise<T>)=>withDatabaseUrl(this.env.HYPERDRIVE.connectionString,fn);
    try{
      for(const stage of ['acquire','profiles',...Array.from({length:20},(_,i)=>i),'finish'] as const){
        await step.do(`live-${stage}`,{retries:{limit:0,delay:'1 second'},timeout:'5 minutes'},async()=>{
          await db(()=>runLiveStage(id,stage));
          return {saved:true}; // No profile text, usernames, or response bodies in Workflow state.
        });
      }
      return {status:'completed'};
    }catch{
      await db(()=>stopLive(id));
      throw Error('LIVE_ANALYSIS_STOPPED');
    }
  }
}

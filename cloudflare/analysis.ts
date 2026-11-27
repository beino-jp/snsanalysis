import {WorkflowEntrypoint,type WorkflowEvent,type WorkflowStep} from 'cloudflare:workers';
import {withDatabaseUrl} from '../src/server/db';
import {runMockStep,type WorkflowKind} from '../src/worker/cloudflare-mock';
interface Env {HYPERDRIVE:{connectionString:string}}
interface Params {id:string;kind:WorkflowKind}
export class AnalysisWorkflow extends WorkflowEntrypoint<Env,Params>{
 async run(event:WorkflowEvent<Params>,step:WorkflowStep){
  const {id,kind}=event.payload;
  if(kind!=='job'&&kind!=='discovery')throw Error('INVALID_WORKFLOW_KIND');
  for(let index=0;index<350;index++){
   const status=await step.do(`mock-step-${index}`,{retries:{limit:0,delay:'1 second'},timeout:'2 minutes'},()=>withDatabaseUrl(this.env.HYPERDRIVE.connectionString,()=>runMockStep(id,kind)));
   if(status!=='running')return {status};
  }
  throw Error('WORKFLOW_STEP_LIMIT');
 }
}

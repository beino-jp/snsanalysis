import { stopLive } from './pipeline';
export async function dispatchLive(id:string){
  if(process.env.DEPLOY_TARGET!=='cloudflare')throw Error('WORKFLOW_REQUIRED');
  try{
    const {getCloudflareContext}=await import('@opennextjs/cloudflare');
    const {env}=await getCloudflareContext({async:true});
    const binding=(env as {LIVE_ANALYSIS_WORKFLOW?:{create(input:{id:string;params:{id:string}}):Promise<unknown>}}).LIVE_ANALYSIS_WORKFLOW;
    if(!binding)throw Error('WORKFLOW_REQUIRED');
    await binding.create({id:`live-${id}`,params:{id}});
  }catch{await stopLive(id);throw Error('START_UNCONFIRMED');}
}

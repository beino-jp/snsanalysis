import {z} from 'zod';
const run=z.object({key:z.literal('profiles'),actor:z.literal('apify/instagram-profile-scraper'),status:z.literal('verified'),cleanup:z.literal('deleted'),costUsd:z.number().finite().min(0).max(0.1)}).passthrough();
export function recoveryBudget(raw:unknown){
 const state=z.object({status:z.literal('analyzing'),runs:z.array(run).length(1),priorProfileRuns:z.array(run).max(1).optional(),profileInputs:z.unknown().optional()}).parse(raw);
 if(state.profileInputs!==undefined || state.priorProfileRuns?.length)throw Error('RECOVERY_NOT_ALLOWED');
 const spent=state.runs.reduce((sum,r)=>sum+r.costUsd,0);
 const remaining=Math.floor((0.1-spent)*1e6)/1e6;
 if(remaining<=0)throw Error('RECOVERY_BUDGET_EXHAUSTED');
 return {priorRuns:state.runs,remaining};
}

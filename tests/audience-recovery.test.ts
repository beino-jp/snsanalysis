import {expect,it} from 'vitest';
import {recoveryBudget} from '../scripts/lib/audience-recovery';
const fixture=()=>({status:'analyzing',runs:[{key:'profiles',actor:'apify/instagram-profile-scraper',status:'verified',cleanup:'deleted',costUsd:0.039}]});
it('subtracts verified past charges before a single explicit input recovery',()=>{
 expect(recoveryBudget(fixture()).remaining).toBe(0.061);
 expect(()=>recoveryBudget({...fixture(),priorProfileRuns:fixture().runs})).toThrow();
 expect(()=>recoveryBudget({...fixture(),profileInputs:[]})).toThrow();
});
it('blocks ambiguous runs, incomplete cleanup, completion and exhausted budgets',()=>{
 for(const patch of [{status:'completed'},{runs:[]},{runs:[{...fixture().runs[0],cleanup:'pending'}]},{runs:[{...fixture().runs[0],costUsd:0.1}]},{runs:[{...fixture().runs[0],costUsd:null}]}])expect(()=>recoveryBudget({...fixture(),...patch})).toThrow();
});

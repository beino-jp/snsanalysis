import {expect,it} from 'vitest';
import {audienceCoverage} from '../scripts/lib/audience-coverage.mjs';
const unknown={value:'不明',confidence:0,evidence:[]};
const person=(username:string)=>({username,gender:unknown,age:unknown,interests:[]});
it('separates unavailable profiles from public missing text and measures input truncation',()=>{
 const data={status:'completed',audience:{people:[person('a'),person('b'),person('c'),person('d')]},profileInputs:[{username:'a',private:true},{username:'b',biography:'b'.repeat(1500),latestPosts:[{caption:'post'}]},{username:'c',biography:'',latestPosts:[]}]};
 const result=audienceCoverage(data);
 expect(result.public).toBe(2);expect(result.private).toBe(1);expect(result.missing).toBe(1);
 expect(result.publicNoText).toBe(1);expect(result.postsAvailable).toBe(1);expect(result.postsUsed).toBe(0);
 expect(result.truncatedProfiles).toBe(1);expect(result.savedCharsOmitted).toBe(4);
 expect(JSON.stringify(result)).not.toContain('username');
});
it('requires supporting evidence for a known finding and has no inferred demographics',()=>{
 const result=audienceCoverage({status:'completed',audience:{people:[{...person('a'),gender:{value:'女性',confidence:1,evidence:['自己記述']},age:{value:'30代',confidence:1,evidence:[]},interests:[{value:'犬好き',confidence:0.8,evidence:['犬と暮らす']}]}]},profileInputs:[{username:'a',biography:'自己記述'}]});
 expect(result.genderKnown).toBe(1);expect(result.ageKnown).toBe(0);expect(result.interestKnown).toBe(1);
});
it('refuses legacy incomplete data instead of treating missing fields as zero',()=>{
 expect(()=>audienceCoverage({status:'analyzing',audience:{people:[]},profileInputs:[]})).toThrow();
 expect(()=>audienceCoverage({status:'completed',audience:{people:[]}})).toThrow();
});

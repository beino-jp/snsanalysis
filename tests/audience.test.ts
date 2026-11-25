import {expect,it} from 'vitest';
import {groundPerson,audienceCounts} from '../src/domain/audience';
const f=(value:string,evidence:string[])=>({value,confidence:0.9,reason:'自己紹介の記述',evidence});
const sample=()=>({username:'sample',status:'analyzed',gender:f('不明',[]),age:f('30代',['30代です']),interests:[f('犬好き',['犬と暮らす']),f('旅行',['旅好き'])],description:'モデルの自由作文'});
it('removes unsupported interests and descriptions and preserves exact evidence',()=>{
 const p=groundPerson(sample(),'sample',['30代です。犬と暮らす'],false);
 expect(p.age.value).toBe('30代');expect(p.gender.value).toBe('不明');
 expect(p.interests.map(i=>i.value)).toEqual(['犬好き']);
 expect(p.description).not.toContain('自由作文');
 expect(audienceCounts([p],'age')).toEqual({'30代':1});
});
it('never analyzes private or empty profiles and rejects a different identity',()=>{
 expect(groundPerson({},'sample',[],true).status).toBe('private');
 expect(groundPerson({},'sample',[],false).status).toBe('insufficient');
 expect(()=>groundPerson(sample(),'another',['bio'],false)).toThrow();
});

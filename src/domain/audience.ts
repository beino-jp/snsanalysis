import { z } from 'zod';
const finding=z.object({value:z.string().max(80),confidence:z.number().min(0).max(1),reason:z.string().max(500),evidence:z.array(z.string().min(1).max(500)).max(3)});
export const audiencePerson=z.object({
 username:z.string().regex(/^[A-Za-z0-9_.]{1,30}$/),
 status:z.enum(['analyzed','private','insufficient']),
 gender:finding.extend({value:z.enum(['女性','男性','不明'])}),
 age:finding.extend({value:z.enum(['10代','20代','30代','40代','50代','60代以上','不明'])}),
 interests:z.array(finding).max(8),
 description:z.string().max(500),
});
export const audienceSchema=z.object({version:z.literal(1),analyzedAt:z.string().datetime(),source:z.literal('public-profile-text'),people:z.array(audiencePerson).max(20)});
export type AudiencePerson=z.infer<typeof audiencePerson>;
export function groundPerson(raw:unknown,username:string,texts:string[],privateAccount:boolean):AudiencePerson {
 const unknown={value:'不明',confidence:0,reason:'公開情報に明示的な根拠がありません',evidence:[]};
 if(privateAccount || !texts.some(t=>t.trim())) return audiencePerson.parse({username,status:privateAccount?'private':'insufficient',gender:unknown,age:unknown,interests:[],description:privateAccount?'非公開アカウントのため判定対象外':'判定材料がありません'});
 const p=audiencePerson.parse(raw);
 if(p.username!==username) throw Error('対象ユーザーが一致しません');
 const valid=(f:z.infer<typeof finding>)=>f.confidence>=0.6 && f.evidence.length>0 && f.evidence.every(q=>texts.some(t=>t.includes(q)));
 p.gender=valid(p.gender)?p.gender:unknown as AudiencePerson['gender'];
 p.age=valid(p.age)?p.age:unknown as AudiencePerson['age'];
 p.interests=p.interests.filter(valid);
 // Keep the description grounded in the validated findings, never arbitrary model prose.
 p.description=p.interests.length?p.interests.map(f=>f.value).join('・')+'に関する公開記述あり':'関心分野を判断できる根拠が不足しています';
 p.status='analyzed';
 return p;
}
export function audienceCounts(people:AudiencePerson[],field:'gender'|'age') {
 return Object.fromEntries([...new Set(people.map(p=>p[field].value))].map(v=>[v,people.filter(p=>p[field].value===v).length]));
}

import type { ValidationReport } from '../domain/validation-report';
import { audienceCounts } from '../domain/audience';
import type { AudiencePerson } from '../domain/audience';
type Props={audience:NonNullable<ValidationReport['audience']>;coverage?:ValidationReport['coverage'];total:number};
const supported=(f:{value:string;confidence:number;evidence:string[]})=>f.value!=='不明' && f.confidence>=0.6 && f.evidence.length>0;
const label=(s:string)=>({ 'dog lovers':'犬好き','dog lover':'犬好き','犬好き':'犬好き','旅行好き':'旅行','travel':'旅行','ゴルフ好き':'ゴルフ' }[s.trim().toLowerCase()]??s.trim());
export default function AudienceOverview({audience,coverage,total}:Props){
 const people=audience.people, n=people.length;
 const gender=people.filter(p=>supported(p.gender)).length, age=people.filter(p=>supported(p.age)).length;
 const interest=people.filter(p=>p.interests.some(f=>f.confidence>=0.6&&f.evidence.length>0)).length;
 const counts=new Map<string,number>();
 for(const p of people) for(const tag of new Set(p.interests.filter(f=>f.confidence>=0.6&&f.evidence.length>0).map(f=>label(f.value))))counts.set(tag,(counts.get(tag)??0)+1);
 const ratio=(value:number)=>`${value}/${n}人${n?`（${(100*value/n).toFixed(1)}%）`:''}`;
 return <section className="panel validation-details audience-overview">
  <h2>どんな層に届いたか</h2>
  <p className="form-hint">コメント取得者 {total}人中、{n}人の分析処理を完了。投稿全体・いいねユーザー全体を代表する調査ではありません。</p>
  <h3>属性を判定できた範囲</h3>
  <div className="audience-coverage-grid">{[['性別',gender],['年代',age],['関心',interest]].map(([title,value])=><div className="audience-coverage-card" key={title}><span>{title}に根拠あり</span><strong>{ratio(Number(value))}</strong><span>不明・根拠不足も分母に含む</span></div>)}</div>
  {(gender<n||age<n)&&<p className="demo-banner">性別・年代には判定できていない対象があります。分かった人だけの割合を、取得者全体の属性として扱わないでください。</p>}
  <h3>情報が不足している理由</h3>
  {coverage?<>
   <p>公開 {coverage.public}人 ／ 非公開 {coverage.private}人 ／ 保存プロフィールとの対応なし {coverage.missing}人</p>
   <p>公開のうち、自己紹介・投稿本文ともになし {coverage.publicNoText}人。公開で本文あり {coverage.publicWithText}人。</p>
   <p>保存済み投稿本文 {coverage.postsAvailable}件。入力枠での切り捨て {coverage.truncatedProfiles}人。</p>
   <p className="form-hint">保存前の切り捨て量・Instagram上の未取得投稿数は確認できません。非公開や属性の自己記述がない場合、追加取得でも分からないことがあります。</p>
  </>:<p>非公開 {people.filter(p=>p.status==='private').length}人 ／ 材料不足 {people.filter(p=>p.status==='insufficient').length}人。保存本文の内訳は、元のaudience JSONを再読み込みすると確認できます。</p>}
  <h3>性別・年代の集計</h3>
  {(['gender','age'] as const).map(field=><p key={field}>{field==='gender'?'性別':'年代'}：{Object.entries(audienceCounts(people,field)).map(([k,v])=>`${k} ${v}人`).join(' ／ ')}</p>)}
  <h3>根拠が得られた関心</h3>
  <p>{ratio(interest)}で関心の記述を確認。複数の関心を持つ人は各タグで数えます。</p>
  <div className="audience-tag-list">{[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja')).map(([tag,count])=><span className="pill" key={tag}>{tag} · {count}人</span>)}</div>
  {!counts.size&&<p>関心を裏付ける情報がありません。</p>}
  <details className="audience-person-details"><summary>個別の判定と引用根拠を確認（{n}人）</summary>
   <p className="form-hint">引用は公開情報の記述であり、内容の事実性を保証するものではありません。AIの自己評価値は正答率ではないため、百分率での強調をしていません。</p>
   {people.map((p,i)=><article className="audience-person" key={p.username}>
    <strong>対象者 {i+1} · {p.gender.value}／{p.age.value}</strong>
    <p>{p.description}</p>
    <p className="form-hint">性別：{p.gender.reason} ／ 年代：{p.age.reason}</p>
    {p.interests.map((f,j)=><div key={j}><strong>{label(f.value)} · 公開記述に根拠あり</strong><p>{f.reason}</p><blockquote>{f.evidence.join(' ／ ')}</blockquote></div>)}
    {p.age.value!=='10代'&&<a href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noopener noreferrer">プロフィールで確認 ↗</a>}
   </article>)}
  </details>
 </section>;
}

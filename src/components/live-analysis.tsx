'use client';
import { useEffect,useRef,useState } from 'react';
import type { LiveView } from '../server/live/view';
type Quote={url:string;ceilingYen:number;scope:string;note:string};
const labels:Record<string,string>={queued:'準備中',acquiring:'投稿・コメントを取得中',profiles:'公開プロフィールを確認中',analyzing:'属性・関心を分析中',completed:'分析完了',manual_check_required:'管理者の確認が必要',budget_stopped:'費用の確認が必要'};
async function request<T>(path:string,body?:unknown):Promise<T>{
  const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  if(r.status===401){location.href='/login';throw Error('ログインし直してください。');}
  const data=await r.json() as T&{error?:string};
  if(!r.ok)throw Error(data.error??'読み込みに失敗しました。');return data;
}
export default function LiveAnalysis({enabled,internal=false}:{enabled:boolean;internal?:boolean}){
  const [url,setUrl]=useState(''),[quote,setQuote]=useState<Quote|null>(null),[confirmed,setConfirmed]=useState(false),[rows,setRows]=useState<LiveView[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState('');
  const key=useRef<string|null>(null);
  async function load(){setRows(await request<LiveView[]>('/api/live-analyses'));}
  useEffect(()=>{void load().catch(e=>setError(e.message));const timer=setInterval(()=>void load().catch(()=>{}),4000);return()=>clearInterval(timer);},[]);
  async function estimate(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{setQuote(await request<Quote>('/api/live-analyses/quote',{url}));setConfirmed(false);key.current=crypto.randomUUID();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function start(){if(!quote||!confirmed||busy)return;setBusy(true);setError('');try{const r=await request<{id:string}>('/api/live-analyses',{url:quote.url,requestKey:key.current,confirmed:true});setSelected(r.id);setQuote(null);setConfirmed(false);await load();}catch(e){setError((e as Error).message);await load().catch(()=>{});}finally{setBusy(false);}}
  const current=rows.find(r=>r.id===selected)??rows[0],report=current?.report;
  return <main className="live-page">
    <div className="live-header">{internal?<a href="/">← ダッシュボードに戻る</a>:<strong>reachinsight</strong>}<button type="button" className="btn" onClick={async()=>{await fetch('/api/logout',{method:'POST'});location.href='/login';}}>ログアウト</button></div>
    <h1>投稿の反応を分析する</h1>
    <p>Instagramの投稿URLから、コメントした人の公開情報を確認します。</p>
    {!enabled&&<p className="demo-banner" role="status">実データ分析は準備中です。利用設定が完了すると、この画面から開始できます。</p>}
    <section className="panel live-card">
      <h2>1. 投稿URLを入力</h2>
      <form onSubmit={estimate}><label htmlFor="live-url">Instagramの公開投稿URL</label><input id="live-url" type="url" disabled={busy} required maxLength={500} value={url} placeholder="https://www.instagram.com/p/…/" onChange={e=>{setUrl(e.target.value);setQuote(null);setConfirmed(false);}}/><button className="btn primary" disabled={!enabled||busy||!url.trim()}>対象と費用を確認する</button></form>
      <p className="form-hint">プロフィールURLではなく、分析したい投稿のURLを貼り付けてください。</p>
    </section>
    {quote&&<section className="panel live-card" aria-label="実行前の確認">
      <h2>2. 対象と費用を確認</h2><p className="live-url">{quote.url}</p><p>{quote.scope}</p><p>{quote.note}</p>
      <p><strong>今回の費用上限：{quote.ceilingYen}円</strong>（余裕を持った円換算の管理枠）</p><p className="form-hint">最終請求額は各サービスの請求画面で確認します。開始後に画面を閉じても処理は続きます。</p>
      <label className="live-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>対象範囲と費用上限を確認しました</label>
      <button className="btn primary" type="button" disabled={!confirmed||busy} onClick={()=>void start()}>{busy?'開始を確認しています…':'この内容で分析を始める'}</button>
    </section>}
    {error&&<p className="error" role="alert">{error}</p>}
    <section className="panel live-card"><h2>分析の履歴と結果</h2>
      {!rows.length?<p>まだ分析はありません。上の入力欄から始めてください。</p>:<>
        <label htmlFor="live-history">表示する分析</label><select id="live-history" value={current.id} onChange={e=>setSelected(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{new Date(r.createdAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})} · {labels[r.status]??'確認中'}</option>)}</select>
        <p><strong role="status" aria-live="polite">{labels[current.status]??'状態を確認中'}</strong></p><p className="live-url">{current.url}</p>
        {current.error&&<p role="alert">{current.error}</p>}
        {!report&&!current.error&&<p>この画面を閉じても処理は続きます。後で履歴から確認できます。</p>}
        {report&&<>
          <p>表示いいね {report.displayedLikes.toLocaleString()}件 ／ 表示コメント {report.displayedComments.toLocaleString()}件</p>
          <p>コメント取得 {report.commentRecords}件・{report.uniqueCommenters}人 ／ 投稿者本人を除いた分析対象 {report.analyzedPeople}人</p>
          <div className="demo-banner">取得したコメントの一部を対象にした分析です。投稿全体や、いいねした人全体を代表する結果ではありません。</div>
          <h3>どんな層か</h3><p>性別：{Object.entries(report.gender).map(([k,n])=>`${k} ${n}人`).join(' ／ ')||'対象なし'}</p><p>年代：{Object.entries(report.age).map(([k,n])=>`${k} ${n}人`).join(' ／ ')||'対象なし'}</p>
          <p>非公開 {report.privatePeople}人 ／ 材料不足 {report.insufficientPeople}人。不明も分析対象の人数に含めています。</p>
          <h3>関心・どんなことが好きか</h3><p>{report.analyzedPeople}人中 {report.interestPeople}人に関心の根拠がありました。複数の関心を持つ人は各項目で数えます。</p>
          <div className="audience-tag-list">{report.interests.map(i=><span className="pill" key={i.label}>{i.label} · {i.count}人</span>)}</div>
          {!report.interests.length&&<p>関心を判断できる公開情報が不足しています。</p>}
          <p>今回の利用額の円換算目安：{current.actualYen??'確認中'}円</p>
        </>}
      </>}
    </section>
  </main>;
}

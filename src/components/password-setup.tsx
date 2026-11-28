'use client';
import {useEffect,useRef,useState} from 'react';
export default function PasswordSetup(){
 const token=useRef('');
 const consumed=useRef(false);
 const [ready,setReady]=useState(false),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(consumed.current)return;consumed.current=true;
  const hash=new URLSearchParams(location.hash.slice(1));
  // Consume credentials from the URL immediately; never persist them to browser storage.
  history.replaceState(null,'',location.pathname);
  if(['invite','recovery'].includes(hash.get('type')??'')&&hash.get('access_token')){token.current=hash.get('access_token')!;setReady(true);}
  else setError('このリンクは利用できないか、期限が切れています。管理者に新しい招待リンクを依頼してください。');
 },[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;
  if(password!==confirm){setError('2つのパスワードが一致していません。');return;}
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:token.current,password})});
   if(!res.ok){const body=await res.json() as {error?:string};throw Error(body.error??'設定できませんでした。管理者に新しい招待リンクを依頼してください。');}
   token.current='';setPassword('');setConfirm('');location.replace('/');
  }catch(e){token.current='';setReady(false);setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <main className="live-page"><strong>reachinsight</strong><section className="panel live-card"><h1>ログイン用パスワードを設定</h1><p>このアプリで使うパスワードを設定してください。設定後、そのままログインします。</p>
  {error&&<p className="error" role="alert">{error}</p>}
  {ready&&<form onSubmit={submit}>
   <label htmlFor="setup-password">新しいパスワード（12文字以上）</label><input id="setup-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/>
   <label htmlFor="setup-confirm">パスワードをもう一度入力</label><input id="setup-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={confirm} onChange={e=>setConfirm(e.target.value)}/>
   <button className="btn primary" disabled={busy}>{busy?'設定しています…':'パスワードを設定して始める'}</button>
  </form>}
  {!ready&&<a href="/login">ログイン画面へ</a>}
 </section></main>;
}

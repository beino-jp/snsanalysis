import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {pathToFileURL} from 'node:url';

const api='https://api.cloudflare.com/client/v4';
const name='beino-insight-test-build';

// Registers the existing user token with Workers Builds. Does not deploy code,
// create a Worker, change token permissions, or change an existing build token.
export async function registerBuildToken(token,fetcher=fetch){
 if(!/^[A-Za-z0-9_-]{20,500}$/.test(token))throw Error('トークンの入力形式を確認してください。');
 async function request(path,body){
  let response;
  try{response=await fetcher(api+path,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
  catch{throw Error('Cloudflareへの通信を確認できませんでした。連続実行せず、管理者へ確認してください。');}
  if(response.status===401||response.status===403)throw Error('認証または登録権限が不足しています。専用トークンのWorkers Builds Configuration（編集）を確認してください。');
  if(!response.ok)throw Error('Cloudflareへの登録を確認できませんでした（HTTP '+response.status+'）。連続実行せず、管理者へ確認してください。');
  let data;try{data=await response.json();}catch{throw Error('Cloudflareからの応答を確認できませんでした。');}
  if(data.success!==true)throw Error('Cloudflareからの処理成功を確認できませんでした。');
  return data.result;
 }
 const identity=await request('/user/tokens/verify');
 if(identity?.status!=='active'||!/^[a-f0-9]{32}$/i.test(identity.id??''))throw Error('有効なユーザーAPIトークンを確認できませんでした。');
 const accounts=await request('/accounts?per_page=50');
 const matches=Array.isArray(accounts)?accounts.filter(a=>a.name==='beino'):[];
 if(matches.length!==1||!/^[a-f0-9]{32}$/i.test(matches[0].id??''))throw Error('対象のbeinoアカウントを一意に確認できませんでした。');
 const path='/accounts/'+matches[0].id+'/builds/tokens';
 const existing=await request(path);
 if(!Array.isArray(existing))throw Error('ビルド用トークンの一覧を確認できませんでした。');
 if(existing.some(t=>t.cloudflare_token_id===identity.id&&t.build_token_name===name))return '既にビルド用として登録済みです。';
 if(existing.some(t=>t.build_token_name===name))throw Error('同名の別トークンが登録されています。既存の登録は変更しませんでした。');
 const result=await request(path,{build_token_name:name,build_token_secret:token,cloudflare_token_id:identity.id});
 if(result?.cloudflare_token_id!==identity.id||result?.build_token_name!==name||!result?.build_token_uuid)throw Error('登録結果を確認できませんでした。連続実行せず、管理者へ確認してください。');
 return 'ビルド用トークンの登録が完了しました。';
}

export async function hiddenToken(){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('ターミナルから直接実行してください。');
 const muted=new Writable({write(_chunk,_encoding,done){done();}});
 const rl=createInterface({input:process.stdin,output:muted,terminal:true});
 process.stdout.write('1Passwordに保存した専用APIトークンを貼り付けてEnter（文字は表示されません）: ');
 try{return (await rl.question('')).trim();}
 finally{rl.close();process.stdout.write('\n');}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let token='';
 try{token=await hiddenToken();process.stdout.write(await registerBuildToken(token)+'\n');}
 catch(error){process.stderr.write((error instanceof Error?error.message:'登録できませんでした。')+'\n');process.exitCode=1;}
 finally{token='';}
}

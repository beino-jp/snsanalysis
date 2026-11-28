import 'dotenv/config';
import { readFile } from 'node:fs/promises';
const required=['APIFY_TOKEN','OPENAI_API_KEY'];
let missing=false;
for(const name of required){const value=process.env[name]?.trim();const ready=!!value&&!/^(replace|your[_ -]|example|ここ)/i.test(value);console.log(`${name}: ${ready?'設定あり（値は非表示・有効性は未検証）':'未設定'}`);if(!ready)missing=true;}
for(const name of ['SUPABASE_URL','SUPABASE_ANON_KEY'])console.log(`${name}: ${process.env[name]?.trim()?'設定あり（値は非表示・有効性は未検証）':'未設定（ローカル取得テストには不要、社内認証の実装時に設定）'}`);
try{
 const plan=JSON.parse(await readFile('.live-test.local.json','utf8'));
 const url=new URL(plan.postUrl);
 if(url.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(url.hostname)||url.username||url.password||!/^\/p\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))throw Error('invalid');
 console.log(`検証対象: https://www.instagram.com${url.pathname.replace(/\/?$/,'/')}`);
}catch{console.log('検証対象: 未設定。.live-test.example.jsonを.live-test.local.jsonへコピーして投稿URLを指定してください');missing=true;}
console.log('外部APIへの通信・課金・DB変更は行っていません。設定ありという表示だけでは接続成功を意味しません。');
console.log('実データ実行は未有効化です。次にActorの入力・料金・保存内容を確認し、少量テストの取得範囲と費用を確定します。');
process.exitCode=missing?1:0;

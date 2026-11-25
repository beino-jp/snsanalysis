import 'dotenv/config';
import {ApifyClient} from 'apify-client';
import {validatePricing,validateBuild} from './lib/instagram-probe.mjs';
// Read-only metadata inspection. Never starts an Actor or sends profile data.
const client=new ApifyClient({token:process.env.APIFY_TOKEN,maxRetries:0});
const step={key:'profiles',limit:15,cap:0.1};
try{
 const actor=await client.actor('apify/instagram-profile-scraper').get();
 console.log('Actor情報：取得成功');
 try{validatePricing(actor,step);console.log('料金確認：成功');}
 catch(e){console.log('料金確認：'+e.message);}
 const info=(actor.pricingInfos??[]).filter(p=>Date.parse(p.startedAt)<=Date.now()).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0];
 console.log(JSON.stringify({方式:info?.pricingModel,最低課金上限:info?.minimalMaxTotalChargeUsd,項目数:Object.keys(info?.pricingPerEvent?.actorChargeEvents??{}).length}));
 const build=await(await client.actor('apify/instagram-profile-scraper').defaultBuild()).get();
 console.log('Build情報：取得成功');
 try{validateBuild(build,step);console.log('入力仕様確認：成功');}
 catch(e){console.log('入力仕様確認：'+e.message);}
 console.log('入力項目：'+Object.keys(JSON.parse(build.inputSchema??'{}').properties??{}).join(', '));
}catch(e){console.log('メタデータ取得失敗。HTTP状態：'+(e.statusCode??e.status??'不明'));}
console.log('診断終了：有料処理は実行していません');

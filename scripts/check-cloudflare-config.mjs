import {readFile} from 'node:fs/promises';
export function checkCloudflareConfig(c){
 if(c.name!=='beino-insight-test'||c.workers_dev!==false||c.preview_urls!==false||!Array.isArray(c.routes)||c.routes.length!==0)throw Error('専用の非公開テストWorker設定が必要です');
 if(c.compatibility_flags?.includes('nodejs_compat')!==true||c.vars?.APP_ORIGIN!=='https://test.beino-insight.com'||c.vars?.DEMO_AUTH!=='false'||c.vars?.DEPLOY_TARGET!=='cloudflare')throw Error('テスト環境の認証・互換性設定が不正です');
 const allowed=new Set(['APP_ORIGIN','DEPLOY_TARGET','DATA_PROVIDER','LLM_PROVIDER','DEMO_AUTH']);
 if(Object.keys(c.vars??{}).some(k=>!allowed.has(k)))throw Error('秘密はvarsではなく専用環境のSecretsで設定してください');
 if(c.workflows?.some(w=>!((w.name==='beino-insight-test-analysis'&&w.binding==='ANALYSIS_WORKFLOW'&&w.class_name==='AnalysisWorkflow')||(w.name==='beino-insight-test-live-analysis'&&w.binding==='LIVE_ANALYSIS_WORKFLOW'&&w.class_name==='LiveAnalysisWorkflow'))))throw Error('専用の分析Workflow設定が必要です');
 if(c.account_id||c.env)throw Error('他アカウント・既存環境への配備設定は使いません');
}
if(process.argv[1] && new URL(import.meta.url).pathname===process.argv[1]){
 try{checkCloudflareConfig(JSON.parse(await readFile('wrangler.json','utf8')));console.log('専用テストWorker設定：確認済み（公開ルートなし）');}
 catch{console.error('Cloudflare設定を確認してください。ビルドを停止しました。');process.exitCode=1;}
}

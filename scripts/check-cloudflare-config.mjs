import {readFile} from 'node:fs/promises';
export function checkCloudflareConfig(c){
 if(c.name!=='beino-insight-test'||c.workers_dev!==false||c.preview_urls!==false)throw Error('専用テストWorkerと無効化された標準URLが必要です');
 if(!Array.isArray(c.routes)||c.routes.length>1||c.routes.some(r=>!r||typeof r!=='object'||r.pattern!=='test.beino-insight.com'||r.custom_domain!==true||Object.keys(r).some(k=>!['pattern','custom_domain'].includes(k))))throw Error('公開先は専用の検証ホストだけを指定してください');
 if(c.compatibility_flags?.includes('nodejs_compat')!==true||c.vars?.APP_ORIGIN!=='https://test.beino-insight.com'||c.vars?.DEMO_AUTH!=='false'||c.vars?.DEPLOY_TARGET!=='cloudflare')throw Error('テスト環境の認証・互換性設定が不正です');
 const allowed=new Set(['APP_ORIGIN','DEPLOY_TARGET','DATA_PROVIDER','LLM_PROVIDER','DEMO_AUTH']);
 if(Object.keys(c.vars??{}).some(k=>!allowed.has(k)))throw Error('秘密はvarsではなく専用環境のSecretsで設定してください');
 if(c.workflows?.some(w=>!((w.name==='beino-insight-test-analysis'&&w.binding==='ANALYSIS_WORKFLOW'&&w.class_name==='AnalysisWorkflow')||(w.name==='beino-insight-test-live-analysis'&&w.binding==='LIVE_ANALYSIS_WORKFLOW'&&w.class_name==='LiveAnalysisWorkflow'))))throw Error('専用の分析Workflow設定が必要です');
 if(c.hyperdrive?.length!==1||c.hyperdrive[0].binding!=='HYPERDRIVE'||!(/^[a-f0-9]{32}$/i.test(c.hyperdrive[0].id))||Object.keys(c.hyperdrive[0]).some(k=>!['binding','id'].includes(k)))throw Error('専用HyperdriveのIDだけを設定してください。接続文字列・パスワードは保存しません');
 if(c.account_id||c.env)throw Error('他アカウント・既存環境への配備設定は使いません');
}
if(process.argv[1] && new URL(import.meta.url).pathname===process.argv[1]){
 try{const config=JSON.parse(await readFile('wrangler.json','utf8'));checkCloudflareConfig(config);console.log(`専用テストWorker設定：確認済み（${config.routes.length?'test.beino-insight.comのみ':'公開ルートなし'}）`);}
 catch{console.error('Cloudflare設定を確認してください。ビルドを停止しました。');process.exitCode=1;}
}

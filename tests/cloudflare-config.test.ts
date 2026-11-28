import {readFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
import {checkCloudflareConfig} from '../scripts/check-cloudflare-config.mjs';
import {liveLimits} from '../src/server/live/budget';
it('isolates the new worker and rejects unrelated routes, public previews and embedded secrets',()=>{
 const config=JSON.parse(readFileSync('wrangler.json','utf8'));
 expect(()=>checkCloudflareConfig(config)).not.toThrow();
 for(const patch of [{hyperdrive:[]},{hyperdrive:[{binding:'HYPERDRIVE',id:'invalid'}]},{hyperdrive:[{...config.hyperdrive[0],localConnectionString:'postgres://do-not-commit'}]},{name:'sagyo-ai'},{workers_dev:true},{preview_urls:true},{routes:[{pattern:'sagyoai.com',custom_domain:true}]},{vars:{...config.vars,APIFY_TOKEN:'do-not-embed'}}])expect(()=>checkCloudflareConfig({...config,...patch})).toThrow();
});
it('keeps prepared provider keys from enabling live runs and rejects unreviewed budgets or prices',()=>{
 const config=JSON.parse(readFileSync('wrangler.json','utf8'));
 expect(config.vars.LIVE_MONTHLY_API_BUDGET_YEN).toBe('300');
 expect(config.vars).not.toHaveProperty('LIVE_ANALYSIS_ENABLED');
 try{
  for(const [key,value]of Object.entries(config.vars))vi.stubEnv(key,value as string);
  vi.stubEnv('SESSION_SECRET','test-only-session-secret-at-least-32-characters');
  vi.stubEnv('APIFY_TOKEN','fake-key');vi.stubEnv('OPENAI_API_KEY','fake-key');
  vi.stubEnv('LIVE_ANALYSIS_ENABLED',undefined);
  expect(()=>liveLimits()).toThrow('LIVE_DISABLED');
 }finally{vi.unstubAllEnvs();}
 for(const patch of [{LIVE_MONTHLY_API_BUDGET_YEN:'6000'},{OPENAI_MODEL:'unreviewed-model'},{OPENAI_INPUT_USD_PER_MILLION:'0'},{OPENAI_OUTPUT_USD_PER_MILLION:'0'},{LIVE_ANALYSIS_ENABLED:'true'},{OPENAI_API_KEY:'do-not-embed'}])expect(()=>checkCloudflareConfig({...config,vars:{...config.vars,...patch}})).toThrow();
});
it('allows only the exact test custom domain or the initial private deployment',()=>{
 const config=JSON.parse(readFileSync('wrangler.json','utf8'));
 const route={pattern:'test.beino-insight.com',custom_domain:true};
 expect(config.routes).toEqual([route]);
 expect(()=>checkCloudflareConfig({...config,routes:[]})).not.toThrow();
 for(const routes of [undefined,[null],['test.beino-insight.com'],[{...route,pattern:'beino-insight.com'}],[{...route,pattern:'*.beino-insight.com'}],[{...route,pattern:'test.beino-insight.com/*'}],[{...route,custom_domain:false}],[{...route,zone_name:'sagyoai.com'}],[route,route]])expect(()=>checkCloudflareConfig({...config,routes})).toThrow();
});

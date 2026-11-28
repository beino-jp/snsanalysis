import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {checkCloudflareConfig} from '../scripts/check-cloudflare-config.mjs';
it('isolates the new worker and rejects unrelated routes, public previews and embedded secrets',()=>{
 const config=JSON.parse(readFileSync('wrangler.json','utf8'));
 expect(()=>checkCloudflareConfig(config)).not.toThrow();
 for(const patch of [{hyperdrive:[]},{hyperdrive:[{binding:'HYPERDRIVE',id:'invalid'}]},{hyperdrive:[{...config.hyperdrive[0],localConnectionString:'postgres://do-not-commit'}]},{name:'sagyo-ai'},{workers_dev:true},{preview_urls:true},{routes:[{pattern:'sagyoai.com',custom_domain:true}]},{vars:{...config.vars,APIFY_TOKEN:'do-not-embed'}}])expect(()=>checkCloudflareConfig({...config,...patch})).toThrow();
});
it('allows only the exact test custom domain or the initial private deployment',()=>{
 const config=JSON.parse(readFileSync('wrangler.json','utf8'));
 const route={pattern:'test.beino-insight.com',custom_domain:true};
 expect(config.routes).toEqual([route]);
 expect(()=>checkCloudflareConfig({...config,routes:[]})).not.toThrow();
 for(const routes of [undefined,[null],['test.beino-insight.com'],[{...route,pattern:'beino-insight.com'}],[{...route,pattern:'*.beino-insight.com'}],[{...route,pattern:'test.beino-insight.com/*'}],[{...route,custom_domain:false}],[{...route,zone_name:'sagyoai.com'}],[route,route]])expect(()=>checkCloudflareConfig({...config,routes})).toThrow();
});

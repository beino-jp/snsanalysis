import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {checkCloudflareConfig} from '../scripts/check-cloudflare-config.mjs';
it('isolates the new worker and rejects routes, public previews and embedded secrets',()=>{
 const config=JSON.parse(readFileSync('wrangler.json','utf8'));
 expect(()=>checkCloudflareConfig(config)).not.toThrow();
 for(const patch of [{hyperdrive:[]},{hyperdrive:[{binding:'HYPERDRIVE',id:'invalid'}]},{hyperdrive:[{...config.hyperdrive[0],localConnectionString:'postgres://do-not-commit'}]},{name:'sagyo-ai'},{workers_dev:true},{preview_urls:true},{routes:[{pattern:'sagyoai.com',custom_domain:true}]},{vars:{...config.vars,APIFY_TOKEN:'do-not-embed'}}])expect(()=>checkCloudflareConfig({...config,...patch})).toThrow();
});

import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
test.skip(process.env.E2E_LIVE_FIXTURES!=='true','Requires a local Worker with explicitly configured fake credentials.');
test.use({launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:undefined});
for(const viewport of [{width:375,height:812},{width:1440,height:1000}])test(`URL, cost confirmation and aggregate results at ${viewport.width}px`,async({page,context,baseURL})=>{
  if(!baseURL||!['127.0.0.1','localhost'].includes(new URL(baseURL).hostname))throw Error('Local fixture server required');
  await page.setViewportSize(viewport);
  const body=Buffer.from(JSON.stringify({email:'smoke@example.test',exp:Date.now()+600000})).toString('base64url');
  const sig=createHmac('sha256','local-smoke-only-32-character-signature-key').update(body).digest('hex');
  await context.addCookies([{name:'reach-session',value:body+'.'+sig,url:baseURL,httpOnly:true,sameSite:'Strict'}]);
  let started=false,starts=0;
  // All paid-facing API calls are intercepted. No real provider is contacted by this test.
  await page.route('**/api/live-analyses**',async route=>{
    const r=route.request();
    if(r.url().endsWith('/quote'))return route.fulfill({json:{url:'https://www.instagram.com/p/FIXTURE_ONLY/',ceilingYen:300,scope:'投稿1件・コメント最大20件・プロフィール最大20人',note:'根拠がなければ不明です。'}});
    if(r.method()==='POST'){starts++;started=true;return route.fulfill({json:{id:'fixture-analysis'}});}
    return route.fulfill({json:started?[{id:'fixture-analysis',url:'https://www.instagram.com/p/FIXTURE_ONLY/',status:'completed',ceilingYen:300,actualYen:11,costUsd:0.0352,error:null,createdAt:'2026-11-27T10:00:00Z',report:{displayedLikes:100,displayedComments:50,commentRecords:3,uniqueCommenters:3,analyzedPeople:2,gender:{'不明':2},age:{'不明':2},interestPeople:1,interests:[{label:'旅行',count:1}],privatePeople:1,insufficientPeople:0}}]:[]});
  });
  await page.goto('/analyze');
  await expect(page.getByRole('heading',{name:'投稿の反応を分析する'})).toBeVisible();
  await page.getByLabel('Instagramの公開投稿URL').fill('https://www.instagram.com/p/FIXTURE_ONLY/');
  await page.getByRole('button',{name:'対象と費用を確認する'}).click();
  const start=page.getByRole('button',{name:'この内容で分析を始める'});
  await expect(start).toBeDisabled();
  await expect(page.getByText('今回の費用上限：300円')).toBeVisible();
  await page.getByRole('checkbox',{name:'対象範囲と費用上限を確認しました'}).check();
  await start.click();
  await expect(page.getByText('分析完了',{exact:true})).toBeVisible();
  await expect(page.getByText('旅行 · 1人')).toBeVisible();
  await expect(page.getByText('性別：不明 2人')).toBeVisible();
  expect(starts).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/live-${viewport.width}.png`,fullPage:true});
});

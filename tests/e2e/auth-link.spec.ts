import {test,expect} from '@playwright/test';
import {createHash,createHmac} from 'node:crypto';
import pg from 'pg';
test.skip(process.env.E2E_LIVE_FIXTURES!=='true','Local fake-auth Worker required.');
test.use({launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:undefined});
test('default site URL retains the invite fragment through redirects and removes it at password setup',async({page,baseURL})=>{
 if(!baseURL||!['127.0.0.1','localhost'].includes(new URL(baseURL).hostname))throw Error('Local server only');
 await page.setViewportSize({width:375,height:812});
 const token='fake-invite-token-never-a-real-secret';
 await page.goto('/#access_token='+token+'&refresh_token=unused-refresh-fixture&type=invite');
 await expect(page.getByRole('heading',{name:'ログイン用パスワードを設定'})).toBeVisible();
 await expect(page.getByLabel('新しいパスワード（12文字以上）')).toBeVisible();
 expect(new URL(page.url()).pathname).toBe('/auth/finish');expect(new URL(page.url()).hash).toBe('');
 await page.screenshot({path:'test-results/password-setup-375.png',fullPage:true});
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain(token);
 let submissions=0;
 await page.route('**/api/auth/password',async route=>{
  const body=route.request().postDataJSON();expect(body.accessToken).toBe(token);expect(body.password).toBe('long-fixture-password');submissions++;
  return route.fulfill({status:400,json:{error:'設定を確認できませんでした。管理者に新しいリンクを依頼してください。'}});
 });
 await page.getByLabel('新しいパスワード（12文字以上）').fill('long-fixture-password');
 await page.getByLabel('パスワードをもう一度入力').fill('different-password');
 await page.getByRole('button',{name:'パスワードを設定して始める'}).click();
 await expect(page.locator('main').getByRole('alert')).toContainText('一致していません');expect(submissions).toBe(0);
 await page.getByLabel('パスワードをもう一度入力').fill('long-fixture-password');
 await page.getByRole('button',{name:'パスワードを設定して始める'}).click();
 await expect(page.locator('main').getByRole('alert')).toContainText('新しいリンク');expect(submissions).toBe(1);
 await expect(page.getByRole('button',{name:'パスワードを設定して始める'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('successful password setup opens the signed-in analysis page',async({page,baseURL})=>{
 if(!baseURL||!['127.0.0.1','localhost'].includes(new URL(baseURL).hostname))throw Error('Local server only');
 const db=new pg.Client({connectionString:'postgresql://reach:reach_local_only@127.0.0.1:5432/reach'});
 await db.connect();
 try{await db.query('INSERT INTO settings(id,payload) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload',['auth-session:'+createHash('sha256').update('smoke@example.test').digest('hex'),JSON.stringify({version:'fixture-only'})]);}finally{await db.end();}
 const body=Buffer.from(JSON.stringify({version:'fixture-only',email:'smoke@example.test',exp:Date.now()+600000})).toString('base64url');
 const sig=createHmac('sha256','local-smoke-only-32-character-signature-key').update(body).digest('hex');
 await page.route('**/api/auth/password',route=>route.fulfill({status:200,json:{ok:true},headers:{'Set-Cookie':'reach-session='+body+'.'+sig+'; Path=/; HttpOnly; SameSite=Strict'}}));
 await page.route('**/api/live-analyses',route=>route.fulfill({json:[]}));
 await page.goto('/auth/finish#access_token=fake-invite-token-never-a-real-secret&type=invite');
 await page.getByLabel('新しいパスワード（12文字以上）').fill('long-fixture-password');
 await page.getByLabel('パスワードをもう一度入力').fill('long-fixture-password');
 await page.getByRole('button',{name:'パスワードを設定して始める'}).click();
 await expect(page.getByRole('heading',{name:'投稿の反応を分析する'})).toBeVisible();
 expect(new URL(page.url()).pathname).toBe('/analyze');
});
test('expired invitation shows a clear next action without echoing URL error contents',async({page})=>{
 await page.goto('/auth/finish#error_code=otp_expired&error_description=private-error-fixture');
 await expect(page.locator('main').getByRole('alert')).toContainText('期限が切れています');
 await expect(page.getByRole('link',{name:'ログイン画面へ'})).toBeVisible();
 expect(await page.locator('body').innerText()).not.toContain('private-error-fixture');expect(new URL(page.url()).hash).toBe('');
});

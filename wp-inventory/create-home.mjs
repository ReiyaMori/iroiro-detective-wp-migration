// ホーム固定ページを作成（home-content.html を raw HTML 本文として）。
// WP管理セッションの wp.apiFetch（cookie+nonce）でREST POST。アプリパスワードを残さない。
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
const SRC=process.env.HOME_CONTENT;
const OUT=process.env.OUT_DIR||'../backup_20260522/create_home';
if(!U||!P||!SRC){ console.error('Set WP_USER/WP_PASS/HOME_CONTENT'); process.exit(1); }
const HTML = await readFile(SRC,'utf8');
await mkdir(OUT,{recursive:true});

const b=await chromium.launch();
const page=await (await b.newContext({viewport:{width:1440,height:1400},
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})).newPage();
try{
  await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(U,{delay:20});
  await page.locator('#user_pass').click(); await page.keyboard.type(P,{delay:20});
  await Promise.all([page.waitForLoadState('networkidle'),page.click('#wp-submit')]);
  if(page.url().includes('wp-login.php')){console.error('LOGIN FAILED');throw 'LOGIN';}
  console.log('logged in');

  // 既存「home」スラッグの確認（重複作成回避）
  await page.goto(`${BASE}/wp-admin/post-new.php?post_type=page`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(5000); // editor + wp-api ロード待ち

  const existing = await page.evaluate(async () => {
    try{ const r = await window.wp.apiFetch({ path:'/wp/v2/pages?slug=home&status=publish,draft,private&_fields=id,slug,link' });
      return r; }catch(e){ return {error:String(e&&(e.message||e))}; }
  });
  console.log('existing home slug:', JSON.stringify(existing));

  const result = await page.evaluate(async ({html}) => {
    if(!window.wp || !window.wp.apiFetch) return {error:'no apiFetch'};
    try{
      const res = await window.wp.apiFetch({ path:'/wp/v2/pages', method:'POST',
        data:{ title:'ホーム', slug:'home', status:'publish', content: html, comment_status:'closed', ping_status:'closed' } });
      return { id:res.id, link:res.link, slug:res.slug, status:res.status,
               contentLen:(res.content && res.content.raw ? res.content.raw.length : (res.content&&res.content.rendered?res.content.rendered.length:0)) };
    }catch(e){ return {error:String(e&&(e.message||e))}; }
  }, { html: HTML });

  console.log('CREATE RESULT:', JSON.stringify(result));
  await writeFile(`${OUT}/result.json`, JSON.stringify({existing,result},null,2));
}catch(e){ console.error('ERR',e&&(e.message||e)); }
finally{ await b.close(); }

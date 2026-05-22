// 既存ホーム固定ページ(1929)の本文を home-content.html で更新（FV CTAボタン追加版）
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const U=process.env.WP_USER,P=process.env.WP_PASS,BASE='https://trust-supply.com',ID=process.env.PAGE_ID||'1929';
const HTML=await readFile(process.env.HOME_CONTENT,'utf8');
const b=await chromium.launch();
const page=await (await b.newContext({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'})).newPage();
try{
  await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(U,{delay:18});
  await page.locator('#user_pass').click(); await page.keyboard.type(P,{delay:18});
  await Promise.all([page.waitForLoadState('networkidle'),page.click('#wp-submit')]);
  if(page.url().includes('wp-login.php')){console.error('LOGIN FAILED');process.exit(1);}
  await page.goto(`${BASE}/wp-admin/post.php?post=${ID}&action=edit`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(4500);
  const r=await page.evaluate(async ({id,html})=>{
    try{ const res=await window.wp.apiFetch({path:`/wp/v2/pages/${id}`,method:'POST',data:{content:html}});
      return {id:res.id,link:res.link,len:(res.content&&res.content.rendered?res.content.rendered.length:0)};}
    catch(e){return {error:String(e&&(e.message||e))};}
  },{id:ID,html:HTML});
  console.log('UPDATE:',JSON.stringify(r));
}catch(e){console.error('ERR',e&&(e.message||e));}finally{await b.close();}

// F: パーマリンク構造は変更せず「変更を保存」だけ押す（rewriteルール再生成/flush）。
import { chromium } from 'playwright';
const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
if(!U||!P){console.error('Set WP_USER/WP_PASS');process.exit(1);}
const b=await chromium.launch();
const page=await (await b.newContext({viewport:{width:1440,height:1200},
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})).newPage();
try{
  await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(U,{delay:20});
  await page.locator('#user_pass').click(); await page.keyboard.type(P,{delay:20});
  await Promise.all([page.waitForLoadState('networkidle'),page.click('#wp-submit')]);
  if(page.url().includes('wp-login.php')){console.error('LOGIN FAILED');throw 'LOGIN';}
  await page.goto(`${BASE}/wp-admin/options-permalink.php`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2000);
  // 現構造を確認（変更しない）
  const struct = await page.evaluate(()=>{
    const sel=document.querySelector('input[name="selection"]:checked');
    const custom=document.querySelector('#permalink_structure');
    return { selection: sel?sel.value:null, custom: custom?custom.value:null };
  });
  console.log('current permalink structure:', JSON.stringify(struct));
  await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:45000}).catch(()=>{}),
    page.locator('#submit, input[type="submit"]').first().click() ]);
  await page.waitForTimeout(2000);
  const saved = await page.evaluate(()=> /変更を保存しました|パーマリンク構造を更新|Permalink structure updated|設定を保存しました/.test(document.body.innerText));
  console.log('flush saved:', saved);
}catch(e){console.error('ERR',e&&(e.message||e));}
finally{await b.close();}

// 読み取り専用: themes.php でテーマ一覧と現在有効テーマを確認（クリックなし）
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
const OUT=process.env.OUT_DIR||'../backup_20260522/themes_check';
if(!U||!P){console.error('Set WP_USER/WP_PASS');process.exit(1);}
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
  await page.goto(`${BASE}/wp-admin/themes.php`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:`${OUT}/themes.png`,fullPage:true});
  // テーマカード解析
  const themes=await page.$$eval('.theme', cards=>cards.map(c=>({
    name:(c.querySelector('.theme-name')?.textContent||'').replace(/\s+/g,' ').trim(),
    active:c.classList.contains('active') || /現在のテーマ|: 有効/.test(c.querySelector('.theme-name')?.textContent||''),
  })));
  const active=themes.find(t=>t.active);
  console.log('テーマ数:', themes.length);
  themes.forEach(t=>console.log(`  ${t.active?'★有効':'      '} ${t.name}`));
  console.log('\n判定:', JSON.stringify({
    SWELL存在: themes.some(t=>/^SWELL$/i.test(t.name)||/SWELL(?! CHILD)/i.test(t.name)),
    SWELL_CHILD存在: themes.some(t=>/SWELL CHILD/i.test(t.name)),
    現在有効: active?active.name:'(不明)',
    BizVektorが有効: !!active && /Biz ?Vektor/i.test(active.name),
  }));
}catch(e){console.error('ERR',e&&(e.message||e));}
finally{await b.close();}

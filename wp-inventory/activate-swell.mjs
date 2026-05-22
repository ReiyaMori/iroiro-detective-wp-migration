// J-2: SWELL CHILD を有効化し、フロントページ=ホーム(1929)に設定する。
// 切り戻し用に現在の show_on_front / page_on_front を退避（rollback.json）。
// ★不可逆ライブ操作★（れーや承認済 J）。BizVektorは削除しない（再有効化で即戻せる）。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
const FRONT_ID=process.env.FRONT_ID||'1929';
const OUT=process.env.OUT_DIR||'../backup_20260522/activate';
if(!U||!P){ console.error('Set WP_USER/WP_PASS'); process.exit(1); }
const log=[]; const note=(m)=>{console.log(m);log.push(m);};
await mkdir(OUT,{recursive:true});
const b=await chromium.launch();
const page=await (await b.newContext({viewport:{width:1440,height:1500},
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})).newPage();
try{
  note('[1] login');
  await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(U,{delay:20});
  await page.locator('#user_pass').click(); await page.keyboard.type(P,{delay:20});
  await Promise.all([page.waitForLoadState('networkidle'),page.click('#wp-submit')]);
  if(page.url().includes('wp-login.php')){note('LOGIN FAILED');throw 'LOGIN';}

  note('[2] 現在のフロント設定を退避（rollback用）');
  await page.goto(`${BASE}/wp-admin/options-reading.php`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2000);
  const orig = await page.evaluate(()=>{
    const sof = document.querySelector('input[name="show_on_front"]:checked');
    const pof = document.querySelector('select[name="page_on_front"]');
    const pfp = document.querySelector('select[name="page_for_posts"]');
    return { show_on_front: sof?sof.value:null,
             page_on_front: pof?pof.value:null,
             page_for_posts: pfp?pfp.value:null };
  });
  note('    orig: '+JSON.stringify(orig));
  await writeFile(`${OUT}/rollback.json`, JSON.stringify({orig, ts:new Date().toISOString()},null,2));

  note('[3] themes.php で swell_child の有効化リンク取得');
  await page.goto(`${BASE}/wp-admin/themes.php`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2500);
  const href = await page.locator('a[href*="action=activate"][href*="swell_child"]').first().getAttribute('href').catch(()=>null);
  if(!href){ note('[!] swell_child 有効化リンク未検出'); throw 'NO_ACTIVATE'; }
  note('    activate href: '+href.replace(/_wpnonce=[^&]+/,'_wpnonce=***'));

  note('[4] ★SWELL CHILD 有効化（不可逆）★');
  await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:60000}).catch(()=>{}), page.goto(href) ]);
  await page.waitForTimeout(3500);
  await page.screenshot({path:`${OUT}/act_10_activated.png`,fullPage:true});

  note('[5] 有効テーマ確認');
  const active = await page.evaluate(()=>{
    const c=document.querySelector('.theme.active .theme-name'); return c?c.textContent.replace(/\s+/g,' ').trim():'(?)';
  });
  note('    active now: '+active);

  note('[6] フロントページ=ホーム(static)設定');
  await page.goto(`${BASE}/wp-admin/options-reading.php`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2000);
  await page.locator('input[name="show_on_front"][value="page"]').check().catch(async()=>{
    await page.locator('input[name="show_on_front"][value="page"]').click();
  });
  await page.locator('select[name="page_on_front"]').selectOption(FRONT_ID).catch(async()=>{
    await page.locator('select[name="page_on_front"]').selectOption({label:'ホーム'});
  });
  await page.screenshot({path:`${OUT}/act_20_reading_set.png`,fullPage:true});
  await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:45000}).catch(()=>{}),
    page.locator('#submit, input[type="submit"]').first().click() ]);
  await page.waitForTimeout(2500);

  note('[7] 設定確認');
  const after = await page.evaluate(()=>{
    const sof=document.querySelector('input[name="show_on_front"]:checked');
    const pof=document.querySelector('select[name="page_on_front"]');
    return { show_on_front: sof?sof.value:null, page_on_front: pof?pof.value:null };
  });
  note('    after: '+JSON.stringify(after));
  await page.screenshot({path:`${OUT}/act_99_done.png`,fullPage:true});
  note('[RESULT] '+JSON.stringify({active, frontSet:after}));
}catch(e){ note('ERR '+(e&&(e.message||e))); await page.screenshot({path:`${OUT}/act_ERR.png`,fullPage:true}).catch(()=>{}); }
finally{ await writeFile(`${OUT}/_activate.log`,log.join('\n')); await b.close(); note('出力: '+OUT); }

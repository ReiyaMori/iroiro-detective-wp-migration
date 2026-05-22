// WordPress 本体（コア）のみを更新する。プラグイン/テーマの一括更新はしない。
// 承認済み（れーや 2026-05-22）。書込権限でFTP情報を求められたら secrets の値を投入。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USERNAME=process.env.WP_USER, PASSWORD=process.env.WP_PASS;
const BASE=process.env.WP_BASE||'https://trust-supply.com';
const FTP_HOST=process.env.FTP_HOST||'silverwombat9.sakura.ne.jp';
const FTP_USER=process.env.FTP_USER||'silverwombat9';
const FTP_PASS=process.env.FTP_PASS||'';
const OUT=process.env.OUT_DIR||'../backup_20260522/wp_update';
if (!USERNAME||!PASSWORD){ console.error('Set WP_USER/WP_PASS'); process.exit(1); }

const log=[]; const note=(m)=>{ console.log(m); log.push(m); };
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch();
const ctx=await browser.newContext({ viewport:{width:1440,height:1600},
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
const page=await ctx.newPage();
const dump=async(f)=>{ const t=(await page.locator('body').innerText().catch(()=> ''))||''; await writeFile(`${OUT}/${f}`,t.slice(0,16000)); return t; };

try {
  note('[1] login');
  await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(USERNAME,{delay:20});
  await page.locator('#user_pass').click();  await page.keyboard.type(PASSWORD,{delay:20});
  await Promise.all([ page.waitForLoadState('networkidle'), page.click('#wp-submit') ]);
  if (page.url().includes('wp-login.php')){ note('LOGIN FAILED'); throw 'LOGIN'; }
  note('  logged in');

  note('[2] open update-core.php');
  await page.goto(`${BASE}/wp-admin/update-core.php`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:`${OUT}/uc_00_before.png`,fullPage:true});
  const before=await dump('uc_00_before.txt');
  const verBefore=(before.match(/バージョン\s*([0-9.]+)/)||[])[1]||'?';
  note('    現在の記述バージョン(参考): '+verBefore);
  if (/最新バージョンの WordPress を使用しています|最新版です|You have the latest version/.test(before)){
    note('[!] 既に最新＝更新不要の表示。コア更新ボタンは出ない可能性'); }

  note('[3] locate CORE update button only (do-core-upgrade form)');
  let btn=page.locator('form[action*="do-core-upgrade"] input[type="submit"], form[action*="do-core-reinstall"] input[type="submit"]').first();
  if (!(await btn.count())){
    // フォールバック: 「バージョン X に更新」テキストのボタン（プラグイン/テーマ/すべては除外）
    btn=page.locator('input[type="submit"], button').filter({hasText:/バージョン.*に更新|今すぐ更新/}).filter({hasNotText:/プラグイン|テーマ|すべて/}).first();
  }
  if (!(await btn.count())){ note('[!] コア更新ボタン未検出（最新 or UI差異）→ 停止'); throw 'NO_CORE_BTN'; }
  const lbl=(await btn.getAttribute('value').catch(()=>'')) || (await btn.innerText().catch(()=>'')) || '';
  note('    core update button: "'+lbl.trim()+'"');

  note('[4] click core update');
  await btn.scrollIntoViewIfNeeded().catch(()=>{});
  await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:60000}).catch(()=>{}), btn.click() ]);
  await page.waitForTimeout(4000);
  await page.screenshot({path:`${OUT}/uc_10_started.png`,fullPage:true});
  let body=await dump('uc_10_started.txt');

  // 書込権限のFTP情報フォームが出たら投入
  if (await page.locator('input[name="hostname"], #hostname, input[name="connection_type"]').count()){
    note('[4b] FTP credentials form detected → fill');
    await page.locator('input[name="hostname"], #hostname').first().fill(FTP_HOST).catch(()=>{});
    await page.locator('input[name="username"], #username').first().fill(FTP_USER).catch(()=>{});
    await page.locator('input[name="password"], #password').first().fill(FTP_PASS).catch(()=>{});
    // connection_type=ftp を選択（あれば）
    await page.locator('select[name="connection_type"]').selectOption('ftp').catch(()=>{});
    const proceed=page.locator('#upgrade, input[name="upgrade"], input[type="submit"][value*="続行"], button:has-text("続行")').first();
    await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:60000}).catch(()=>{}), proceed.click().catch(()=>{}) ]);
    await page.waitForTimeout(4000);
    await page.screenshot({path:`${OUT}/uc_11_ftp_submitted.png`,fullPage:true});
    body=await dump('uc_11_ftp_submitted.txt');
  }

  note('[5] poll for completion (max ~240s)');
  const DONE=/(WordPress|更新|アップグレード).{0,8}(が)?(完了しました|を完了)|WordPress へようこそ|最新バージョン|更新に成功|Welcome to WordPress|データベースを更新/i;
  const FAIL=/インストールに失敗|更新に失敗|失敗しました|Update failed|致命的|Fatal|権限がありません/i;
  let done=false, finalTxt=body;
  for (let i=0;i<48;i++){
    await page.waitForTimeout(5000);
    finalTxt=(await page.locator('body').innerText().catch(()=> ''))||'';
    if (i%2===0) note(`    t+${(i+1)*5}s url=${page.url().split('/wp-admin/')[1]||page.url()}`);
    if (FAIL.test(finalTxt)){ note('[FAIL] '+(finalTxt.match(FAIL)||[])[0]); break; }
    if (DONE.test(finalTxt) || /about\.php/.test(page.url())){ done=true; break; }
  }
  await page.screenshot({path:`${OUT}/uc_99_end.png`,fullPage:true});
  await writeFile(`${OUT}/uc_99_end.txt`, finalTxt.slice(0,16000));

  note('[6] verify version via update-core.php');
  await page.goto(`${BASE}/wp-admin/update-core.php`,{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
  await page.waitForTimeout(2500);
  const verPage=(await page.locator('body').innerText().catch(()=> ''))||'';
  await writeFile(`${OUT}/uc_verify.txt`, verPage.slice(0,8000));
  const verNow=(verPage.match(/バージョン\s*([0-9.]+)/)||[])[1]||(verPage.match(/([0-9]+\.[0-9]+(\.[0-9]+)?)/)||[])[1]||'?';
  note('[7] result: '+JSON.stringify({
    done, fail:FAIL.test(finalTxt),
    最新表示:/最新バージョンの WordPress を使用しています|最新版/.test(verPage),
    verNowGuess:verNow,
  }));
} catch(e){
  note('END/ERROR: '+(e&&(e.message||e)));
  await page.screenshot({path:`${OUT}/uc_ERR.png`,fullPage:true}).catch(()=>{});
} finally {
  await writeFile(`${OUT}/_update.log`,log.join('\n'));
  await browser.close();
  note(`\n出力: ${OUT}/`);
}

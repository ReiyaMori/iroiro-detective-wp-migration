// SWELL親テーマzipをWP管理画面でアップロード（インストール）する。★有効化はしない★
// 非破壊（テーマファイルを追加するのみ・有効テーマはBizVektorのまま）。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USERNAME=process.env.WP_USER, PASSWORD=process.env.WP_PASS;
const BASE=process.env.WP_BASE||'https://trust-supply.com';
const ZIP=process.env.THEME_ZIP;
const FTP_HOST=process.env.FTP_HOST, FTP_USER=process.env.FTP_USER, FTP_PASS=process.env.FTP_PASS;
const OUT=process.env.OUT_DIR||'../backup_20260522/swell_upload';
if (!USERNAME||!PASSWORD||!ZIP){ console.error('Set WP_USER/WP_PASS/THEME_ZIP'); process.exit(1); }

const log=[]; const note=(m)=>{ console.log(m); log.push(m); };
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch();
const page=await (await browser.newContext({ viewport:{width:1440,height:1500},
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' })).newPage();

try {
  note('[1] login');
  await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(USERNAME,{delay:20});
  await page.locator('#user_pass').click();  await page.keyboard.type(PASSWORD,{delay:20});
  await Promise.all([ page.waitForLoadState('networkidle'), page.click('#wp-submit') ]);
  if (page.url().includes('wp-login.php')){ note('LOGIN FAILED'); throw 'LOGIN'; }
  note('  logged in');

  note('[2] open theme-install upload');
  await page.goto(`${BASE}/wp-admin/theme-install.php?upload`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2000);
  const fileInput=page.locator('input[type="file"]#themezip, input[type="file"][name="themezip"]').first();
  // アップロードフォームが折りたたまれている場合は「テーマのアップロード」トグルで展開
  if (!(await fileInput.isVisible().catch(()=>false))){
    note('  upload form collapsed → click toggle to expand');
    await page.locator('.upload-view-toggle, button:has-text("テーマのアップロード"), a:has-text("テーマのアップロード")').first().click().catch(()=>{});
    await page.waitForTimeout(1500);
  }
  if (!(await fileInput.count())){ note('[!] file input未検出'); throw 'NO_FILEINPUT'; }
  note('[3] set zip: '+ZIP);
  await fileInput.setInputFiles(ZIP);
  await page.waitForTimeout(1000);
  await page.screenshot({path:`${OUT}/su_00_fileset.png`,fullPage:true});

  note('[4] click インストール');
  const installBtn=page.locator('#install-theme-submit, input[type="submit"][value*="インストール"], button:has-text("今すぐインストール")').first();
  await installBtn.scrollIntoViewIfNeeded().catch(()=>{});
  await installBtn.waitFor({state:'visible', timeout:15000}).catch(()=>{});
  await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:90000}).catch(()=>{}), installBtn.click() ]);
  await page.waitForTimeout(4000);
  let body=(await page.locator('body').innerText().catch(()=> ''))||'';
  await page.screenshot({path:`${OUT}/su_10_installed.png`,fullPage:true});

  // FTP情報フォームが出たら投入
  if (await page.locator('input[name="hostname"], #hostname').count()){
    note('[4b] FTP form → fill');
    await page.locator('input[name="hostname"], #hostname').first().fill(FTP_HOST||'').catch(()=>{});
    await page.locator('input[name="username"], #username').first().fill(FTP_USER||'').catch(()=>{});
    await page.locator('input[name="password"], #password').first().fill(FTP_PASS||'').catch(()=>{});
    await page.locator('select[name="connection_type"]').selectOption('ftp').catch(()=>{});
    await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:90000}).catch(()=>{}),
      page.locator('#upgrade, input[name="upgrade"], button:has-text("続行")').first().click().catch(()=>{}) ]);
    await page.waitForTimeout(4000);
    body=(await page.locator('body').innerText().catch(()=> ''))||'';
    await page.screenshot({path:`${OUT}/su_11_ftp.png`,fullPage:true});
  }
  await writeFile(`${OUT}/su_install.txt`, body.slice(0,12000));
  const ok=/インストールが完了|正常にインストール|Theme installed successfully|完了しました/.test(body);
  const already=/既にインストール|destination folder already exists|same name/.test(body);
  note('[5] install result: '+JSON.stringify({ok, already,
    末尾: body.split('\n').map(s=>s.trim()).filter(Boolean).slice(-5)}));
  // ★有効化リンクは絶対に押さない★

  note('[6] verify themes list (active=BizVektorのまま / swell存在)');
  await page.goto(`${BASE}/wp-admin/themes.php`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:`${OUT}/su_99_themes.png`,fullPage:true});
  const tbody=(await page.locator('body').innerText().catch(()=> ''))||'';
  await writeFile(`${OUT}/su_themes.txt`, tbody.slice(0,10000));
  const activeMatch=(tbody.match(/有効[:：]?\s*([^\n]{0,40})/)||[])[1]||'';
  note('[7] themes signal: '+JSON.stringify({
    swell存在: /SWELL/i.test(tbody),
    bizvektor存在: /Biz ?Vektor|ビズ/i.test(tbody),
    現在有効の気配: activeMatch.trim().slice(0,30),
    有効テーマ表示: /現在のテーマ|有効: /.test(tbody),
  }));
} catch(e){
  note('END/ERROR: '+(e&&(e.message||e)));
  await page.screenshot({path:`${OUT}/su_ERR.png`,fullPage:true}).catch(()=>{});
} finally {
  await writeFile(`${OUT}/_upload.log`,log.join('\n'));
  await browser.close();
  note(`\n出力: ${OUT}/`);
}

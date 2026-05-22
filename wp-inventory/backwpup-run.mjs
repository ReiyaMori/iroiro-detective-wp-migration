// BackWPup Job 1 を「今すぐ実行」してフルバックアップ(DB+ファイル)を新規作成する。
// 非破壊（バックアップzipとログを増やすのみ・サイト本体は変更しない）。
// 完了まで working ページをポーリングし、結果を報告する。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USERNAME = process.env.WP_USER, PASSWORD = process.env.WP_PASS;
const BASE = process.env.WP_BASE || 'https://trust-supply.com';
const OUT = process.env.OUT_DIR || '../backup_20260522/backwpup_run';
if (!USERNAME || !PASSWORD) { console.error('Set WP_USER/WP_PASS'); process.exit(1); }

const log=[]; const note=(m)=>{ console.log(m); log.push(m); };
await mkdir(OUT, { recursive:true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:1440,height:1600},
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
const page = await ctx.newPage();

try {
  note('[1] login');
  await page.goto(`${BASE}/wp-login.php`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(USERNAME,{delay:20});
  await page.locator('#user_pass').click();  await page.keyboard.type(PASSWORD,{delay:20});
  await Promise.all([ page.waitForLoadState('networkidle'), page.click('#wp-submit') ]);
  if (page.url().includes('wp-login.php')) { note('LOGIN FAILED'); throw 'LOGIN'; }
  note('  logged in');

  note('[2] open backwpup jobs');
  await page.goto(`${BASE}/wp-admin/admin.php?page=backwpupjobs`, { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path:`${OUT}/jobs_before.png`, fullPage:true });

  note('[3] click 今すぐ実行 (Job 1)');
  // 行ホバーで現れるアクションリンク。テキスト「今すぐ実行」を直接クリック。
  const runLink = page.locator('a:has-text("今すぐ実行")').first();
  if (!(await runLink.count())) {
    // ホバーで出る場合: 最初のジョブ行にホバー
    await page.locator('table.wp-list-table tbody tr').first().hover().catch(()=>{});
    await page.waitForTimeout(800);
  }
  const runLink2 = page.locator('a:has-text("今すぐ実行")').first();
  if (!(await runLink2.count())) { note('[!] 今すぐ実行リンク未検出 → 停止'); throw 'NO_RUN'; }
  const href = await runLink2.getAttribute('href');
  note('    run href: ' + (href||'').slice(0,120));
  await Promise.all([ page.waitForLoadState('domcontentloaded',{timeout:45000}).catch(()=>{}), runLink2.click() ]);
  await page.waitForTimeout(3000);
  await page.screenshot({ path:`${OUT}/run_00_start.png`, fullPage:true });

  note('[4] poll working page until done (max ~300s)');
  const DONE = /ジョブ完了|正常に(終了|完了)|Job done|完了しました|エラーで停止|致命的|ABORT|warning[s]?:?\s*[1-9]/i;
  const ERR  = /致命的|ABORT|エラーで停止|FATAL/i;
  let done=false, txt='';
  for (let i=0;i<60;i++){
    await page.waitForTimeout(5000);
    txt = (await page.locator('body').innerText().catch(()=> '')) || '';
    const pct = (txt.match(/(\d{1,3})\s*%/g)||[]).slice(-1)[0] || '';
    if (i%3===0) note(`    t+${(i+1)*5}s pct=${pct} ${/ジョブ完了|Job done|完了/.test(txt)?'(done-ish)':''}`);
    if (DONE.test(txt)) { done=true; break; }
  }
  await page.screenshot({ path:`${OUT}/run_99_end.png`, fullPage:true });
  await writeFile(`${OUT}/run_log.txt`, txt.slice(0,16000));
  note('[5] result: ' + JSON.stringify({ done, fatal: ERR.test(txt),
    末尾: txt.split('\n').map(s=>s.trim()).filter(Boolean).slice(-6) }, null, 0));
} catch(e){
  note('END/ERROR: '+(e&&(e.message||e)));
  await page.screenshot({ path:`${OUT}/run_ERR.png`, fullPage:true }).catch(()=>{});
} finally {
  await writeFile(`${OUT}/_run.log`, log.join('\n'));
  await browser.close();
  note(`\n出力: ${OUT}/`);
}

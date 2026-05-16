// BackWPup 読み取り専用 probe — 既存ジョブ/設定を確認するだけ。作成・実行・変更は一切しない。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USERNAME = process.env.WP_USER;
const PASSWORD = process.env.WP_PASS;
const BASE = process.env.WP_BASE || 'https://trust-supply.com';
const OUT = process.env.OUT_DIR || '../backup_20260516/backwpup_probe';

if (!USERNAME || !PASSWORD) { console.error('Set WP_USER/WP_PASS'); process.exit(1); }

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  console.log('[step] login');
  await page.goto(`${BASE}/wp-login.php`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('#user_login').click();
  await page.keyboard.type(USERNAME, { delay: 25 });
  await page.locator('#user_pass').click();
  await page.keyboard.type(PASSWORD, { delay: 25 });
  await Promise.all([ page.waitForLoadState('networkidle'), page.click('#wp-submit') ]);
  if (page.url().includes('wp-login.php')) {
    await page.screenshot({ path: `${OUT}/00_login_fail.png`, fullPage: true });
    console.error('LOGIN FAILED'); await browser.close(); process.exit(1);
  }
  console.log('  logged in:', page.url());

  // BackWPup ジョブ一覧（読み取りのみ）
  console.log('[step] backwpup jobs list');
  await page.goto(`${BASE}/wp-admin/admin.php?page=backwpupjobs`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  await writeFile(`${OUT}/jobs.html`, await page.content());
  await page.screenshot({ path: `${OUT}/jobs.png`, fullPage: true });

  const jobs = await page.$$eval('table.wp-list-table tbody tr', rows => rows.map(r => {
    const cells = Array.from(r.querySelectorAll('td,th')).map(c => c.textContent.replace(/\s+/g,' ').trim());
    const id = (r.id || '').trim();
    return { id, cells };
  })).catch(() => []);
  await writeFile(`${OUT}/jobs.json`, JSON.stringify(jobs, null, 2));
  console.log(`  ${jobs.length} job row(s)`);
  jobs.forEach((j,i) => console.log(`   [${i}] ${j.cells.filter(Boolean).slice(0,6).join(' | ')}`));

  // BackWPup ダッシュボード/設定（読み取りのみ・宛先や保存先の把握）
  for (const [name, url] of [
    ['dashboard', '/wp-admin/admin.php?page=backwpup'],
    ['settings',  '/wp-admin/admin.php?page=backwpupsettings'],
    ['logs',      '/wp-admin/admin.php?page=backwpuplogs'],
  ]) {
    try {
      await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);
      await writeFile(`${OUT}/${name}.html`, await page.content());
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      console.log(`  saved ${name}`);
    } catch (e) { console.error(`  ${name} failed: ${e.message}`); }
  }

  await browser.close();
  console.log('[done] probe complete — no changes made');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });

// BackWPup バックアップアーカイブ一覧を取得し、最新アーカイブのDLリンク＋セッションcookieを書き出す。
// 読み取りのみ。バックアップの生成・削除・設定変更は一切しない。実DLは後段の curl で行う。
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
    console.error('LOGIN FAILED'); await browser.close(); process.exit(1);
  }
  console.log('  logged in');

  console.log('[step] backwpupbackups page');
  await page.goto(`${BASE}/wp-admin/admin.php?page=backwpupbackups`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await writeFile(`${OUT}/backups.html`, await page.content());
  await page.screenshot({ path: `${OUT}/backups.png`, fullPage: true });

  // 行を緩くパース（テキスト全部 + DLリンク候補）
  const rows = await page.$$eval('table.wp-list-table tbody tr', trs => trs.map(tr => {
    const text = tr.textContent.replace(/\s+/g, ' ').trim();
    const links = Array.from(tr.querySelectorAll('a')).map(a => ({ t: a.textContent.trim(), href: a.href }));
    return { text, links };
  })).catch(() => []);
  await writeFile(`${OUT}/backups.json`, JSON.stringify(rows, null, 2));
  console.log(`  ${rows.length} archive row(s)`);
  rows.forEach((r, i) => {
    console.log(`  [${i}] ${r.text.slice(0, 140)}`);
    r.links.forEach(l => { if (/download|ダウンロード/i.test(l.t) || /download/i.test(l.href)) console.log(`       DL: ${l.t} -> ${l.href}`); });
  });

  // セッションcookieを Cookie ヘッダ文字列で保存（trust-supply.com のみ）
  const cookies = await ctx.cookies();
  const host = new URL(BASE).hostname;
  const cookieHeader = cookies
    .filter(c => host.endsWith(c.domain.replace(/^\./, '')))
    .map(c => `${c.name}=${c.value}`).join('; ');
  await writeFile(`${OUT}/_cookie_header.txt`, cookieHeader);
  console.log(`  cookie header saved (${cookieHeader.length} chars)`);

  await browser.close();
  console.log('[done] no changes made');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });

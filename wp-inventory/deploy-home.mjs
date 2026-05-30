// 本番ホーム固定ページ本文を home-content.html で更新（安全版：更新前に現本文をバックアップ）。
// front page ID は /wp/v2/settings の page_on_front から解決（ハードコード回避）。
// 認証＝WP管理cookie+nonce（apiFetch）。アプリパスワードは残さない。
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const U = process.env.WP_USER, P = process.env.WP_PASS, BASE = 'https://trust-supply.com';
const SRC = process.env.HOME_CONTENT;
const OUT = process.env.OUT_DIR || '/Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective/backup_20260524';
const DRY = process.env.DRY === '1';
if (!U || !P || !SRC) { console.error('Set WP_USER/WP_PASS/HOME_CONTENT'); process.exit(1); }
const HTML = await readFile(SRC, 'utf8');
await mkdir(OUT, { recursive: true });

const b = await chromium.launch();
const page = await (await b.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' })).newPage();
try {
  await page.goto(`${BASE}/wp-login.php`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(U, { delay: 18 });
  await page.locator('#user_pass').click(); await page.keyboard.type(P, { delay: 18 });
  await page.click('#wp-submit');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(3500);
  if (page.url().includes('wp-login.php')) { console.error('LOGIN FAILED'); process.exit(1); }
  // editor/wp-api をロードするため編集画面を一度開く
  await page.goto(`${BASE}/wp-admin/edit.php?post_type=page`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  // front page id 解決
  const settings = await page.evaluate(async () => {
    try { return await window.wp.apiFetch({ path: '/wp/v2/settings' }); }
    catch (e) { return { error: String(e && (e.message || e)) }; }
  });
  const fid = settings && settings.page_on_front;
  console.log('settings:', JSON.stringify({ show_on_front: settings.show_on_front, page_on_front: fid }));
  if (!fid) { console.error('page_on_front 取得失敗'); throw 'NO_FRONT'; }

  // 現本文バックアップ
  const before = await page.evaluate(async (id) => {
    try { const r = await window.wp.apiFetch({ path: `/wp/v2/pages/${id}?context=edit&_fields=id,slug,title,content` });
      return { id: r.id, slug: r.slug, title: r.title && r.title.raw, raw: r.content && r.content.raw }; }
    catch (e) { return { error: String(e && (e.message || e)) }; }
  }, fid);
  if (before.error) { console.error('GET before失敗:', before.error); throw 'GET_BEFORE'; }
  await writeFile(`${OUT}/home_${fid}_before.html`, before.raw || '');
  console.log(`backup: home_${fid}_before.html (len ${(before.raw || '').length}, slug ${before.slug})`);

  if (DRY) { console.log('DRY=1 → 更新せず終了'); throw 'DRY_DONE'; }

  // 更新
  const r = await page.evaluate(async ({ id, html }) => {
    try { const res = await window.wp.apiFetch({ path: `/wp/v2/pages/${id}`, method: 'POST', data: { content: html } });
      return { id: res.id, link: res.link, len: (res.content && res.content.raw ? res.content.raw.length : 0) }; }
    catch (e) { return { error: String(e && (e.message || e)) }; }
  }, { id: fid, html: HTML });
  console.log('UPDATE:', JSON.stringify(r));
  await writeFile(`${OUT}/deploy_home_result.json`, JSON.stringify({ settings: { page_on_front: fid }, before: { slug: before.slug, len: (before.raw || '').length }, result: r }, null, 2));
} catch (e) { if (e !== 'DRY_DONE') console.error('ERR', e && (e.message || e)); }
finally { await b.close(); }

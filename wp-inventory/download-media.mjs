import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USERNAME = process.env.WP_USER;
const PASSWORD = process.env.WP_PASS;
const BASE = process.env.WP_BASE || 'https://trust-supply.com';

if (!USERNAME || !PASSWORD) {
  console.error('Set WP_USER and WP_PASS env vars');
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log('[step] login');
await page.goto(`${BASE}/wp-login.php`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.locator('#user_login').click();
await page.keyboard.type(USERNAME, { delay: 25 });
await page.locator('#user_pass').click();
await page.keyboard.type(PASSWORD, { delay: 25 });
await Promise.all([page.waitForLoadState('networkidle'), page.click('#wp-submit')]);
if (page.url().includes('wp-login.php')) throw new Error('LOGIN FAILED');

// Get nonce
await page.goto(`${BASE}/wp-admin/upload.php`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const restNonce = await page.evaluate(() => {
  if (window.wpApiSettings?.nonce) return window.wpApiSettings.nonce;
  const m = document.documentElement.outerHTML.match(/"nonce":"([a-f0-9]{10})"/);
  return m ? m[1] : null;
});
console.log('  REST nonce:', restNonce ? restNonce.slice(0,8) + '...' : 'NOT FOUND');

await mkdir('data/media', { recursive: true });

// Fetch all media via REST API (paginate)
const all = [];
let pageNum = 1;
while (true) {
  const res = await ctx.request.get(`${BASE}/wp-json/wp/v2/media?per_page=100&page=${pageNum}&context=edit`, {
    headers: { 'X-WP-Nonce': restNonce },
  });
  if (!res.ok()) {
    console.error(`  page ${pageNum}: HTTP ${res.status()}`);
    break;
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) break;
  all.push(...data);
  console.log(`  fetched page ${pageNum}: ${data.length} items (total ${all.length})`);
  if (data.length < 100) break;
  pageNum++;
  if (pageNum > 30) break; // safety cap (3000 items)
}

console.log(`[step] total media items: ${all.length}`);
await writeFile('data/media_list.json', JSON.stringify(
  all.map(m => ({
    id: m.id, title: m.title?.rendered, slug: m.slug, date: m.date, mime: m.mime_type,
    source_url: m.source_url, media_details: { width: m.media_details?.width, height: m.media_details?.height, filesize: m.media_details?.filesize },
  })),
  null, 2
));

// Download each source_url with limited concurrency
const queue = [...all];
let done = 0, fail = 0;
const CONCURRENCY = 6;
async function worker() {
  while (queue.length) {
    const m = queue.shift();
    if (!m || !m.source_url) { fail++; continue; }
    try {
      const fname = m.source_url.split('/').pop().split('?')[0] || `media-${m.id}`;
      const safeName = `${m.id}_${fname}`;
      const res = await ctx.request.get(m.source_url, { timeout: 60000 });
      if (!res.ok()) { fail++; console.error(`  fail ${m.id}: HTTP ${res.status()}`); continue; }
      const buf = await res.body();
      await writeFile(`data/media/${safeName}`, buf);
      done++;
      if (done % 20 === 0) console.log(`  downloaded ${done}/${all.length} ...`);
    } catch (e) {
      fail++;
      console.error(`  fail ${m.id}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`[done] downloaded ${done}, failed ${fail}`);

await browser.close();

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const USERNAME = process.env.WP_USER;
const PASSWORD = process.env.WP_PASS;
const BASE = process.env.WP_BASE || 'https://trust-supply.com';

if (!USERNAME || !PASSWORD) {
  console.error('Set WP_USER and WP_PASS env vars');
  process.exit(1);
}

async function login(page) {
  await page.goto(`${BASE}/wp-login.php`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#user_login').click();
  await page.keyboard.type(USERNAME, { delay: 25 });
  await page.locator('#user_pass').click();
  await page.keyboard.type(PASSWORD, { delay: 25 });
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('#wp-submit'),
  ]);
  if (page.url().includes('wp-login.php')) {
    throw new Error('LOGIN FAILED');
  }
}

async function exportXml(ctx) {
  // export.php is GET-based (no nonce). Fetch via session-cookie request.
  const contents = [
    { type: 'all',              label: 'all-content' },
    { type: 'pages',            label: 'pages' },
    { type: 'posts',            label: 'posts' },
    { type: 'attachment',       label: 'attachments' },
    { type: 'tablepress_table', label: 'tablepress' },
  ];
  for (const c of contents) {
    console.log(`[step] export WXR: ${c.label}`);
    try {
      const res = await ctx.request.get(`${BASE}/wp-admin/export.php?download=true&content=${c.type}`, { timeout: 120000 });
      if (!res.ok()) {
        console.error(`  fail ${c.label}: HTTP ${res.status()}`);
        continue;
      }
      const buf = await res.body();
      const cd = res.headers()['content-disposition'] || '';
      const m = cd.match(/filename="?([^";]+)"?/);
      const fname = m ? m[1] : `${c.label}.xml`;
      const savePath = `data/wxr/${c.label}_${fname}`;
      await writeFile(savePath, buf);
      console.log(`  saved: ${savePath} (${(buf.length/1024).toFixed(1)} KB)`);
    } catch (e) {
      console.error(`  fail ${c.label}: ${e.message}`);
    }
  }
}

async function fetchPageContents(page) {
  console.log('[step] fetch raw content of all pages via REST API');

  // 1. Get the wpApiSettings nonce from an admin page
  await page.goto(`${BASE}/wp-admin/post-new.php?post_type=page`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const restNonce = await page.evaluate(() => {
    if (window.wpApiSettings?.nonce) return window.wpApiSettings.nonce;
    if (window.wp?.apiFetch) {
      // fallback: dig
    }
    // search inline scripts
    const m = document.documentElement.outerHTML.match(/"nonce":"([a-f0-9]{10})"/);
    return m ? m[1] : null;
  });
  console.log('  REST nonce:', restNonce ? restNonce.slice(0,8) + '...' : 'NOT FOUND');

  if (!restNonce) {
    console.warn('  Falling back to scraping edit screen textarea');
    return await scrapeEditScreens(page);
  }

  const pages = JSON.parse(readFileSync('data/pages.json', 'utf8'));
  const results = [];
  for (const p of pages) {
    try {
      const res = await page.request.get(
        `${BASE}/wp-json/wp/v2/pages/${p.id}?context=edit`,
        { headers: { 'X-WP-Nonce': restNonce, 'Accept': 'application/json' } }
      );
      if (!res.ok()) {
        console.error(`  page ${p.id} (${p.title}): HTTP ${res.status()}`);
        results.push({ id: p.id, title: p.title, error: `HTTP ${res.status()}` });
        continue;
      }
      const data = await res.json();
      const raw = data?.content?.raw || data?.content?.rendered || '';
      const meta = {
        id: data.id,
        title: data?.title?.raw || data?.title?.rendered || '',
        slug: data.slug,
        status: data.status,
        date: data.date,
        modified: data.modified,
        parent: data.parent,
        template: data.template,
        menu_order: data.menu_order,
        comment_status: data.comment_status,
      };
      results.push(meta);
      await writeFile(`data/pages/${p.id}_${data.slug || 'noslug'}.html`, raw);
      await writeFile(`data/pages/${p.id}_${data.slug || 'noslug'}.meta.json`, JSON.stringify(data, null, 2));
      console.log(`  ok page ${p.id}: ${meta.title} (${raw.length} chars)`);
    } catch (e) {
      console.error(`  err page ${p.id}: ${e.message}`);
      results.push({ id: p.id, title: p.title, error: e.message });
    }
  }
  await writeFile('data/pages_summary.json', JSON.stringify(results, null, 2));
  console.log(`  total: ${results.length} pages saved`);
}

async function scrapeEditScreens(page) {
  // Fallback: scrape #content textarea (Classic) or Gutenberg code editor
  console.log('  (fallback) scrape edit screens directly');
  const pages = JSON.parse(readFileSync('data/pages.json', 'utf8'));
  for (const p of pages) {
    try {
      await page.goto(`${BASE}/wp-admin/post.php?post=${p.id}&action=edit`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForTimeout(2500);
      // try classic editor textarea
      const classic = await page.locator('#content').count();
      let raw = '';
      if (classic > 0) {
        raw = await page.locator('#content').inputValue();
      } else {
        // Gutenberg: switch to code editor via keyboard shortcut Cmd+Opt+Shift+M
        await page.keyboard.press('Meta+Alt+Shift+M');
        await page.waitForTimeout(1200);
        const codeArea = await page.locator('textarea.editor-post-text-editor, textarea[aria-label="ブロックエディター用のテキスト"]').first();
        if (await codeArea.count() > 0) {
          raw = await codeArea.inputValue();
        }
      }
      await writeFile(`data/pages/${p.id}_${p.title.slice(0,20)}.html`, raw);
      console.log(`  ok ${p.id}: ${raw.length} chars`);
    } catch (e) {
      console.error(`  err ${p.id}: ${e.message}`);
    }
  }
}

async function main() {
  await mkdir('data/pages', { recursive: true });
  await mkdir('data/wxr', { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();

  console.log('[step] login');
  await login(page);

  await exportXml(ctx);
  await fetchPageContents(page);

  await browser.close();
  console.log('[done]');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });

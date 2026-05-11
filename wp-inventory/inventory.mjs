import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const USERNAME = process.env.WP_USER;
const PASSWORD = process.env.WP_PASS;
const BASE = process.env.WP_BASE || 'https://trust-supply.com';

if (!USERNAME || !PASSWORD) {
  console.error('Set WP_USER and WP_PASS env vars. See secrets.local.md');
  process.exit(1);
}

const pages = [
  { name: '10_dashboard',      url: '/wp-admin/' },
  { name: '11_about',          url: '/wp-admin/about.php' },
  { name: '12_site_health',    url: '/wp-admin/site-health.php?tab=debug' },
  { name: '13_general',        url: '/wp-admin/options-general.php' },
  { name: '14_reading',        url: '/wp-admin/options-reading.php' },
  { name: '15_permalink',      url: '/wp-admin/options-permalink.php' },
  { name: '20_plugins',        url: '/wp-admin/plugins.php' },
  { name: '21_themes',         url: '/wp-admin/themes.php' },
  { name: '30_pages',          url: '/wp-admin/edit.php?post_type=page&posts_per_page=200&orderby=title&order=asc' },
  { name: '31_posts',          url: '/wp-admin/edit.php?posts_per_page=100' },
  { name: '40_menus',          url: '/wp-admin/nav-menus.php' },
  { name: '41_widgets',        url: '/wp-admin/widgets.php' },
  { name: '42_customize_link', url: '/wp-admin/customize.php', skipScreenshot: true },
  { name: '50_media',          url: '/wp-admin/upload.php?mode=list&posts_per_page=200' },
  { name: '60_users',          url: '/wp-admin/users.php' },
];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  // Login
  console.log('[step] login');
  await page.goto(`${BASE}/wp-login.php`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/_dbg1_loginpage.png' });

  await page.locator('#user_login').click();
  await page.keyboard.type(USERNAME, { delay: 30 });
  await page.screenshot({ path: 'screenshots/_dbg2_after_user.png' });

  await page.locator('#user_pass').click();
  await page.keyboard.type(PASSWORD, { delay: 30 });
  await page.screenshot({ path: 'screenshots/_dbg3_after_pass.png' });

  // Inspect values before submit
  const valLogin = await page.locator('#user_login').inputValue();
  const valPass  = await page.locator('#user_pass').inputValue();
  console.log(`  user_login='${valLogin}' (len ${valLogin.length})`);
  console.log(`  user_pass=*** (len ${valPass.length})`);

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('#wp-submit'),
  ]);

  const loginCheckUrl = page.url();
  console.log('  url after login:', loginCheckUrl);

  if (loginCheckUrl.includes('wp-login.php')) {
    const html = await page.content();
    await writeFile('html/login_fail.html', html);
    await page.screenshot({ path: 'screenshots/00_login_fail.png', fullPage: true });
    console.error('LOGIN FAILED');
    await browser.close();
    process.exit(1);
  }

  // Visit each admin page
  for (const p of pages) {
    console.log(`[step] ${p.name}`);
    try {
      await page.goto(`${BASE}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);
      const html = await page.content();
      await writeFile(`html/${p.name}.html`, html);
      if (!p.skipScreenshot) {
        await page.screenshot({ path: `screenshots/${p.name}.png`, fullPage: true });
      }
    } catch (e) {
      console.error(`  failed: ${p.name}: ${e.message}`);
    }
  }

  // Extract pages list as structured data
  console.log('[step] extract pages list');
  await page.goto(`${BASE}/wp-admin/edit.php?post_type=page&posts_per_page=500&orderby=ID&order=asc`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);

  const pagesList = await page.$$eval('#the-list tr', rows => rows.map(row => {
    const titleA = row.querySelector('.row-title');
    const id = row.id?.replace('post-', '') || '';
    const title = titleA?.textContent?.trim() || '';
    const viewLink = row.querySelector('.row-actions .view a')?.href || '';
    const editLink = titleA?.href || '';
    const status = row.querySelector('.post-state')?.textContent?.trim() || '';
    const author = row.querySelector('.author a, .author')?.textContent?.trim() || '';
    const date = row.querySelector('.date')?.textContent?.trim() || '';
    return { id, title, status, viewLink, editLink, author, date };
  }));
  await writeFile('data/pages.json', JSON.stringify(pagesList, null, 2));
  console.log(`  ${pagesList.length} pages extracted`);

  // Extract plugins list
  console.log('[step] extract plugins list');
  await page.goto(`${BASE}/wp-admin/plugins.php`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const pluginsList = await page.$$eval('#the-list tr', rows => rows.map(row => {
    const classList = row.className;
    const name = row.querySelector('.plugin-title strong')?.textContent?.trim() || '';
    const desc = row.querySelector('.plugin-description p')?.textContent?.trim() || '';
    const version = row.querySelector('.plugin-version-author-uri')?.textContent?.trim() || '';
    const active = classList.includes('active') && !classList.includes('inactive');
    return { name, active, version, desc };
  }));
  await writeFile('data/plugins.json', JSON.stringify(pluginsList, null, 2));
  console.log(`  ${pluginsList.length} plugins`);

  // Extract themes list
  console.log('[step] extract themes list');
  await page.goto(`${BASE}/wp-admin/themes.php`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const themesList = await page.$$eval('.theme', items => items.map(t => ({
    name: t.querySelector('.theme-name')?.textContent?.trim() || '',
    active: t.classList.contains('active'),
    version: t.querySelector('.theme-version')?.textContent?.trim() || '',
  })));
  await writeFile('data/themes.json', JSON.stringify(themesList, null, 2));
  console.log(`  ${themesList.length} themes`);

  // Site health info (PHP/WP versions etc.)
  console.log('[step] extract site health debug info');
  await page.goto(`${BASE}/wp-admin/site-health.php?tab=debug`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  // Click all expand buttons
  await page.$$eval('.health-check-accordion-trigger', btns => btns.forEach(b => b.click()));
  await page.waitForTimeout(1000);
  const healthInfo = await page.$$eval('.health-check-accordion-panel', panels => panels.map(p => {
    const headerId = p.getAttribute('aria-labelledby');
    const heading = headerId ? document.getElementById(headerId)?.querySelector('span')?.textContent?.trim() : '';
    const rows = Array.from(p.querySelectorAll('tr')).map(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 2) {
        return { key: tds[0].textContent.trim(), value: tds[1].textContent.trim() };
      }
      return null;
    }).filter(Boolean);
    return { section: heading, items: rows };
  }));
  await writeFile('data/site_health.json', JSON.stringify(healthInfo, null, 2));
  await page.screenshot({ path: 'screenshots/12b_site_health_expanded.png', fullPage: true });

  await browser.close();
  console.log('[done]');
}

main().catch(async (e) => {
  console.error('FATAL', e);
  process.exit(1);
});

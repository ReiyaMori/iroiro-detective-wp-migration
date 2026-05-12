import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const BASE = 'https://trust-supply.com';

// 公開固定ページ19件 + トップ + 主要セクション
const targets = [
  { name: '00_home',                       url: '/' },
  { name: '01_company_atfirst',            url: '/company/atfirst' },
  { name: '02_serviceindex_cheating',      url: '/serviceindex/cheating' },
  { name: '03_serviceindex_whereabouts',   url: '/serviceindex/whereaboutssurvey' },
  { name: '04_serviceindex_eavesdropping', url: '/serviceindex/eavesdropping' },
  { name: '05_serviceindex_creditcheck',   url: '/serviceindex/creditcheck' },
  { name: '06_serviceindex_personalcredit',url: '/serviceindex/personalcreditcheck' },
  { name: '07_serviceindex_assets',        url: '/serviceindex/assetsinvestigation' },
  { name: '08_serviceindex_various',       url: '/serviceindex/variousexpertopinionsurvey' },
  { name: '09_serviceindex_stalker',       url: '/serviceindex/stalkermeasures' },
  { name: '10_serviceindex_sexualharass',  url: '/serviceindex/sexualharassment' },
  { name: '11_serviceindex_dv',            url: '/serviceindex/dv' },
  { name: '12_serviceindex_ijime',         url: '/serviceindex/ijime' },
  { name: '13_serviceindex_intimidation',  url: '/serviceindex/intimidation' },
  { name: '14_serviceindex_security',      url: '/serviceindex/securitycamera' },
  { name: '15_serviceindex_special',       url: '/serviceindex/special' },
  { name: '16_otherarea',                  url: '/otherarea' },
  { name: '17_after',                      url: '/after' },
  { name: '18_technic',                    url: '/technic' },
  { name: '19_akutoku',                    url: '/akutoku' },
];

async function captureOne(browser, t, device) {
  const isMobile = device === 'sp';
  const ctx = await browser.newContext({
    viewport: isMobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
    userAgent: isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}${t.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    // scroll to bottom to trigger lazy load
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const totalHeight = document.body.scrollHeight;
      const step = 600;
      for (let y = 0; y < totalHeight; y += step) {
        window.scrollTo(0, y);
        await sleep(120);
      }
      window.scrollTo(0, 0);
      await sleep(400);
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `screenshots/public/${t.name}_${device}.png`, fullPage: true });

    // Also save HTML for content reference (PC only to avoid duplication)
    if (device === 'pc') {
      const html = await page.content();
      await writeFile(`html/public/${t.name}.html`, html);
    }
    console.log(`  ok ${device}: ${t.name}`);
  } catch (e) {
    console.error(`  fail ${device}: ${t.name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  await mkdir('screenshots/public', { recursive: true });
  await mkdir('html/public', { recursive: true });

  const browser = await chromium.launch();

  for (const t of targets) {
    console.log(`[capture] ${t.name} (${t.url})`);
    await captureOne(browser, t, 'pc');
    await captureOne(browser, t, 'sp');
  }

  await browser.close();
  console.log('[done]');
}

main().catch(e => { console.error(e); process.exit(1); });

// ローカルMAMP（http://localhost:8888/ots）の全ページを実機スクショ。
// プレーンpermalink前提で ?page_id= 直叩き（MAMPのpretty404回避・local-staging/README参照）。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:8888/ots/?page_id=';
const OUT = path.resolve('../backup_20260516/local_shots');

const PAGES = [
  ['fv-home', 1908], ['atfirst', 138], ['cheating', 140], ['whereaboutssurvey', 155],
  ['eavesdropping', 158], ['creditcheck', 160], ['personalcreditcheck', 162],
  ['assetsinvestigation', 164], ['variousexpertopinion', 166], ['stalkermeasures', 169],
  ['sexualharassment', 172], ['dv', 175], ['ijime', 177], ['intimidation', 180],
  ['securitycamera', 183], ['special', 192], ['otherarea', 195], ['after', 206],
  ['technic', 208], ['akutoku', 223],
];
const MOBILE = new Set(['fv-home', 'creditcheck', 'akutoku', 'otherarea', 'cheating']);

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

for (const [name, id] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try { await page.goto(BASE + id, { waitUntil: 'networkidle', timeout: 30000 }); }
  catch { await page.goto(BASE + id, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await ctx.close();

  if (MOBILE.has(name)) {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    const mp = await m.newPage();
    try { await mp.goto(BASE + id, { waitUntil: 'networkidle', timeout: 30000 }); }
    catch { await mp.goto(BASE + id, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
    await mp.waitForTimeout(1600);
    await mp.screenshot({ path: `${OUT}/${name}-sp.png`, fullPage: true });
    await m.close();
  }
  console.log(`shot ${name} (id=${id})`);
}
await browser.close();
console.log('done');

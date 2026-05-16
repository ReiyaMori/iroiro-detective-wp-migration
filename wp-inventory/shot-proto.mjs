import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('../site/proto');
const OUT = path.resolve('../backup_20260516/proto_shots');

const targets = [
  ['plan-a', `file://${ROOT}/plan-a/index.html`],
  ['plan-b', `file://${ROOT}/plan-b/index.html`],
];

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

for (const [name, url] of targets) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}-fv.png` });           // FV viewport
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
  console.log(`shot ${name}`);
  await ctx.close();
}
await browser.close();
console.log('done');

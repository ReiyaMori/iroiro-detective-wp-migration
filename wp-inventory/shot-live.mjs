import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('../backup_20260516/proto_shots');
const base = 'https://reiyamori.github.io/iroiro-detective-wp-migration';
const targets = [['live-a', `${base}/plan-a/`], ['live-b', `${base}/plan-b/`], ['live-index', `${base}/`]];

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
for (const [name, url] of targets) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`shot ${name}`);
  await ctx.close();
}
await browser.close();
console.log('done');

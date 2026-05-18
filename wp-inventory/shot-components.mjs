// 先回り実装プレビュー（components.html）の実機スクショ自己検証。
// 子テーマ style.css を直読みするため file:// で開く。本番と同一CSS描画。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const FILE = `file://${path.resolve('../site/proto/plan-a/components.html')}`;
const OUT = path.resolve('../backup_20260516/proto_shots');

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(FILE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/components-full.png`, fullPage: true });
await ctx.close();

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const mp = await m.newPage();
await mp.goto(FILE, { waitUntil: 'networkidle' });
await mp.waitForTimeout(1800);
await mp.screenshot({ path: `${OUT}/components-sp.png`, fullPage: true });
await m.close();

await browser.close();
console.log('done components shots');

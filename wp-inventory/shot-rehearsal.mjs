// 本番手順ドリル検証：front page（/）＋フッター直前ウィジェット＋ヘッダー内部CTAが
// 実SWELLテーマ上で描画されるかを desktop/mobile 撮影。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('../backup_20260516/local_shots');
const T = [
  ['front-home',  'http://localhost:8888/ots/'],            // page_on_front=1908
  ['svc-cheating','http://localhost:8888/ots/?page_id=140'], // 通常P＋footer/header確認
  ['tbl-credit',  'http://localhost:8888/ots/?page_id=160'], // 表ページ＋footer確認
];
const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
for (const [name, url] of T) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  try { await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); }
  catch { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/rehearsal-${name}.png`, fullPage: true });
  await c.close();
  console.log('shot', name);
}
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const mp = await m.newPage();
await mp.goto('http://localhost:8888/ots/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await mp.waitForTimeout(1800);
await mp.screenshot({ path: `${OUT}/rehearsal-front-home-sp.png`, fullPage: true });
await m.close();
await browser.close();
console.log('done rehearsal shots');

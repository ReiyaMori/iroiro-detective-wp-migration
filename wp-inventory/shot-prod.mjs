// 本番ライブのスクショ（desktop+mobile・fullPage）。読み取りのみ。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT = process.env.OUT_DIR || '../backup_20260522/prod_shots';
const TAG = process.env.TAG || 'jstep';
const BASE = 'https://trust-supply.com';
const targets = [['home','/'], ['cheating','/serviceindex/cheating'], ['price','/price']];
await mkdir(OUT, { recursive:true });
const browser = await chromium.launch();
for (const [name,u] of targets){
  for (const [dev,vp] of [['pc',{width:1440,height:1000}],['sp',{width:390,height:844}]]){
    const ctx = await browser.newContext({ viewport:vp, deviceScaleFactor: dev==='sp'?2:1,
      userAgent: dev==='sp'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
    const page = await ctx.newPage();
    try{
      await page.goto(`${BASE}${u}`, { waitUntil:'networkidle', timeout:40000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path:`${OUT}/${TAG}-${name}-${dev}.png`, fullPage:true });
      console.log(`shot ${name}-${dev}`);
    }catch(e){ console.error(`${name}-${dev} ERR`, e&&(e.message||e)); }
    await ctx.close();
  }
}
await browser.close();
console.log('done -> '+OUT);

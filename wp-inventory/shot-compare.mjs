// 承認プロト(plan-a・file://) と ライブ本番 を同条件で撮って比較用に並べる
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT = process.env.OUT_DIR || '../backup_20260522/compare';
const PROTO = 'file:///Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective/site/proto/plan-a';
const pairs = [
  ['home',     `${PROTO}/index.html`,    'https://trust-supply.com/'],
  ['cheating', `${PROTO}/cheating.html`, 'https://trust-supply.com/serviceindex/cheating'],
];
await mkdir(OUT, { recursive:true });
const browser = await chromium.launch();
for (const [name, protoUrl, liveUrl] of pairs){
  for (const [tag, url] of [['proto', protoUrl], ['live', liveUrl]]){
    const ctx = await browser.newContext({ viewport:{width:1440,height:1000},
      userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
    const page = await ctx.newPage();
    try{
      await page.goto(url, { waitUntil:'networkidle', timeout:40000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path:`${OUT}/${name}-${tag}.png`, fullPage:true });
      console.log(`shot ${name}-${tag}`);
    }catch(e){ console.error(`${name}-${tag} ERR`, e&&(e.message||e)); }
    await ctx.close();
  }
}
await browser.close();
console.log('done -> '+OUT);

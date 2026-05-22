// 上部（ヘッダー＋FV）のビューポート比較（fullPageなし）。proto plan-a vs live。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT = process.env.OUT_DIR || '../backup_20260522/compare';
const PROTO='file:///Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective/site/proto/plan-a/index.html';
const targets=[['top-proto',PROTO],['top-live','https://trust-supply.com/']];
await mkdir(OUT,{recursive:true});
const b=await chromium.launch();
for(const [name,url] of targets){
  for(const [dev,vp] of [['pc',{width:1440,height:920}],['sp',{width:390,height:780}]]){
    const ctx=await b.newContext({viewport:vp, deviceScaleFactor: dev==='sp'?2:1,
      userAgent: dev==='sp'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'});
    const page=await ctx.newPage();
    try{ await page.goto(url,{waitUntil:'networkidle',timeout:40000}); await page.waitForTimeout(2000);
      await page.screenshot({path:`${OUT}/${name}-${dev}.png`}); // viewportのみ
      console.log(`shot ${name}-${dev}`);
    }catch(e){console.error(`${name}-${dev} ERR`,e&&(e.message||e));}
    await ctx.close();
  }
}
await b.close(); console.log('done -> '+OUT);

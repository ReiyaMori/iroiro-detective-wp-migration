import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs'; mkdirSync('/tmp/lhdr',{recursive:true});
const b=await chromium.launch();
for(const w of [1000,1200,1440]){
  const pg=await (await b.newContext({viewport:{width:w,height:300},userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'})).newPage();
  await pg.goto('https://trust-supply.com/?v='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
  await pg.waitForTimeout(2500);
  await pg.screenshot({path:`/tmp/lhdr/live_${w}.png`, clip:{x:0,y:0,width:w,height:110}});
  console.log('shot',w); await pg.close();
}
await b.close();

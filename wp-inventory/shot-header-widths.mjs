import { chromium } from 'playwright';
const OUT='/tmp/hdr';
import { mkdirSync } from 'node:fs'; mkdirSync(OUT,{recursive:true});
const b=await chromium.launch();
for(const w of [900,1024,1280,1440]){
  const pg=await (await b.newContext({viewport:{width:w,height:300}})).newPage();
  await pg.goto('file:///tmp/ots-preview.html',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  // ヘッダーだけclip
  const h=await pg.locator('.l-header').boundingBox();
  await pg.screenshot({path:`${OUT}/hdr_${w}.png`, clip:{x:0,y:0,width:w,height:Math.min(120,(h&&h.height)||110)}});
  console.log('shot',w);
  await pg.close();
}
await b.close();

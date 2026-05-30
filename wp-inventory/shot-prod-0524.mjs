import { chromium } from 'playwright';
const OUT='/Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective/backup_20260524/prod_shots';
const U=process.env.WP_USER,P=process.env.WP_PASS;
const b=await chromium.launch();
// ログアウト状態の見た目を見るため新規コンテキスト（管理バー無し）
async function shot(url,name,vp,mobile){
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:mobile?2:1,isMobile:!!mobile,userAgent:mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'});
  const pg=await ctx.newPage();
  await pg.goto(url,{waitUntil:'networkidle',timeout:60000}).catch(()=>{});
  await pg.waitForTimeout(2500);
  await pg.screenshot({path:`${OUT}/${name}.png`,fullPage:true});
  await ctx.close();
  console.log('shot',name);
}
const bust='?v='+Date.now();
await shot('https://trust-supply.com/'+bust,'home_pc',{width:1440,height:1000},false);
await shot('https://trust-supply.com/'+bust,'home_sp',{width:390,height:844},true);
await shot('https://trust-supply.com/serviceindex/cheating'+bust,'cheating_pc',{width:1440,height:1000},false);
await b.close();

// 読み取り専用: SWELLのウィジェット領域(sidebars)と現在のウィジェットをREST(apiFetch)で取得
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
const OUT=process.env.OUT_DIR||'../backup_20260522/widget_recon';
if(!U||!P){console.error('Set WP_USER/WP_PASS');process.exit(1);}
await mkdir(OUT,{recursive:true});
const b=await chromium.launch();
const page=await (await b.newContext({viewport:{width:1440,height:1200},
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})).newPage();
try{
  await page.goto(`${BASE}/wp-login.php`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1000);
  await page.locator('#user_login').click(); await page.keyboard.type(U,{delay:20});
  await page.locator('#user_pass').click(); await page.keyboard.type(P,{delay:20});
  await Promise.all([page.waitForLoadState('networkidle'),page.click('#wp-submit')]);
  if(page.url().includes('wp-login.php')){console.error('LOGIN FAILED');throw 'LOGIN';}
  // apiFetch を使うため editor ページへ
  await page.goto(`${BASE}/wp-admin/widgets.php`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(4000);
  const data = await page.evaluate(async ()=>{
    const out={};
    try{ out.sidebars = await window.wp.apiFetch({path:'/wp/v2/sidebars'}); }catch(e){ out.sidebars_err=String(e&&(e.message||e)); }
    try{ const w = await window.wp.apiFetch({path:'/wp/v2/widgets?_fields=id,id_base,sidebar,rendered'});
      out.widgets = (w||[]).map(x=>({id:x.id,id_base:x.id_base,sidebar:x.sidebar, len:(x.rendered||'').length})); }catch(e){ out.widgets_err=String(e&&(e.message||e)); }
    return out;
  });
  await writeFile(`${OUT}/widgets.json`, JSON.stringify(data,null,2));
  console.log('=== SIDEBARS (ウィジェット領域) ===');
  (data.sidebars||[]).forEach(s=>console.log(`  ${s.id}  "${s.name}"  status=${s.status} widgets=${(s.widgets||[]).length}`));
  if(data.sidebars_err) console.log('  sidebars_err:', data.sidebars_err);
  console.log('\n=== WIDGETS (現在配置) ===');
  const bySb={};
  (data.widgets||[]).forEach(w=>{ (bySb[w.sidebar]=bySb[w.sidebar]||[]).push(w); });
  Object.entries(bySb).forEach(([sb,ws])=>{ console.log(`  [${sb}] ${ws.length}件:`); ws.forEach(w=>console.log(`      ${w.id_base} (id=${w.id}, len=${w.len})`)); });
  if(data.widgets_err) console.log('  widgets_err:', data.widgets_err);
}catch(e){console.error('ERR',e&&(e.message||e));}
finally{await b.close();}

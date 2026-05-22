// H: before_footer の旧ウィジェットを停止→正規フッター(custom_html)投入 / head_box にヘッダーCTA投入。
// 旧ウィジェットは「使用停止中」へ移動（削除しない＝可逆）。REST(apiFetch)で実行。
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
const FOOTER_SRC=process.env.FOOTER_SRC, HEADER_SRC=process.env.HEADER_SRC;
const OUT=process.env.OUT_DIR||'../backup_20260522/widget_set';
if(!U||!P||!FOOTER_SRC){console.error('Set WP_USER/WP_PASS/FOOTER_SRC');process.exit(1);}
const FOOTER=await readFile(FOOTER_SRC,'utf8');
const HEADER=HEADER_SRC?await readFile(HEADER_SRC,'utf8'):'';
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
  await page.goto(`${BASE}/wp-admin/widgets.php`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(4000);

  const res = await page.evaluate(async ({footer, header})=>{
    const af=window.wp.apiFetch; const out={steps:[]};
    // 1) before_footer の既存ウィジェットを停止中へ
    const all = await af({path:'/wp/v2/widgets?_fields=id,id_base,sidebar'});
    const bf = all.filter(w=>w.sidebar==='before_footer');
    for(const w of bf){
      try{ await af({path:`/wp/v2/widgets/${w.id}`, method:'PUT', data:{sidebar:'wp_inactive_widgets'}});
        out.steps.push(`deactivate ${w.id} OK`); }
      catch(e){ out.steps.push(`deactivate ${w.id} ERR ${String(e&&(e.message||e))}`); }
    }
    // 2) 正規フッターを before_footer に custom_html で追加
    try{ const r=await af({path:'/wp/v2/widgets', method:'POST',
        data:{ id_base:'custom_html', sidebar:'before_footer', instance:{ raw:{ title:'', content: footer } } }});
      out.footerWidget={id:r.id, sidebar:r.sidebar}; out.steps.push(`footer custom_html -> ${r.id}`); }
    catch(e){ out.footer_err=String(e&&(e.message||e)); out.steps.push('footer ERR '+out.footer_err); }
    // 3) ヘッダーCTAを head_box に custom_html で追加
    if(header){
      try{ const r=await af({path:'/wp/v2/widgets', method:'POST',
          data:{ id_base:'custom_html', sidebar:'head_box', instance:{ raw:{ title:'', content: header } } }});
        out.headerWidget={id:r.id, sidebar:r.sidebar}; out.steps.push(`header custom_html -> ${r.id}`); }
      catch(e){ out.header_err=String(e&&(e.message||e)); out.steps.push('header ERR '+out.header_err); }
    }
    // 4) 確認
    const after = await af({path:'/wp/v2/widgets?_fields=id,id_base,sidebar'});
    out.before_footer_now = after.filter(w=>w.sidebar==='before_footer').map(w=>w.id);
    out.head_box_now = after.filter(w=>w.sidebar==='head_box').map(w=>w.id);
    return out;
  }, {footer:FOOTER, header:HEADER});

  console.log(JSON.stringify(res,null,2));
  await writeFile(`${OUT}/result.json`, JSON.stringify(res,null,2));
}catch(e){console.error('ERR',e&&(e.message||e));}
finally{await b.close();}

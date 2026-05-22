// H(再): WP7.0ブロックウィジェット環境向け。空で失敗した custom_html を削除し、
// 「block」ウィジェット型(wp:html でラップ)で footer→before_footer / header→head_box を投入。
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
const FOOTER_SRC=process.env.FOOTER_SRC, HEADER_SRC=process.env.HEADER_SRC;
const OUT=process.env.OUT_DIR||'../backup_20260522/widget_set2';
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
    const wrap=(html)=>`<!-- wp:html -->\n${html}\n<!-- /wp:html -->`;
    // 0) 空で失敗した custom_html を削除
    const all = await af({path:'/wp/v2/widgets?_fields=id,id_base,sidebar'});
    for(const w of all.filter(x=>x.id_base==='custom_html')){
      try{ await af({path:`/wp/v2/widgets/${w.id}?force=true`, method:'DELETE'}); out.steps.push(`del ${w.id} OK`);}
      catch(e){ out.steps.push(`del ${w.id} ERR ${String(e&&(e.message||e))}`);}
    }
    // 1) footer → before_footer (block / wp:html)
    try{ const r=await af({path:'/wp/v2/widgets', method:'POST',
        data:{ id_base:'block', sidebar:'before_footer', instance:{ raw:{ content: wrap(footer) } } }});
      out.footer={id:r.id, sidebar:r.sidebar, len:(r.rendered||'').length}; out.steps.push(`footer block -> ${r.id} len=${(r.rendered||'').length}`);}
    catch(e){ out.footer_err=String(e&&(e.message||e)); out.steps.push('footer ERR '+out.footer_err);}
    // 2) header → head_box (block / wp:html)
    if(header){
      try{ const r=await af({path:'/wp/v2/widgets', method:'POST',
          data:{ id_base:'block', sidebar:'head_box', instance:{ raw:{ content: wrap(header) } } }});
        out.header={id:r.id, sidebar:r.sidebar, len:(r.rendered||'').length}; out.steps.push(`header block -> ${r.id} len=${(r.rendered||'').length}`);}
      catch(e){ out.header_err=String(e&&(e.message||e)); out.steps.push('header ERR '+out.header_err);}
    }
    // 3) 確認
    const after = await af({path:'/wp/v2/widgets?_fields=id,id_base,sidebar,rendered'});
    out.before_footer = after.filter(w=>w.sidebar==='before_footer').map(w=>({id:w.id,len:(w.rendered||'').length}));
    out.head_box = after.filter(w=>w.sidebar==='head_box').map(w=>({id:w.id,len:(w.rendered||'').length}));
    return out;
  }, {footer:FOOTER, header:HEADER});
  console.log(JSON.stringify(res,null,2));
  await writeFile(`${OUT}/result.json`, JSON.stringify(res,null,2));
}catch(e){console.error('ERR',e&&(e.message||e));}
finally{await b.close();}

// G: 固定ページ本文中の http://(www.)trust-supply.com を https へ置換（REST per-page）。
// content(post_content)のみ更新＝guid非変更。対象ページのみPUT。可逆（逆置換 or バックアップ復元）。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const U=process.env.WP_USER, P=process.env.WP_PASS, BASE=process.env.WP_BASE||'https://trust-supply.com';
const OUT=process.env.OUT_DIR||'../backup_20260522/https_replace';
const DRY=process.env.DRY==='1';
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
  await page.goto(`${BASE}/wp-admin/post-new.php?post_type=page`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(4500);

  const result = await page.evaluate(async ({dry})=>{
    const af=window.wp.apiFetch; const log=[];
    // 全固定ページ（raw本文）を取得
    let pages=[];
    for (let p=1; p<=3; p++){
      const batch = await af({path:`/wp/v2/pages?per_page=100&page=${p}&context=edit&status=publish,private,draft,pending&_fields=id,link,content,title`}).catch(()=>[]);
      if(!batch||!batch.length) break;
      pages=pages.concat(batch);
      if(batch.length<100) break;
    }
    log.push(`pages fetched: ${pages.length}`);
    let changed=0, totalRepl=0; const details=[];
    for(const pg of pages){
      const raw=(pg.content&&pg.content.raw)||'';
      if(!/http:\/\/(www\.)?trust-supply\.com/.test(raw)) continue;
      const before=(raw.match(/http:\/\/(www\.)?trust-supply\.com/g)||[]).length;
      const next=raw.replace(/http:\/\/www\.trust-supply\.com/g,'https://www.trust-supply.com')
                    .replace(/http:\/\/trust-supply\.com/g,'https://trust-supply.com');
      if(next===raw) continue;
      details.push({id:pg.id, link:pg.link, repl:before, title:(pg.title&&pg.title.raw)||''});
      totalRepl+=before;
      if(!dry){
        try{ await af({path:`/wp/v2/pages/${pg.id}`, method:'POST', data:{ content: next }}); }
        catch(e){ details[details.length-1].err=String(e&&(e.message||e)); }
      }
      changed++;
    }
    return {dry, pagesFetched:pages.length, changedPages:changed, totalReplacements:totalRepl, details, log};
  }, {dry:DRY});

  console.log(JSON.stringify(result,null,2));
  await writeFile(`${OUT}/result.json`, JSON.stringify(result,null,2));
}catch(e){console.error('ERR',e&&(e.message||e));}
finally{await b.close();}

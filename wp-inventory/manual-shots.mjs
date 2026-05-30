// クライアント向けマニュアル用 管理画面スクショ（読み取り専用：goto+screenshotのみ。保存/更新/削除は一切しない）
import { chromium } from 'playwright';
const USER = process.env.WP_USER, PASS = process.env.WP_PASS;
const BASE = process.env.WP_BASE || 'https://trust-supply.com';
const OUT = '/Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective/manual/screenshots';
if(!USER||!PASS){console.error('need WP_USER/WP_PASS');process.exit(1);}

const targets = [
  { name: 'login',        url: '/wp-login.php', full:false, vp:{width:1280,height:760} },
  { name: 'dashboard',    url: '/wp-admin/', full:false },
  { name: 'pages_list',   url: '/wp-admin/edit.php?post_type=page&orderby=title&order=asc' , full:false },
  { name: 'page_edit',    url: '/wp-admin/post.php?post=140&action=edit', full:false, wait:3500 }, // 浮気調査(サービスP・classic HTML)
  { name: 'tablepress',   url: '/wp-admin/admin.php?page=tablepress', full:false },
  { name: 'tablepress_edit', url: '/wp-admin/admin.php?page=tablepress&action=edit&table_id=5', full:false, wait:3000 },
  { name: 'media',        url: '/wp-admin/upload.php?mode=list', full:false },
  { name: 'menus',        url: '/wp-admin/nav-menus.php', full:false },
  { name: 'cf7_list',     url: '/wp-admin/admin.php?page=wpcf7', full:false },
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:1100}, userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
// login
await page.goto(`${BASE}/wp-login.php`, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path:`${OUT}/login.png` });           // ログイン画面（空・creds入力前）
await page.locator('#user_login').fill(USER);
await page.locator('#user_pass').fill(PASS);
await Promise.all([ page.waitForLoadState('networkidle'), page.click('#wp-submit') ]);
if(page.url().includes('wp-login.php')){ console.error('LOGIN FAILED'); await b.close(); process.exit(1); }
console.log('login ok');

for(const t of targets){
  if(t.name==='login') continue; // already shot pre-login
  try{
    await page.goto(`${BASE}${t.url}`, { waitUntil:'domcontentloaded', timeout:45000 });
    await page.waitForTimeout(t.wait||1800);
    if(t.vp) await page.setViewportSize(t.vp);
    await page.screenshot({ path:`${OUT}/${t.name}.png`, fullPage: !!t.full });
    console.log('shot', t.name);
    if(t.vp) await page.setViewportSize({width:1440,height:1100});
  }catch(e){ console.error('fail',t.name, e.message); }
}
await b.close();
console.log('done');

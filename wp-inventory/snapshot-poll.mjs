// SnapUP バックアップ状態の読み取り専用ポーラー（クリックなし）
import { chromium } from 'playwright';
const USER = process.env.SAKURA_USER, PASS = process.env.SAKURA_PASS;
const SNAP = 'https://secure.sakura.ad.jp/rs/cp/sites/snapshot';
if (!USER || !PASS) { console.error('Set SAKURA_USER / SAKURA_PASS'); process.exit(1); }
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1440,height:1600} })).newPage();
try {
  await page.goto('https://secure.sakura.ad.jp/rs/cp/', { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForTimeout(1800);
  await (page.locator('input[name="username"], input[type="text"]:visible').first()).fill(USER);
  await (page.locator('input[name="password"], input[type="password"]:visible').first()).fill(PASS);
  await Promise.all([ page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{}),
    page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first()
        .click().catch(async()=>{ await page.keyboard.press('Enter'); }) ]);
  await page.waitForTimeout(3000);
  await page.goto(SNAP, { waitUntil:'domcontentloaded', timeout:40000 });
  await page.waitForTimeout(3000);
  const body = (await page.locator('body').innerText().catch(()=> ''));
  const btnReq = /リクエスト中/.test(body);
  const canCreate = await page.getByRole('button', { name:'バックアップ作成', exact:true }).count();
  const status = (body.split('\n').map(s=>s.trim())
    .filter(l=>/バックアップ未取得|バックアップ完了|取得日時|\d{4}[-/]\d{2}[-/]\d{2}/.test(l)) || []);
  const ts = (body.match(/\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}(:\d{2})?/g)||[]);
  console.log(JSON.stringify({
    リクエスト中: btnReq,
    作成ボタン復帰: !!canCreate && !btnReq,
    未取得: /バックアップ未取得/.test(body),
    タイムスタンプ: ts.slice(0,3),
    関連行: status.slice(0,5),
  }, null, 2));
} catch(e){ console.error('ERR', e&&(e.message||e)); }
finally { await browser.close(); }

// さくらCP バックアップ&ステージング(SnapUP) の現状を読み取り専用で確認
// 目的: ①SnapUP利用中か ②既存スナップショット/ステージングの有無 ③「スナップショット取得」「ステージング作成」ボタンの所在
// 厳守: ログイン以外のフォーム送信・状態変更（取得/作成/復元/削除）は一切クリックしない。表示(GET)とスクショのみ。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USER = process.env.SAKURA_USER, PASS = process.env.SAKURA_PASS;
const OUT = process.env.OUT_DIR || '../backup_20260522/sakura_cp';
const SNAP = 'https://secure.sakura.ad.jp/rs/cp/sites/snapshot';
if (!USER || !PASS) { console.error('Set SAKURA_USER / SAKURA_PASS'); process.exit(1); }

const log = []; const note = (m)=>{ console.log(m); log.push(m); };
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1440,height:2600} })).newPage();

const dumpBody = async (f) => {
  const t = (await page.locator('body').innerText().catch(()=> '')).slice(0, 12000);
  await writeFile(`${OUT}/${f}`, `URL: ${page.url()}\n\n${t}`); return t;
};

try {
  note('[1] login さくらCP');
  await page.goto('https://secure.sakura.ad.jp/rs/cp/', { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForTimeout(2000);
  await (page.locator('input[name="username"], input[type="text"]:visible').first()).fill(USER);
  await (page.locator('input[name="password"], input[type="password"]:visible').first()).fill(PASS);
  await Promise.all([
    page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{}),
    page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first()
        .click().catch(async()=>{ await page.keyboard.press('Enter'); }),
  ]);
  await page.waitForTimeout(3500);
  note('    post-login url: ' + page.url());

  note('[2] open snapshot page (read-only)');
  await page.goto(SNAP, { waitUntil:'domcontentloaded', timeout:40000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path:`${OUT}/snap_00_state.png`, fullPage:true });
  const body = await dumpBody('snap_00_state.txt');

  // ボタン/リンク全文ダンプ（取得・作成系ボタンの正確なラベルを拾う）
  note('[3] dump buttons/links');
  const els = await page.$$eval('button, a, input[type="submit"], [role="button"]', ns =>
    ns.map(e => ({ t:(e.innerText||e.value||e.textContent||'').trim().replace(/\s+/g,' '),
                   href:e.getAttribute('href')||'', tag:e.tagName.toLowerCase() }))
      .filter(x => x.t && x.t.length < 50));
  const uniq = [...new Map(els.map(l=>[l.t+'|'+l.href,l])).values()];
  await writeFile(`${OUT}/snap_buttons.json`, JSON.stringify(uniq, null, 2));

  const has = (re)=> uniq.some(l=> re.test(l.t)) || re.test(body);
  note('[4] signals: ' + JSON.stringify({
    利用中:           has(/利用中|バックアップ設定|スナップショット一覧/),
    利用開始ボタン残: has(/利用開始/),
    スナップ取得ボタン: has(/取得|今すぐ|手動.?(バック|取得)|スナップショット.?(取得|作成)/),
    ステージング作成:  has(/ステージング.?(作成|を作)|テスト環境/),
    復元:             has(/復元|リストア/),
    既存スナップ件数の気配: (body.match(/\d{4}[-/]\d{2}[-/]\d{2}/g)||[]).length,
  }));
  note('[5] 取得/作成系ボタン候補:');
  uniq.filter(l=>/取得|今すぐ|作成|スナップ|ステージング|復元|手動/.test(l.t))
      .forEach(l=> note(`    [${l.tag}] "${l.t}"`));
} catch(e){
  note('ERROR: '+(e&&(e.message||e)));
  await page.screenshot({ path:`${OUT}/snap_ERR.png`, fullPage:true }).catch(()=>{});
} finally {
  await writeFile(`${OUT}/_snap_state.log`, log.join('\n'));
  await browser.close();
  note(`\n出力: ${OUT}/  （snap_00_state.png/.txt, snap_buttons.json, _snap_state.log）`);
}

// さくらCP SnapUP「バックアップ作成」(クイック /www バックアップ) を起動する
// 承認範囲: 「バックアップ作成」ボタン → （あれば）同一アクションの確認1段のみ。
// 厳守: 「利用解除」「削除」「復元/リストア」は絶対に押さない。規約/有料/フォームが出たら停止。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USER = process.env.SAKURA_USER, PASS = process.env.SAKURA_PASS;
const OUT = process.env.OUT_DIR || '../backup_20260522/sakura_cp';
const SNAP = 'https://secure.sakura.ad.jp/rs/cp/sites/snapshot';
if (!USER || !PASS) { console.error('Set SAKURA_USER / SAKURA_PASS'); process.exit(1); }

const log=[]; const note=(m)=>{ console.log(m); log.push(m); };
const STOP_RE = /(規約|利用規約|同意して|個人情報|クレジット|料金|有料|お申し込み)/;
const DANGER_RE = /(利用解除|削除|復元|リストア)/;

await mkdir(OUT, { recursive:true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1440,height:2600} })).newPage();
const dump = async (f)=>{ const t=(await page.locator('body').innerText().catch(()=> '')).slice(0,12000);
  await writeFile(`${OUT}/${f}`, `URL: ${page.url()}\n\n${t}`); return t; };

try {
  note('[1] login');
  await page.goto('https://secure.sakura.ad.jp/rs/cp/', { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForTimeout(2000);
  await (page.locator('input[name="username"], input[type="text"]:visible').first()).fill(USER);
  await (page.locator('input[name="password"], input[type="password"]:visible').first()).fill(PASS);
  await Promise.all([ page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{}),
    page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first()
        .click().catch(async()=>{ await page.keyboard.press('Enter'); }) ]);
  await page.waitForTimeout(3500);

  note('[2] open snapshot page');
  await page.goto(SNAP, { waitUntil:'domcontentloaded', timeout:40000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path:`${OUT}/create_00_before.png`, fullPage:true });
  const before = await dump('create_00_before.txt');

  // 「バックアップ作成」ボタンを厳密に特定
  note('[3] locate バックアップ作成 button (exact)');
  const btn = page.getByRole('button', { name: 'バックアップ作成', exact:true }).first();
  const cnt = await btn.count();
  if (!cnt) {
    // fallback: 値がバックアップ作成のinput
    const alt = page.locator('button:has-text("バックアップ作成"), input[type="submit"][value="バックアップ作成"]').first();
    if (!(await alt.count())) { note('[!] バックアップ作成ボタン未検出 → 停止'); throw 'NO_BUTTON'; }
  }
  const target = cnt ? btn : page.locator('button:has-text("バックアップ作成"), input[type="submit"][value="バックアップ作成"]').first();
  const label = (await target.innerText().catch(()=>'')) || (await target.getAttribute('value').catch(()=>'')) || '';
  note(`    button label="${label.trim()}"`);
  if (DANGER_RE.test(label)) { note('[STOP] ボタンラベルに危険語 → 中止'); throw 'DANGER'; }

  note('[4] click バックアップ作成 (安全・非破壊)');
  await target.scrollIntoViewIfNeeded().catch(()=>{});
  // confirm ダイアログ(JS confirm)が出たら受諾（バックアップ作成の確認のみ）
  page.on('dialog', async d => { note('    JS dialog: '+d.message().slice(0,120)); await d.accept().catch(()=>{}); });
  await target.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path:`${OUT}/create_10_afterclick.png`, fullPage:true });
  const after = await dump('create_10_afterclick.txt');

  if (STOP_RE.test(after) && !/作成|処理|受付|開始|実行中|バックアップ中/.test(after)) {
    note('[STOP] 規約/有料/フォーム検出 → 停止: ' + (after.match(STOP_RE)||[])[0]); throw 'STOP_SIGNAL';
  }
  // HTML上の確認ボタン（はい/OK/作成する/実行）1段だけ許容
  const confirm = page.getByRole('button', { name: /^(はい|OK|作成|実行|開始|確定)/ }).first();
  if (await confirm.count() && await confirm.isVisible().catch(()=>false)) {
    const lbl = (await confirm.innerText().catch(()=>'?'));
    if (DANGER_RE.test(lbl)) { note('[STOP] 確認ボタンに危険語 → 中止'); throw 'DANGER'; }
    note('[5] 確認1段クリック: '+lbl);
    await confirm.click().catch(()=>{});
    await page.waitForTimeout(4000);
    await page.screenshot({ path:`${OUT}/create_20_afterconfirm.png`, fullPage:true });
    await dump('create_20_afterconfirm.txt');
  } else { note('[5] 確認ダイアログなし'); }

  note('[6] reload to verify status (read-only)');
  await page.goto(SNAP, { waitUntil:'domcontentloaded', timeout:40000 }).catch(()=>{});
  await page.waitForTimeout(4000);
  await page.screenshot({ path:`${OUT}/create_99_final.png`, fullPage:true });
  const fin = await dump('create_99_final.txt');
  const statusLine = (fin.split('\n').find(l=>/バックアップ(ステータス|未取得|中|作成|完了|処理)/.test(l))||'').trim();
  note('[7] status signal: ' + JSON.stringify({
    未取得のまま: /バックアップ未取得/.test(fin),
    作成中の気配: /作成中|処理中|実行中|バックアップ中|受付|順次/.test(fin),
    日時の気配: (fin.match(/\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}/g)||[]).slice(0,3),
  }));
} catch(e){
  note('END/ERROR: '+(e&&(e.message||e)));
  await page.screenshot({ path:`${OUT}/create_ERR.png`, fullPage:true }).catch(()=>{});
} finally {
  await writeFile(`${OUT}/_snap_create.log`, log.join('\n'));
  await browser.close();
  note(`\n出力: ${OUT}/ create_00_before〜create_99_final / _snap_create.log`);
}

// さくらCP バックアップ&ステージング(SnapUP) 「利用開始」だけを押す
// 承認範囲: 「利用開始」クリック→（あれば）同一アクションの確認1段のみ。
// 規約同意・個人情報入力・多段ウィザードが出たら【押し進めず停止して報告】。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USER = process.env.SAKURA_USER, PASS = process.env.SAKURA_PASS;
const OUT = process.env.OUT_DIR || '../backup_20260516/sakura_cp_probe';
const SNAP = 'https://secure.sakura.ad.jp/rs/cp/sites/snapshot';
if (!USER || !PASS) { console.error('Set SAKURA_USER / SAKURA_PASS'); process.exit(1); }

const log = []; const note = (m)=>{ console.log(m); log.push(m); };
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1440,height:2400} })).newPage();

const dumpBody = async (f) => {
  const t = (await page.locator('body').innerText().catch(()=> '')).slice(0, 9000);
  await writeFile(`${OUT}/${f}`, `URL: ${page.url()}\n\n${t}`); return t;
};
// 停止すべきシグナル（規約同意/フォーム/外部アカウント作成）
const STOP_RE = /(規約|利用規約|同意|個人情報|アカウント.?(作成|登録)|メールアドレス|パスワードを入力|お申し込み内容|クレジット|料金|有料)/;

try {
  note('[1] login');
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

  note('[2] open snapshot page (read-only)');
  await page.goto(SNAP, { waitUntil:'domcontentloaded', timeout:40000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path:`${OUT}/A0_before.png`, fullPage:true });
  const before = await dumpBody('A0_before.txt');
  if (/利用中|利用停止|ステージングを作成|スナップショット一覧|バックアップ設定/.test(before)
      && !/利用開始/.test(before)) {
    note('[!] 既に利用開始済みの可能性（利用開始ボタンなし）→ クリックせず終了'); throw 'ALREADY';
  }

  note('[3] locate 利用開始 button');
  let btn = page.getByRole('button', { name: /利用開始/ }).first();
  if (!(await btn.count())) btn = page.locator('a:has-text("利用開始"), button:has-text("利用開始")')
      .filter({ hasNotText: /^\s*$/ }).last(); // 行ラベルでなく緑ボタン側
  if (!(await btn.count())) { note('[!] 利用開始ボタン未検出 → 停止'); throw 'NO_BUTTON'; }
  await btn.scrollIntoViewIfNeeded().catch(()=>{});
  await page.screenshot({ path:`${OUT}/A1_button.png`, fullPage:true });

  note('[4] click 利用開始 (承認済み・このアクションのみ)');
  await btn.click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path:`${OUT}/A2_after_click.png`, fullPage:true });
  const after = await dumpBody('A2_after_click.txt');
  note(`    post-click url: ${page.url()}`);

  // 規約/フォーム/有料/多段が出たら押し進めず停止
  if (STOP_RE.test(after)) {
    note('[STOP] 規約同意/フォーム/有料等のシグナル検出 → ここで停止（承認範囲外）。要れーや判断');
    note('    検出: ' + (after.match(STOP_RE)||[])[0]);
    throw 'STOP_SIGNAL';
  }

  // 同一アクションの確認1段だけ許容（はい/OK/開始する/利用を開始）
  const confirm = page.getByRole('button', { name: /^(はい|OK|開始|利用を開始|実行|確定)/ }).first();
  if (await confirm.count() && await confirm.isVisible().catch(()=>false)) {
    const ctxt = (await page.locator('body').innerText().catch(()=> '')).slice(0,1500);
    if (STOP_RE.test(ctxt)) { note('[STOP] 確認ダイアログに規約/フォーム要素 → 停止'); throw 'STOP_SIGNAL'; }
    note('[5] 同一アクション確認1段をクリック: ' + (await confirm.innerText().catch(()=>'?')));
    await confirm.click().catch(()=>{});
    await page.waitForTimeout(4000);
    await page.screenshot({ path:`${OUT}/A3_after_confirm.png`, fullPage:true });
    await dumpBody('A3_after_confirm.txt');
  } else {
    note('[5] 確認ダイアログなし（クリックで完了 or 状態遷移）');
  }

  // 最終状態を再読込して確認（read-only）
  await page.goto(SNAP, { waitUntil:'domcontentloaded', timeout:40000 }).catch(()=>{});
  await page.waitForTimeout(3500);
  await page.screenshot({ path:`${OUT}/A9_final_state.png`, fullPage:true });
  const fin = await dumpBody('A9_final_state.txt');
  note('[6] 最終状態シグナル: ' +
    JSON.stringify({
      利用開始ボタン残存: /利用開始/.test(fin),
      利用中表記: /利用中|利用停止|ステージング(を)?(作成|管理)|スナップショット一覧|バックアップ設定/.test(fin),
    }));
} catch (e) {
  note('END/ERROR: ' + (e && (e.message||e)));
  await page.screenshot({ path:`${OUT}/A_ERR.png`, fullPage:true }).catch(()=>{});
} finally {
  await writeFile(`${OUT}/_activate.log`, log.join('\n'));
  await browser.close();
  note(`\n出力: ${OUT}/ A0_before〜A9_final / *.txt / _activate.log`);
}

// さくらコントロールパネル 読み取り専用プローブ
// 目的: ①バックアップ&ステージング機能の有無 ②PHPバージョン ③接続ドメイン/SSL
// 厳守: ログイン以外のフォーム送信・状態変更ボタン（申込/有効化/変更/削除/保存）は一切クリックしない。
//       ナビゲーション（ページ遷移）とスクショ取得のみ。
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const USER = process.env.SAKURA_USER;   // さくらCP ログインID（secrets.local.md 参照）
const PASS = process.env.SAKURA_PASS;   // サーバパスワード
const CP = 'https://secure.sakura.ad.jp/rs/cp/';
const OUT = process.env.OUT_DIR || '../backup_20260516/sakura_cp_probe';

if (!USER || !PASS) { console.error('Set SAKURA_USER / SAKURA_PASS (see secrets.local.md)'); process.exit(1); }

const log = [];
const note = (m) => { console.log(m); log.push(m); };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 2400 } });
const page = await ctx.newPage();

try {
  note(`[1] open ${CP}`);
  await page.goto(CP, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/00_login.png`, fullPage: true });

  // --- login (唯一許可されたフォーム送信) ---
  note('[2] fill login form');
  // さくらCP: ドメイン名 + パスワード。robustに最初のtext系inputとpassword inputを使う
  const userSel = ['input[name="username"]', 'input[name="domain"]', 'input[name="user"]',
                   'input[type="text"]:visible', 'input:not([type="password"]):not([type="hidden"]):visible'];
  const passSel = ['input[name="password"]', 'input[type="password"]:visible'];
  let filledU = false, filledP = false;
  for (const s of userSel) { const el = page.locator(s).first();
    if (await el.count() && await el.isVisible().catch(()=>false)) { await el.fill(USER); filledU = true; break; } }
  for (const s of passSel) { const el = page.locator(s).first();
    if (await el.count() && await el.isVisible().catch(()=>false)) { await el.fill(PASS); filledP = true; break; } }
  note(`    user filled=${filledU} pass filled=${filledP}`);
  await page.screenshot({ path: `${OUT}/01_login_filled.png`, fullPage: true });

  const submit = page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first();
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 45000 }).catch(()=>{}),
    submit.click().catch(async () => { await page.keyboard.press('Enter'); }),
  ]);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/02_after_login.png`, fullPage: true });
  note(`    post-login url: ${page.url()}`);

  // --- ナビゲーション/メニュー全文ダンプ（機能の有無はメニュー存在で判定可能） ---
  note('[3] dump navigation links');
  const links = await page.$$eval('a, [role="menuitem"], button', els =>
    els.map(e => ({ t: (e.innerText||e.textContent||'').trim().replace(/\s+/g,' '),
                    href: e.getAttribute('href')||'' }))
       .filter(x => x.t && x.t.length < 60));
  const uniq = [...new Map(links.map(l => [l.t + '|' + l.href, l])).values()];
  await writeFile(`${OUT}/nav.json`, JSON.stringify(uniq, null, 2));
  const menuText = uniq.map(l => l.t).join(' | ');
  note(`    nav items: ${uniq.length}`);

  // 機能シグナル（メニュー文言での一次判定）
  const has = (kw) => uniq.some(l => l.t.includes(kw));
  const signals = {
    'バックアップ＆ステージング': has('ステージング') || has('バックアップ＆ステージング') || has('バックアップ'),
    'ステージング(単独語)': has('ステージング'),
    'スナップショット': has('スナップショット'),
    'PHP/言語バージョン': has('バージョン') || has('PHP') || has('言語'),
    'ドメイン/SSL': has('ドメイン') || has('SSL'),
  };
  note('[4] menu signals: ' + JSON.stringify(signals, null, 0));

  // --- 既知の read-only URL へ直接遷移してスクショ（nav.json実測のhref／状態変更しない） ---
  // 表示(GET)のみ。申込/作成/有効化/削除/保存ボタンは絶対にクリックしない。
  const targets = [
    { key: 'staging', url: '/rs/cp/sites/snapshot' },  // バックアップ＆ステージング(スナップショット)
    { key: 'phpver',  url: '/rs/cp/script/phpini' },   // 言語/php設定（バージョン確認の足がかり）
    { key: 'domain',  url: '/rs/cp/domain/list' },     // ドメイン/SSL 一覧（接続ドメイン＋SSL状態）
  ];
  let idx = 10;
  for (const tg of targets) {
    note(`[5] navigate(GET only) -> ${tg.key} ${tg.url}`);
    await page.goto(`https://secure.sakura.ad.jp${tg.url}`,
      { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(e => note(`    goto err: ${e.message}`));
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${idx}_${tg.key}.png`, fullPage: true });
    const body = (await page.locator('body').innerText().catch(()=>'')).slice(0, 9000);
    await writeFile(`${OUT}/${idx}_${tg.key}.txt`, `URL: ${page.url()}\n\n${body}`);
    idx += 10;
  }

  await page.screenshot({ path: `${OUT}/99_final.png`, fullPage: true });
} catch (e) {
  note('ERROR: ' + (e && e.message));
  await page.screenshot({ path: `${OUT}/ERR.png`, fullPage: true }).catch(()=>{});
} finally {
  await writeFile(`${OUT}/_probe.log`, log.join('\n'));
  await browser.close();
  note(`\n出力: ${OUT}/  （00_login〜99_final / nav.json / *.txt / _probe.log）`);
}

// ローカル検証用：実 style.css ＋ home-content.html ＋ 擬似SWELLヘッダーを合成し
// /tmp/ots-preview.html を生成→desktop/mobileスクショ。本番非接触のCSS/HTML確認用（崩れ検出）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = '/Users/mori/WATAGE/jutaku/projects/13010878_iroiro_detective';
const cssPath = ROOT + '/site/swell-theme/swell_child/style.css';
const logo = ROOT + '/site/swell-theme/swell_child/assets/ots-logo.png';
let home = readFileSync(ROOT + '/site/local-staging/home-content.html', 'utf8');
// 本番アセットパスをローカル絶対パスに置換（プレビューで画像を解決）
home = home.replaceAll('/wp-content/themes/swell_child/assets/', 'file://' + ROOT + '/site/swell-theme/swell_child/assets/');

const headerInner = `
  <div class="c-headLogo"><a class="c-headLogo__link" href="#"><img class="ots-logo-img" src="${logo}" alt="株式会社OTS探偵社"></a></div>
  <nav class="c-gnav"><ul class="c-gnav__list" style="display:flex;gap:22px;list-style:none;margin:0;padding:0">
    <li class="c-gnav__item"><a href="#">ホーム</a></li>
    <li class="c-gnav__item"><a href="#">調査項目一覧</a></li>
    <li class="c-gnav__item"><a href="#">調査料金</a></li>
    <li class="c-gnav__item"><a href="#">調査技術・機材</a></li>
    <li class="c-gnav__item"><a href="#">よくある質問</a></li>
    <li class="c-gnav__item"><a href="#">スタッフ研修</a></li>
    <li class="c-gnav__item"><a href="#">会社情報</a></li>
  </ul></nav>
  <div class="ots-hcta"><a class="ots-hcta__tel" href="tel:0120556624">0120-556-624</a><a class="ots-hcta__form" href="#">無料相談</a></div>`;

const htmlPage = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap">
<link rel="stylesheet" href="${cssPath}">
<style>
  body{margin:0}
  .l-header,.l-header__bar{position:relative}
  .l-header__inner{display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:1200px;margin:0 auto;padding:10px 24px}
  .c-gnav a{text-decoration:none;font-size:15px}
</style></head>
<body class="home page">
  <header class="l-header"><div class="l-header__bar"><div class="l-header__inner">${headerInner}</div></div></header>
  <div id="main" class="l-mainContent"><div class="l-mainContent__inner"><article class="l-article"><div class="post_content">
${home}
  </div></article></div></div>
</body></html>`;

const out = '/tmp/ots-preview.html';
writeFileSync(out, htmlPage);

const b = await chromium.launch();
const pd = await b.newPage({ viewport: { width: 1440, height: 1200 } });
await pd.goto('file://' + out, { waitUntil: 'networkidle' });
await pd.waitForTimeout(1200);
await pd.screenshot({ path: '/tmp/ots_pre_pc_full.png', fullPage: true });
await pd.setViewportSize({ width: 1440, height: 820 });
await pd.screenshot({ path: '/tmp/ots_pre_pc_fv.png' });
await pd.close();
const pm = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
await pm.goto('file://' + out, { waitUntil: 'networkidle' });
await pm.waitForTimeout(1200);
await pm.screenshot({ path: '/tmp/ots_pre_sp_fv.png' });
await pm.close();
await b.close();
console.log('done; wrote /tmp/ots-preview.html');

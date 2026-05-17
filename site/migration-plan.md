# OTS探偵社 SWELL移行計画（コンテンツ移行解析）

- 作成: 2026-05-17（先方デザイン確定後・先方待ち中の前倒し作業）
- 対象: 固定ページ20件（投稿62件は移管対象外＝4/29合意）
- 解析元: `wp-inventory/data/pages/*.html`（REST API context=edit の生 post_content）＋ `*.meta.json` ＋ `wp-inventory/data/wxr/`
- 確定デザイン仕様: `site/proto/plan-a`（A案＋教科書体Klee One）

---

## 1. 最重要結論：移行リスクは想定より大幅に低い

| 懸念（CLAUDE.md「やってはいけないこと」） | 実測結果 | 影響 |
|---|---|---|
| VKブロック残置で表示崩れ | **本文中VKブロック/ショートコード = 0件**（`vk_`/`vk-`/`[vkExUnit`/`class="vk"` すべて0） | ✅ VK→SWELL変換作業は**ほぼ不要**。最大の地雷が実質回避 |
| TablePress依存 | 本文中 `[tablepress]` = **0件**。表は生 `<table class="sta">` 直書き（16表） | ✅ TablePressプラグインの有無は20P表示に影響しない見込み（要最終確認・優先度低） |
| Gutenbergブロック変換地獄 | `wp:*` ブロックコメントは4ファイルにわずかに `wp:paragraph`/`wp:heading` のみ | ✅ ほぼ**クラシックHTML**。Gutenberg完全ブロック化は不要（過剰実装） |

→ コンテンツは **2014年製のクラシックHTML**。移行の本体は「HTML本文の流用 ＋ 子テーマCSSでトンマナ一括適用 ＋ 階層/URL/画像の保全」であり、ブロック単位の手変換ではない。**子テーマCSSの作り込みが移行品質を決める**（→ `site/swell-theme/swell_child/style.css`）。

---

## 2. コンテンツ構造（実測）

### 2.1 マークアップ
- 使用タグ（全20P集計・多い順）: `td(151)` `strong(116)` `p(101)` `li(84)` `tr(63)` `div(63)` `ul(56)` `img(38)` `a(32)` `h4(23)` `span(22)` `tbody(16)` `table(16)` `h3(16)` `h5(13)` `br(4)` `figure(1)`
- **ショートコード: 完全に0件**
- 見出しは `h3`（セクション）/`h4`（小見出し）/`h5`（細目）。SWELLのh2見出し装飾とズレるため**子テーマで h3〜h5 を確定デザインに合わせる**必要あり（重要）
- 表は旧HTML属性直書き: `<table class="sta" border="0" width="555" cellspacing="0" cellpadding="20" align="center">`。`class="sta"` が共通フック → **子テーマで `.post_content table`／`.sta` を確定Plan Aの料金表デザイン（オレンジヘッダー/cream/角丸/罫）に一括適用すれば16表が同時に整う**（最大の効率ポイント）

### 2.2 レガシーinline style（17/20ファイルに `style=`）
- 典型: `style="padding-left: 30px;"`（本文インデント）、`<span style="color: #000000;">`（黒指定）
- 害は小さいが教科書体トンマナ統一のため、主要パターンは子テーマCSSへ寄せる方針（本文は消さない＝CLAUDE.md「クライアント提供テキストを勝手に書き換えない」）。inline color/padディング は子テーマで上書き吸収を基本とし、HTMLは原則改変しない

### 2.3 ページ別サマリ
| ページ(slug) | bytes | 生table | img | 特徴・移行注意 |
|---|--:|--:|--:|---|
| 2 /flow（非公開） | 5518 | 0 | 13 | 「相談〜調査〜アフター」フロー図。画像13点＝ステップ画像。**非公開**＝公開要否を先方確認（現状非公開なら移行後も非公開維持） |
| 138 /company/atfirst（代表挨拶） | 2262 | 0 | 1 | 親=1295・テンプレ`page-parent.php`。本文＋FreeDial画像。確定デザインの「想い」トーンと親和 |
| 140 /serviceindex/cheating（浮気/素行） | 4933 | 0 | 1 | h3×5の主要サービスP。プロト`plan-a/cheating.html`が設計参考 |
| 155 /serviceindex/whereaboutssurvey | 1610 | 0 | 0 | 小。テキストのみ |
| 158 /serviceindex/eavesdropping | 5165 | 1 | 1 | 表1＋リスト6 |
| 160 /serviceindex/creditcheck | 4073 | 2 | 1 | 法人信用調査。Defense/Offense表2＋料金（例:165,000円税込）。`class="sta"`表 |
| 162 /serviceindex/personalcreditcheck | 5924 | 3 | 0 | 表3＋リスト17＝最も表が多い。テーブルCSSの検証基準ページにする |
| 164 /serviceindex/assetsinvestigation | 1621 | 1 | 1 | 表1 |
| 166 /serviceindex/variousexpertopinionsurvey | 4223 | 4 | 1 | **表4＝最多**。各種鑑定の料金表群 |
| 169 /serviceindex/stalkermeasures | 3392 | 1 | 1 | 表1＋リスト8 |
| 172 /serviceindex/sexualharassment | 1993 | 1 | 1 | 表1 |
| 175 /serviceindex/dv | 2348 | 1 | 1 | 表1 |
| 177 /serviceindex/ijime | 4523 | 1 | 1 | 表1＋h3-5×3 |
| 180 /serviceindex/intimidation | 2044 | 1 | 1 | 表1 |
| 183 /serviceindex/securitycamera | 2524 | 0 | 7 | 画像7＝機材写真主体。画像レイアウト要配慮 |
| 192 /serviceindex/special（特殊調査） | 2176 | 0 | 1 | 小 |
| 195 /otherarea（他県の方へ） | 7356 | 0 | 1 | テキスト多。地域SEO本文。URL `/otherarea` 維持必須 |
| 206 /after（カウンセリング・アフターケア） | 4999 | 0 | 1 | 確定デザインの訴求と親和 |
| 208 /technic（調査技術・機材） | 1171 | 0 | 0 | 最小。テキストのみ |
| 223 /akutoku（悪徳業者の見分け方） | 21040 | 0 | 4 | **最大・h見出し13＝記事級**。SEO資産。教科書体の長文可読性検証ページにする |

---

## 3. URL・階層・テンプレートの保全（SEO要件＝最重要）

- meta.json実測: 各ページに `"parent": 1295` 等の**親子階層**、`"template": "page-parent.php"`（BizVektor固有テンプレ）
- パーマリンク例（CLAUDE.md確定リスト）: `/company/atfirst`, `/serviceindex/cheating`, `/otherarea`, `/after`, `/technic`, `/akutoku` 等 ＝ **親スラッグ込みの階層URL**
- **移行要件**:
  1. `/serviceindex/*`・`/company/*` の階層を保つには、**親ページ（serviceindex, company 等）も移行対象に含めて保持**する（20件は子ページ中心。親ページの存在/スラッグを棚卸しで確定する）。親を消すと全子URLが変わりSEO崩壊
  2. `page-parent.php` テンプレ指定はSWELLに存在しない → 移行後は**テンプレ未指定（標準）**になる。レイアウトは SWELL カスタマイザー＋子テーマCSSで再現。テンプレ依存の段組みがあれば子テーマで代替実装
  3. パーマリンク設定（投稿名/階層）を本番と一致させてからインポート。スラッグは1文字も変えない
  4. 切替後 `curl` で全20P＋親ページの 200、旧URL（http/末尾スラッシュ有無）の 200/301 を確認（CLAUDE.md既定の検証）

---

## 4. 画像の扱い

- 本文画像は全て**絶対URL** `http://www.trust-supply.com/wp-content/uploads/YYYY/MM/...`、`class="wp-image-NNN"` でメディアID紐付け（例 `wp-image-603`）
- 同一ドメイン継続のため src パスは生きる。**メディアは削除しない**（CLAUDE.md既定＝IDと本文が紐付く）
- ⚠️ **https化リスク**: 本文中に `http://www.trust-supply.com` の絶対URL **54件**。WP/サーバをhttps化（推奨）すると**混在コンテンツ**になる。対応:
  - 移行時にDB/本文の `http://www.trust-supply.com` → `https://www.trust-supply.com`（または `//`）へ一括置換（Search-Replace。シリアライズ対応のWP-CLI/プラグインで）
  - もしくは `www.` 有無の正規化も同時に確認（既存が www 付き運用）
  - 置換はステージングで実施→検証してから本番反映（本文の直書き改変ではなくURL正規化＝CLAUDE.md許容範囲）

---

## 5. 移行手順（このプランの実行順・サーバ作業はれーや/さくらパネル）

1. **棚卸し補完**: 親ページ（serviceindex/company 等）のID・スラッグ・本文を確定（20件は子。親が抜けると階層URL崩壊）
2. **バックアップ再取得**（テーマ切替直前）: phpMyAdmin 全DB＋FTP `www/` ＋ BackWPup（CLAUDE.md既定）
3. **ステージング複製**（さくら「バックアップ＆ステージング」or サブディレクトリ）
4. ステージングで: WPアップデート（セキュリティ）→ SWELL＋子テーマ有効化 → パーマリンク一致
5. コンテンツ確認: クラシックHTMLのまま流用（Classic/自由形式ブロック）。**ブロック完全変換しない**
6. `http://→https://` 本文URL一括置換（Search-Replace・シリアライズ安全な方法）
7. **子テーマCSSでトンマナ一括適用**（`.post_content` の h3-5/table.sta/p/ul/a/img、ヘッダー帯、FV、CTA、フッター＝確定Plan A）
8. 全20P＋親ページ PC/SP 検証、表崩れ・画像・内部リンク・パーマリンク・CF7・GA4
9. 本番反映（先方合意の時間帯）→ curl で 200/301 全数確認

---

## 6. 先方確認・未決（reply等で確定する）

- 「教科書体＝Klee One」への異議の有無（reply-0517で確認中・最重要）
- `/flow`（ID2）は現状**非公開**。公開要否（非公開のままか）
- 親ページ（serviceindex/company 等）の扱い＝20件に含むか／そのまま保持か（階層URL維持のため保持が前提）
- https化方針（推奨）と本文URL一括置換の了承（SEO・混在コンテンツ回避）
- TablePressプラグインの最終要否（20P本文には不要だが他箇所利用の有無を念のため確認・優先度低）

## 7. このプランで潰せたリスク（先方待ち中の前進）

- ✅ VK変換地獄が「無」と確定（最大の不確実性が消えた）
- ✅ 移行方式が「クラシックHTML流用＋子テーマCSS一括」に確定＝工数見積もりが立つ
- ✅ https化の本文URL置換（54件）という見落としやすい地雷を事前に特定
- ✅ 階層URL（親ページ保持）というSEO崩壊リスクを事前に特定
- ✅ 表16個が `class="sta"` 共通＝子テーマCSS一発で整う効率ポイントを特定

# ローカルSWELLステージング（MAMP）— 手順と実証結果

- 作成: 2026-05-17（先方A/B確定後・先方返答待ち中の前倒し）
- 目的: 客先本番さくらサーバーに**一切触れず**、ローカルMAMPで WP+SWELL+確定子テーマ＋実20P を組み、確定デザインが実コンテンツでどう描画されるかを実証する
- 結果: ✅ 成功。確定Plan A（A案＋教科書体）が 2014年製の生BizVektor HTML に子テーマCSSで自動適用されることを実機検証済

## 環境（このマシンの実測値）

| 項目 | 値 |
|---|---|
| MAMP | `/Applications/MAMP`（htdocsに既存 `clubakino`） |
| 起動 | `/Applications/MAMP/bin/start.sh`（Apache+MySQL・CLIで起動可） |
| Apache | `http://localhost:8888/` |
| MySQL | MySQL 8.0.44 / `127.0.0.1:8889` / root / root / socket `/Applications/MAMP/tmp/mysql/mysql.sock` |
| PHP CLI | `/Applications/MAMP/bin/php/php8.3.30/bin/php` |
| WP-CLI | `/Applications/MAMP/htdocs/clubakino/wp-cli.phar`（既存・v2.12.0） |
| ローカルWP | `/Applications/MAMP/htdocs/ots` / DB `ots_local` / WP 6.9.4(ja) / `http://localhost:8888/ots/` |
| 管理 | admin / admin（ローカルのみ） |

## 再現手順（setup.sh に自動化済）

```bash
bash site/local-staging/setup.sh
```

実行内容（手動再現する場合の要点）:
1. `start.sh` で MAMP 起動 → MySQL `127.0.0.1:8889` root/root 疎通
2. `mysql ... -e "CREATE DATABASE ots_local ..."`
3. `wp core download --locale=ja` → `wp config create`（dbhost=127.0.0.1:8889）→ `wp core install`
4. `wp theme install site/swell-theme/swell-2.16.0-official.zip`
5. 子テーマ `site/swell-theme/swell_child/`（assets/fv-a.jpg含む）を `wp-content/themes/swell_child` へコピー → `wp theme activate swell_child`
6. `wp plugin install wordpress-importer --activate`
7. `wp import wp-inventory/data/wxr/pages_ots.WordPress.2026-05-12.xml --authors=create --skip=attachment`
8. `wp rewrite structure ''`（プレーンpermalink＝ローカル検証用。下記「ハマり所」参照）
9. 検証スクショは `wp-inventory/` から playwright で `?page_id=` 直叩き

## ハマり所（本番では問題にならないMAMP固有差・重要）

1. **pretty permalink が 404**:
   MAMPは htdocs に `AllowOverride None`（既定）→ WP の `.htaccess` 書換ルールが効かず
   `/serviceindex/cheating/` 等が 404。WPはcanonicalで `?page_id=` → pretty へ **301** するため
   `?page_id=` も結果404になる。
   → **ローカル検証はプレーンpermalink（`wp rewrite structure ''`）で `?page_id=N` 直叩き**で回避。
   → **本番さくらは mod_rewrite/.htaccess 有効**＝pretty URLは正常。よってこれは移行リスクではなく
     ローカル環境差。階層URLの正しさは WP-CLI `wp post url` で別途実証済（下記）。
   （ローカルでもpretty確認したい場合のみ MAMP httpd.conf の htdocs を AllowOverride All に。
     ただし clubakino 等 他プロジェクトに影響する全体設定のため本検証では変更しない方針）

2. **画像は本番URL参照で検証**:
   ローカルDLメディアは `wp-inventory/data/media/` に `ID_filename` 形式のフラット保存で
   `2014/09/...` パスを保持していない。本文画像は絶対URL
   `http://www.trust-supply.com/wp-content/uploads/...`。本番サイト稼働中のため
   `--skip=attachment` で取込み、画像は本番から読ませて**デザイン検証**。
   → 実移行では migration-plan.md §4 の通り `http://→https://` Search-Replace を
     ステージング（さくら）で実施する。

## 実証できたこと（先方待ち中に潰せた不確実性）

- ✅ 確定子テーマ `functions.php` の Klee One エンキューが**実SWELL 2.16.0で動作**
  （`<link id='ots-klee-one-css' ...>` 出力・致命エラーなし・HTTP200）
- ✅ `.post_content` 計算値が全ページで `font-family: "Klee One"`（教科書体）
- ✅ `.post_content h3` = 文字色 `#972C00` ＋左ボーダー `5px #D06112`（確定Plan Aアクセント）
- ✅ **生 `<table class="sta">`（2014年BizVektor直書き）が、子テーマCSSだけで
  白角丸12px＋オレンジヘッダ＋ダイヤ箇条書きの確定料金表デザインに自動変換**
  （creditcheck=表2／personalcreditcheck=表3 で実描画確認）。
  ＝migration-plan.md の「クラシックHTML × .post_content一括CSS」効率仮説を実証
- ✅ **階層URL/スラッグ/親子が実インポートで完全一致**（WP-CLI実測）:
  - `/company/atfirst/`（parent=1295 company）
  - `/serviceindex/{cheating,creditcheck,…}/`（parent=430 serviceindex・15サービスP）
  - `/otherarea/` `/after/` `/technic/` `/akutoku/`（トップ階層）
  - pages WXR に親ページ（serviceindex/company）も含まれ69→71ページ取込
  ＝migration-plan.md §3 の最重要SEOリスク（親ページ欠落でURL崩壊）が解消
- ⚠️ `flow`(ID2/非公開) は pages WXR 未収録の可能性 → 公開要否含め先方確認（既出）
- 補足: サービスP1カラム化・サイドバー整理・FVブロック設置は実ビルド時のSWELL設定
  （CSS課題ではない）。FV用 `.ots-fv*` クラスは子テーマ実装済

## 本番（さくら）への移し方（このローカル成果の使い道）

このローカル環境＝**安全な実装・検証場**。確定後の本番移行は:
1. さくらでバックアップ多重取得（CLAUDE.md既定）→ サブディレクトリ/ステージング複製
2. 本ローカルで確定した子テーマ `swell_child/` をそのまま転送
3. WXR取込 → `http://→https://www.trust-supply.com` を WP-CLI `search-replace`（シリアライズ安全）
4. pretty permalink（本番Apacheは mod_rewrite 有効）→ 全20P＋親 curl で 200/301 全数確認
5. CF7・GA4再設置・本番切替（パーマリンク不変）
```

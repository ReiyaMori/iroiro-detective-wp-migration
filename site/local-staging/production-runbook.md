# さくら本番 SWELL移行 実行手順書（production runbook）

- 作成: 2026-05-18（ローカル最終リハーサルで全工程を予行し確定）
- 対象: trust-supply.com（さくらのレンタルサーバ スタンダード／お名前.comドメイン）
- ゴール: 既存 BizVektor サイトを **テーマ移管（→SWELL＋確定子テーマ）**。
  パーマリンク不変・実コンテンツ保全・確定デザイン（Plan A＋教科書体）適用。
- 認証情報: すべて `secrets.local.md`（git管理外）参照。本書には書かない。

> ⚠️ **方式の大前提**：本番は「**既存の稼働サイトをステージングに複製 → 再スキン**」。
> ローカルリハの WXR 取込は“空のローカルWPに実コンテンツを入れる便宜”であって
> 本番ではやらない（本番には全71P・画像・スラッグが既に存在）。本書は **クローン方式**。
> ローカルリハで実証済の事実（子テーマCSSが2014クラシックHTMLに自動適用／
> footer・headerウィジェットが描画／https置換数とguid除外／全pretty URL）を各ステップに付す。

---

## 0. GO / NO-GO（着手前チェック）

| 区分 | 条件 | 状態(2026-05-18) |
|---|---|---|
| デザイン | A案＋教科書体(Klee One)確定 | ✅ 確定（先方無異議ack） |
| GA4 | スコープ確定（CV計測まで・今回内） | ✅ 確定（5/18） |
| アカウント情報 | WP管理/FTP/phpMyAdmin/さくらCP/お名前.com | ✅ 受領済（secrets.local.md） |
| SWELL | v2.16.0 正規zip＋ユーザー認証コード | ✅ zip有 ／ ⚠️ **認証コードを secrets.local.md へ要追記** |
| 🔴 先方待ち①(非ブロッカー) | ドメイン有効期限・更新クレカ | ⏳ reply-0518で確認中。失効＝全消滅のため**本番切替前に必ず確定** |
| 🔴 先方待ち②(非ブロッカー) | GA4アカウント所有者（御社Google推奨） | ⏳ reply-0518で確認中。Iフェーズまでに |
| 🔴 法務(必須) | 探偵業届出証明書番号（探偵業法§10） | ⏳ **こちらから支給依頼**。フッター枠は実装済・番号待ち |
| 確認 | /flow(相談の流れ)公開要否 | ⏳ 先方確認（ローカルWXRに未収録＝本番実在を要確認） |

- ステージング構築〜Iの検証までは**先方待ちと無関係に着手可**（教科書体・GA4確定済）。
- **J（本番反映）だけはドメイン有効性確定＋先方合意の時間帯が前提**＝不可逆ポイント。

---

## A. 事前準備

1. SWELL会員マイページの **ユーザー認証コード** を `secrets.local.md` に追記
   （テーマ更新／納品時ライセンス移譲に必要・CLAUDE.md既出）。
2. さくらコントロールパネルで **SSH を有効化**（スタンダードはCPから有効化）。
   WP-CLI を SSH 上で利用可能にする（`curl wp-cli.phar` を ~/bin 等へ。
   不可なら全DB操作は phpMyAdmin＋search-replaceプラグインで代替＝後述）。

---

## B. バックアップ多重化（テーマ切替直前・**必須**）

CLAUDE.md「やってはいけないこと: テーマ切替前に必ず全DBバックアップ」を満たす。
3系統すべて取得してから次へ進む（1つでも失敗したら中断）。

```bash
# B-1 DB全エクスポート（phpMyAdmin or SSH）
#   phpMyAdmin: 全テーブル → エクスポート(SQL, gzip)
#   SSH(WP-CLI): wp db export ots_prod_$(date +%Y%m%d).sql
# B-2 ファイル全ミラー（FTP/SSH）: www/ 配下（wp-content/themes,uploads,plugins含む）
#   既に backup_20260516/ftp_mirror に 1.0GB 取得済 → 切替直前に差分で再取得
# B-3 BackWPup: テーマ＋プラグイン＋wp_options 含むフルアーカイブ（管理画面から）
```
- 取得物は `backup_YYYYMMDD/`（gitignore・ローカル保持）。
- ✅ 5/16取得分（BackWPup 117MB＋FTPミラー1.0GB＋WXR/メディア）が一次バックアップ。
  **WPアップデート直前(D)と本番反映直前(J)で再取得**。

---

## C. ステージング複製（さくら上・本番非破壊）

- 第一候補: さくら「**バックアップ＆ステージング**」機能でステージング生成。
- 代替: `www/staging/` 等サブディレクトリへ本番を複製（DBは別接頭辞 or 別DB）。
  - ファイル: FTP/SSHで `www/` を `www/staging/` へコピー
  - DB: ダンプ → 新DB へインポート → `staging/wp-config.php` のDB名・
    `WP_HOME/WP_SITEURL` をステージングURLへ。`wp option update siteurl/home`
- 以降 D〜I は **ステージング上だけ**で実施。本番には触れない。

---

## D. WordパッドPress本体アップデート（セキュリティ・先方了承済5/13）

> SWELL v2.16.0 実測要件 WP5.6+/PHP7.3+ ＝ 本番 WP5.7.15/PHP7.4.33 は**充足済**。
> よってWP更新は移管の必須前提ではなく**セキュリティ目的**（移管リスク低減）。

```bash
# ステージングで（B再取得後）
wp core update            # 5.7.15 → 最新6.x
wp core update-db
wp plugin list --update=available   # 互換確認。問題プラグインは個別判断
```
- 問題が出たら **即 B のバックアップから復元**して原因切り分け（CLAUDE.md手順）。

---

## E. SWELL＋確定子テーマ導入（**切替えはまだしない**）

```bash
wp theme install /path/swell-2.16.0-official.zip          # 親（非有効のまま）
# 子テーマ swell_child/ を wp-content/themes/ へ転送（FTP/SSH）
#   ・site/swell-theme/swell_child（assets/fv-a.jpg 同梱）をそのまま
wp theme list   # swell / swell_child が present・active は旧BizVektorのまま
```
- ✅ リハ実証: 子テーマ functions.php の Klee One エンキューは実SWELL2.16.0で動作・致命なし。
- ⚠️ **wp_options のBizVektor設定は消さない**（切り戻し用・CLAUDE.md）。

---

## F. パーマリンク一致 → コンテンツ（クラシックHTML流用）

- 本番は既存サイト＝**全71Pが既に存在**。WXR取込は不要（ローカルリハ専用）。
- パーマリンク構造は**現状のまま不変**（スラッグ1文字も変えない＝SEO要件）。
  ステージングで `wp rewrite structure` を**本番と同一**に。`wp rewrite flush`。
- ✅ リハ実証: 20P＝**ショートコード0/VKブロック0/TablePress[sc]0＝2014クラシックHTML**。
  ブロック完全変換は不要。本文HTMLは流用（CLAUDE.md「本文を書き換えない」）。
- ✅ リハ実証: 階層/スラッグ/親子は I の検証表の通り（親 serviceindex(430)/company(1295) 保持必須）。

---

## G. https 一括置換（混在コンテンツ回避・**guid除外が必須**）

本文画像が `http://www.trust-supply.com/...` 絶対URL。https化で混在コンテンツになるため
シリアライズ安全な search-replace で正規化。**ステージングで実施→検証**。

```bash
# G-1 まず DRY-RUN（必ず）
wp search-replace 'http://www.trust-supply.com' 'https://www.trust-supply.com' \
  --dry-run --all-tables --report-changed-only
# G-2 本実行（★guid は変更しない＝フィードで既存記事が新規扱いになる事故防止）
wp search-replace 'http://www.trust-supply.com' 'https://www.trust-supply.com' \
  --all-tables --skip-columns=guid --report-changed-only
```
- ✅ **リハで判明した罠（dry-runの成果）**: 無指定だと `wp_posts.guid` も置換対象に入る
  （リハ実測: post_content 34行 / postmeta 5 / guid 39 / 計78）。**guid は必ず除外**。
- 実置換は post_content（本文URL）＋ postmeta（AIOSEO等）に限定。
- WP-CLI不可時の代替: phpMyAdmin で **Search-Replace-DB系プラグイン**
  （Better Search Replace 等／シリアライズ対応・**GUID列のチェックを外す**）。
- 念のため `www.` 有無の表記揺れも確認（既存は www 付き運用）。

---

## H. front page＋FV＋フッター/ヘッダー＋SWELLカスタマイザー

リハで自動化＆実証済（`build-front.sh` の工程＝この H に対応）。SWELLウィジェット領域は
リハで実測した下記IDを使用。

| 配置 | SWELLウィジェット領域(id) | 入れるHTML |
|---|---|---|
| ヘッダー右CTA（24h/電話/無料相談） | **ヘッダー内部** `head_box` | `site/local-staging/header-cta-content.html` |
| pre-CTA帯＋刷新フッター | **フッター直前** `before_footer` | `site/local-staging/footer-content.html` |
| （任意）フッター列を分割したい場合 | `footer_box1/2/3` `footer_sp` | footer-content.html を分割 |

```text
H-1 固定ページ「ホーム」を新規作成（slug=home）。本文に
    site/local-staging/home-content.html を貼る（カスタムHTML/自由形式ブロック）。
H-2 設定→表示設定：フロントページ=固定ページ「ホーム」（show_on_front=page）。
H-3 外観→ウィジェット：上表の領域へ「カスタムHTML」ブロックで各HTMLを貼付。
    ※ 探偵業届出証明書番号は footer-content.html 内の1箇所（第□□□号）を
      先方支給番号に差し替える（探偵業法§10・**未支給なら枠は残し番号待ち明示**）。
H-4 SWELLカスタマイザー：
    ・ヘッダー：メインビジュアル「表示しない」
    ・フロントページ：1カラム（サイドバー無し）
    ・インナーページ：必要に応じ1カラム（サービスPのSWELL既定サイドバー対策。
      ローカルリハで既定サイドバーに "Hello world!" が出る＝本番は実ウィジェット/
      非表示を設定。CSS強制はしない＝先方が連絡導線を入れる余地を残す）
```
- ✅ リハ実証: front(/) が **ヘッダーCTA→FV縦書き→想い→調査メニュー6→選ばれる理由
  →流れ→料金→CTA→pre-CTA帯→刷新フッター（届出番号枠）** まで実SWELLでE2E描画。
  通常ページ・表ページにも footer/header が site-wide 適用。desktop/mobile 提示品質確認済
  （`backup_20260516/local_shots/rehearsal-*.png`）。
- 料金表は「※現行料金に差し替え予定」プレースホルダ → 先方の現行料金確定後に差替。

---

## I. 検証（ステージングで全数・本番反映前の関門）

```bash
# I-1 全公開ページ＋親＋front の HTTP 200/301（pretty URL・本番Apacheはmod_rewrite有効）
#     ローカルはMAMP htaccess未適用でpretty404＝環境差（README）。本番では下記URLが200。
```
**curl 200 必須リスト（リハの slug/parent 実測から確定）**:

| 種別 | URL（https://www.trust-supply.com…） | 期待 |
|---|---|---|
| front | `/` | 200（固定ページ「ホーム」） |
| 親 | `/serviceindex/` `/company/` | 200（**消すと全子URL崩壊**） |
| サービス15P | `/serviceindex/{cheating,whereaboutssurvey,eavesdropping,creditcheck,personalcreditcheck,assetsinvestigation,variousexpertopinionsurvey,stalkermeasures,sexualharassment,dv,ijime,intimidation,securitycamera,special}/` | 各200 |
| 代表挨拶 | `/company/atfirst/` | 200 |
| 直下4P | `/otherarea/` `/after/` `/technic/` `/akutoku/` | 各200 |
| 旧URL正規化 | 上記の `http://`／末尾スラッシュ有無 | 301→https正規 |
| /flow | `/flow/` | ⚠️ **要先方確認**（ローカルWXR未収録＝本番実在/公開要否を確定。非公開なら現状維持） |

- I-2 PC/SP 目視：FV縦書き・教科書体・表(class="sta")の料金表デザイン・画像・
  内部リンク・パンくず・フッター届出番号枠・pre-CTA。
- I-3 Contact Form 7：実送信→通知メール受信まで（文面・送信先継承）。
- I-4 GA4：新規プロパティ（**御社Googleアカウントで作成推奨**＝所有権を客に残す。
  reply-0518で確認中）＋計測タグ設置＋**CF7送信完了をキーイベント＝CV計測**。
  実送信テストはJ後（本番公開後）に最終確認＝Phase4。
- I-5 All in One SEO のmeta/XMLサイトマップ継続、Search Console（あれば）。

---

## J. 本番反映（**不可逆ポイント**・先方合意の時間帯）

> 前提：ドメイン有効期限・更新クレカが有効と確定済（失効＝全消滅）。
> 先方と切替時間帯を合意（営業影響の少ない時間／問い合わせ取りこぼし配慮）。

- J-0 直前に B を再取得（最新DB＋ファイル）。
- 反映方式（いずれか・ステージング構成で決定）:
  - 方式①: ステージングで確定の wp_posts/postmeta/wp_options/テーマ を本番へ慎重反映
  - 方式②: 本番に SWELL＋子テーマを非有効アップロード済の状態にし、
    深夜に**テーマ有効化＋front/ウィジェット設定**を本番で実施（最小操作）
- パーマリンク設定は**変更しない**。`wp rewrite flush` のみ。

---

## K. 切替後検証＋納品

- K-1 I-1 の全URLを**本番ドメインで** curl 200/301 全数再確認。
- K-2 PC/SP実機・CF7実送信・GA4リアルタイム計測・CVイベント発火確認。
- K-3 スクショ送付＋CW納品報告＋検収依頼（月内検収希望なら明示）。

---

## ロールバック（各段階・即復旧）

| 段階 | 事故 | 復旧 |
|---|---|---|
| D | WP更新で不具合 | B-1/B-2/B-3 から復元（ステージングなので本番無傷） |
| G | 置換で本文破損 | search-replace前のDBダンプを再インポート |
| J 方式② | 切替後に致命表示崩れ | 旧テーマ(BizVektor)を `wp theme activate` で即戻し（wp_options温存済） |
| J | DB反映で破損 | J-0 の直前バックアップから本番DB復元 |

---

## 予行で実証済（このリハで潰した不確実性）

1. ✅ setup.sh が **DBドロップ→from-scratch を9秒でクリーン完走**（69P取込・fatal 0）＝再現性。
2. ✅ 子テーマCSSが 2014クラシックHTML（VK/sc/[tablepress] 全0）に**自動適用**。
   `<table class="sta">`→確定料金表デザインへ自動変換を実SWELLで再確認。
3. ✅ **footer/header を SWELLウィジェット（before_footer/head_box）に入れると
   全ページ site-wide 描画**＝本番のウィジェット貼付手順が成立。
4. ✅ front固定ページ＋home-content.html＋show_on_front=page で承認プロト全構成がE2E描画。
5. ⚠️→✅ **https置換で guid も巻き込む罠を dry-run で検知** → `--skip-columns=guid` 確定。
6. ✅ 全20P＋親＋front の pretty URL（slug/parent）を確定＝I-1検証表の根拠。
7. ⚠️ ID2 はローカルでは既定 `sample-page`＝**/flow は pages WXR 未収録**。
   本番での /flow 実在・公開要否を先方確認（既出・確認#）。

## 残（先方アクション or 別タスク）

- 探偵業届出証明書番号の支給（法務必須・こちらから依頼）
- ドメイン有効期限・更新クレカの確定（J前提・reply-0518で確認中）
- GA4アカウント所有者の選択（reply-0518で確認中）
- /flow 公開要否・本番実在の確認
- 現行料金表の確定値（トップ料金プレースホルダ差替）
- repo private化（#0・別タスク継続）／SWELLユーザー認証コードを secrets.local.md へ

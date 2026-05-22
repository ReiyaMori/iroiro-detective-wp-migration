# さくら本番 SWELL移行 実行手順書（production runbook・**FTPのみ版**）

- 作成: 2026-05-18（ローカル最終リハで全工程予行）／**改訂: 2026-05-18（SSH不要・FTPのみ版／方式②ベースに再構成）**
- 対象: trust-supply.com（さくらのレンタルサーバ スタンダード／お名前.comドメイン）
- ゴール: 既存 BizVektor サイトを **テーマ移管（→SWELL＋確定子テーマ）**。
  パーマリンク不変・実コンテンツ保全・確定デザイン（Plan A＋教科書体）適用。
- 認証情報: すべて `secrets.local.md`（git管理外）参照。本書には書かない。

> ⚠️ **本書の大前提（改訂）**
> 1. **SSHは使わない**。FTP＋phpMyAdmin(GUI)＋さくらCP＋WP管理画面＋プラグインのみで完遂する。
>    SSH/WP-CLIは「速くてクリック数が減る」だけで**必須ではない**（各工程にGUI/FTP代替を明記）。
> 2. **方式②（最小操作・本番直接）を本線**にする。理由＝**ローカルMAMPリハが既に
>    ステージング検証として機能済**（確定デザイン/子テーマCSS/2014クラシックHTML挙動を実証）。
>    本番で未検証なのは「さくら固有：実mod_rewrite・実CF7/AIOSEO・実https」だけ。
>    重い996MBクローンをFTP往復で作るのは脆弱＝避ける。さくらCPステージング機能が
>    **使えるなら**それで本番複製検証（より安全）＝C-1。**無ければ**方式②＝C-2。
> 3. 本番は既存サイト＝**全71Pが既に存在**。WXR取込は不要（ローカルリハ専用の便宜）。

---

## 0. GO / NO-GO（着手前チェック）

| 区分 | 条件 | 状態(2026-05-18) |
|---|---|---|
| デザイン | A案＋教科書体(Klee One)確定 | ✅ 確定（先方無異議ack） |
| GA4 | スコープ確定（CV計測まで・今回内） | ✅ 確定（5/18） |
| アカウント情報 | WP管理/FTP/phpMyAdmin/さくらCP/お名前.com | ✅ 受領済（secrets.local.md） |
| FTP疎通 | 認証情報の有効性 | ✅ **5/18検証済**（読み取り専用LIST成功・curl exit0） |
| バックアップ | 5/16 BackWPup zip 完全性 | ✅ **5/18検証済**（破損なし・内包DBダンプ13.4MB＝ロールバック資産有効） |
| LIVEルート | 本番WP設置パス | ✅ **`~/www/ots/`** 確定（FTPは `www/ots/`）・サイトは日々変化中 |
| SWELL | v2.16.0 正規zip＋ユーザー認証コード | ✅ zip有 ／ ⚠️ **認証コードを secrets.local.md へ要追記**（れーや・別タスク） |
| ✅ さくらCPステージング機能 | バックアップ＆ステージング(SnapUP) | ✅ **5/18 利用開始済**（標準/無料・読み取り確認後に有効化・規約/フォーム/有料なし）＝**C-1本線可**。次=SnapUP詳細管理画面でステージング作成（移管実行時・本番非破壊）。現状バックアップ未取得/スケジュールなし |
| ✅ SSL証明書 | trust-supply.com 独自SSL | ✅ **有効期限 2026/8/2**（CP実測）＝https化はSSL的に当面問題なし |
| 🟢 客責任(我々の義務外) | **ドメイン登録**有効期限・更新クレカ | ✅ reply-0518で**通知済＝善管注意は履行済**。お名前.com管轄＝**我々は会員PW未受領で確認手段も立場もない**。移管はドメインに非依存（同一ドメイン・期限切れは移管と独立した既存リスク）＝**Jを止めない・追わない**。J直前に任意の念押し1回のみ。SSL証明書(2026/8/2)とは別物 |
| ✅ GA4アカウント所有者 | 権限付与方式で確定 | ✅ **5/19確定**：こちらで作成→先方指定メールへ管理者権限付与（付与先メール=secrets.local.md）。実装はIフェーズ |
| ✅ 仮払い | CW固定報酬¥110,000 エスクロー | ✅ **5/22 仮払い完了**（宮久保様）＝報酬確保 |
| ✅ 現行料金表 | トップ料金の確定値 | ✅ **5/22確定＝「前サイトの料金で取り急ぎ引き継ぎ」指示**。既存実料金をhome料金セクションへ反映済（日当6,600円/h・報告書11,000円・例58,300/93,500円）。詳細price/ID448は既存ページ移管=as-is |
| ✅ 会社情報(住所) | 法務ビル202号 | ✅ **5/22確定**（先方指示＋公印＋既存会社概要表＝三者一致）。〒862-0975/新屋敷3丁目12番16号/202号 に全6ファイル統一済（旧2F訂正） |
| ✅ 本番切替の作業時間帯 | 早朝 or 夜間（先方こだわりなし） | ✅ **5/19先方回答**＝Jの唯一のハード前提クリア。具体日時は先方とすり合わせ |
| ✅ 法務(必須) | 探偵業届出証明書番号（探偵業法§10） | ✅ **5/19受領＝第93090018号（熊本県公安委員会）**。footer-content.html / components.html 反映済。⚠️旧サイトTablePressは第9308 0010/0011号＝公印(9309 0018)と不一致＝要れーや確認(非ブロッカー・公印が最新で維持) |
| ✅ /flow(相談の流れ)公開要否 | 現状どおり非公開で確定 | ✅ **5/19先方回答＝新サイトでも非公開**。pages WXR未収録のままで整合＝移管対象外（追加作業なし） |

- **A〜I（事前アップロード含む）は先方待ち・SSHと無関係に着手可**（非破壊）。
- **J（本番反映）だけが不可逆ポイント**。**2026-05-22 でJのゴー前提は全充足**（仮払い完了✅・
  作業時間帯=早朝/夜間合意済✅・料金=前サイト流用で確定✅・住所=202号確定✅）。
  残るは**れーやのGO判断＋具体的な切替日時の先方すり合わせ**のみ。
  ドメイン登録有効性は**客のインフラ責任**（reply-0518通知済・我々の義務外＝Jを止めない／
  J直前に任意の念押し1回）。SSH有効化は前提から外れた／さくらCPステージは利用開始済。

---

## A. 事前準備（FTPのみ／非破壊）

1. SWELL会員マイページの **ユーザー認証コード** を `secrets.local.md` に追記（れーや・別）。
2. **さくらコントロールパネルにログイン**し、以下を確認（GUIのみ・設定変更しない）:
   - 「バックアップ＆ステージング」機能の有無 → **C-1 or C-2 の分岐確定**。
   - phpMyAdmin の起動可否（CP→データベース→管理ツール）。
   - PHPバージョン（参考。SWELL要件PHP7.3+は本番7.4.33で充足済＝変更不要）。
   - ※ **SSH有効化は不要**（本書はSSHを使わない）。

---

## B. バックアップ多重化（テーマ操作前・**必須**・全FTP/GUI）

CLAUDE.md「テーマ切替前に必ず全DBバックアップ」を満たす。3系統取得してから次へ。
1つでも失敗したら中断。

| 系統 | 手段（SSH不要） | 備考 |
|---|---|---|
| **B-1 DB全エクスポート** | **phpMyAdmin**：対象DB（secrets.local.md: DB_NAME）選択→「エクスポート」→**カスタム**／全テーブル／形式SQL／圧縮gzip | DB実測 **13.4MB**＝GUI余裕。`ots_prod_YYYYMMDD.sql.gz` でDL |
| **B-2 ファイル全ミラー** | **FTP**で `www/ots/` 配下を丸ごとDL（wp-content/themes,uploads,plugins含む） | 5/16取得 `backup_20260516/ftp_mirror` 996MB 有→**Jの直前に差分で再取得**（本番は日々変化） |
| **B-3 BackWPup** | **WP管理画面**→BackWPup→ジョブ実行（テーマ＋プラグイン＋wp_options＋DB＋WXR） | 5/16取得 `OTS_full_*.zip`（112MB・**5/18完全性検証OK・内包SQL13.4MB有効**）が一次。**Jの直前に再取得** |

- 取得物は `backup_YYYYMMDD/`（gitignore・ローカル保持）。
- ⚠️ **B再取得のタイミング＝「Jの直前」**。本番は稼働中で日々変化（`www/ots/` mtime実測で確認済）
  ＝5/18時点の再取得は無駄。**WPアップデート(D)の直前**と**本番反映(J)の直前**で取り直す。

---

## C. 検証方針（**ローカルリハが一次検証＝済**。本番側は下記2択）

> ✅ **ローカルMAMPリハで実証済（＝本書が依拠する一次ステージング検証）**:
> 確定デザインが2014クラシックHTML（VK/sc/[tablepress]全0）に子テーマCSSだけで自動適用／
> `<table class="sta">`→料金表デザイン自動変換／footer・headerウィジェットが site-wide 描画／
> front固定P＋home-content＋show_on_front=page で承認プロト全構成E2E描画／
> 階層URL・slug・親子（serviceindex 430・company 1295）一致。
> → **本番で未検証なのは「さくら固有：実mod_rewrite・実CF7/AIOSEO・実https・実プラグイン相互作用」だけ**。

### C-1（**本線・推奨**・SnapUP 5/18利用開始済＝即実施可）

> ✅ 5/18: さくらCP「バックアップ＆ステージング(SnapUP)」を**利用開始済**（標準/無料・本番非接触で
> 有効化のみ）。「詳細管理画面 SnapUp」からステージング作成が可能な状態。

1. さくらCP → Webサイト/データ → バックアップ＆ステージング → **詳細管理画面 SnapUp** を開く。
2. SnapUP で **本番(/www/ots) のステージング環境を作成**（SnapUPがステージ用ドメイン・
   認証PWを自動設定・**本番非破壊**でWPテスト環境を複製）。
3. ステージURL（SnapUP発行）で D〜I を実施（本番に触れない）。
4. 検証OK後、SnapUPのステージ→本番反映、または方式②の最小操作で本番化（J）。
- ⚠️ SnapUP管理画面でのステージ作成は移管実行フェーズの操作（先方合意の作業時間帯内）。
  まず B のバックアップ多重化を済ませてから。
- ⚠️ 「利用解除」は SnapUPデータ全消去＝移管完了まで解除しない。

### C-2（フォールバック・SnapUP不調時＝方式②・FTPのみ）

- **重い996MBクローンは作らない**（FTP往復は脆弱・遅い）。
- 代わりに **本番へ SWELL親＋確定子テーマを「非有効」で事前アップロード**（E＝非破壊・先行可）。
- 検証は **ローカルMAMPリハ（済）＋本番のさくら固有確認（I）** で代替。
- 本番反映(J)は **合意時間帯に最小操作のみ本番で実施**（テーマ有効化＋front/widget＋https）。
- 根拠＝①ローカルでE2E実証済 ②検証済バックアップ3系統 ③戻しは旧テーマ再有効化1クリック
  （wp_options温存）。CLAUDE.md「ステージングで検証してから切替」は**ローカルリハがその検証**。

---

## D. WordPress本体アップデート（セキュリティ・先方了承5/13・**WP管理画面GUI**）

> SWELL v2.16.0 実測要件 WP5.6+/PHP7.3+ ＝ 本番 WP5.7.15/PHP7.4.33 は**充足済**。
> WP更新は移管の必須前提ではなく**セキュリティ目的**（リスク低減）。

- C-1: ステージングで実施。C-2: 本番で実施（D直前にB再取得＝必須）。
- **WP管理画面 → ダッシュボード → 更新 → 「今すぐ更新」**（5.7.15 → 最新6.x）。
  - WPがファイル書込権限を求めFTP情報を聞いたら secrets.local.md の値を投入
    （さくらは通常direct書込可。聞かれた場合のみ）。
- 更新後、プラグイン一覧で「更新あり」を確認。VK/CF7/AIOSEO/TablePress等は
  **テーマ移管に影響する更新のみ慎重に**（不要な大量更新は避ける）。
- 不具合時は **即 B-1/B-2/B-3 から復元**（C-1ならステージングなので本番無傷）。

---

## E. SWELL＋確定子テーマ 事前アップロード（**非有効**・非破壊・先方待ち中に先行可）

> ⭐ これが方式②の肝。**有効化はまだしない**＝本番表示は一切変わらない＝いつでも実施可。

1. **WP管理画面 → 外観 → テーマ → 新規追加 → テーマのアップロード**
   → `site/swell-theme/swell-2.16.0-official.zip`（親・**有効化しない**）。
2. 子テーマ `site/swell-theme/swell_child/`（`assets/fv-a.jpg` 同梱）を
   **FTPで `www/ots/wp-content/themes/swell_child/` へ転送**。
3. WP管理画面 外観→テーマで **swell / swell_child が一覧に出る・有効は旧BizVektorのまま** を確認。
- ✅ リハ実証: 子テーマ functions.php の Klee One エンキューは実SWELL2.16.0で動作・致命なし。
- ⚠️ **wp_options のBizVektor設定は消さない**（切り戻し用・CLAUDE.md）。

---

## F. パーマリンク（**変更しない**＝SEO要件）

- 本番は既存71Pが存在。WXR取込は不要。
- パーマリンク構造は**現状のまま不変**（スラッグ1文字も変えない）。
  Jでテーマ有効化後に **WP管理画面 設定→パーマリンク を「変更を保存」だけ押す**
  （構造は変えずに rewrite フラッシュのみ）。
- ✅ リハ実証: 20P＝**ショートコード0/VKブロック0/TablePress[sc]0＝2014クラシックHTML**。
  ブロック変換不要・本文HTMLは流用（CLAUDE.md「本文を書き換えない」）。
- ✅ リハ実証: 親 serviceindex(430)/company(1295) 保持必須（消すと全子URL崩壊）→ Iの検証表。

---

## G. https 一括置換（**FTPのみ・guid安全**・混在コンテンツ回避）

本文画像が `http://www.trust-supply.com/...` 絶対URL（実測54件）。https化で混在コンテンツに
なるため正規化。**SSH/WP-CLI不要**。下記の2分割が `wp search-replace --skip-columns=guid`
をGUIで完全再現する正解（リハのdry-runでguid 39件巻き込みの罠を確定済）。

### G-0 まず件数確認（phpMyAdmin → SQL／dry-run相当）

```sql
SELECT
 (SELECT COUNT(*) FROM wp_posts    WHERE post_content LIKE '%http://www.trust-supply.com%') AS post_content,
 (SELECT COUNT(*) FROM wp_posts    WHERE guid         LIKE '%http://www.trust-supply.com%') AS guid_touch_NG,
 (SELECT COUNT(*) FROM wp_postmeta WHERE meta_value   LIKE '%http://www.trust-supply.com%') AS postmeta,
 (SELECT COUNT(*) FROM wp_options  WHERE option_value LIKE '%http://www.trust-supply.com%') AS options;
```
- リハ実測の目安：post_content≈34 / guid≈39（**触らない**）/ postmeta≈5。本番で件数を控える。

### G-1 post_content（phpMyAdmin SQL・平REPLACE安全＝guidに触れない）

> `post_content` はシリアライズされない素のHTML＝平REPLACEで安全。`guid` 列は**含めない**
> ＝WP原則「guidを変えるとフィードで既存記事が新規扱い」を回避（＝`--skip-columns=guid` 相当）。

```sql
-- 本実行（G-0で件数確認後）
UPDATE wp_posts
   SET post_content = REPLACE(post_content,
       'http://www.trust-supply.com', 'https://www.trust-supply.com');
-- 念のため www なし表記も（既存は www 付き運用だが揺れ対策）
UPDATE wp_posts
   SET post_content = REPLACE(post_content,
       'http://trust-supply.com', 'https://trust-supply.com');
```

### G-2 postmeta / options（Better Search Replace・シリアライズ安全）

> postmeta（AIOSEO等）/ options はシリアライズ値があり得る→**シリアライズ対応プラグイン**で。
> これら2テーブルに **guid 列は存在しない**＝プラグインの列単位除外不可問題は起きない。

1. WP管理画面 → プラグイン → 新規 → **Better Search Replace** をインストール・有効化。
2. ツール → Better Search Replace:
   - Search for: `http://www.trust-supply.com`
   - Replace with: `https://www.trust-supply.com`
   - Select tables: **`wp_postmeta` と `wp_options` のみ**（★ `wp_posts` は選ばない＝guid巻き込み防止）
   - ☑ **Run as dry run** で先に件数確認 → 想定通りなら dry run を外して本実行。
3. （任意）`http://trust-supply.com`（wwwなし）でももう一巡。
4. 完了後、**プラグインは無効化/削除**（常設不要）。

- ⚠️ **絶対に `wp_posts` を Better Search Replace の対象にしない**（guid列ごと置換され事故）。
  `wp_posts` は G-1 の phpMyAdmin SQL（post_contentのみ）で処理済。

---

## H. front／FV／フッター・ヘッダー／SWELLカスタマイザー（全GUI）

SWELLウィジェット領域はリハ実測の下記IDを使用。

| 配置 | SWELLウィジェット領域(id) | 入れるHTML |
|---|---|---|
| ヘッダー右CTA（24h/電話/無料相談） | **ヘッダー内部** `head_box` | `site/local-staging/header-cta-content.html` |
| pre-CTA帯＋刷新フッター | **フッター直前** `before_footer` | `site/local-staging/footer-content.html` |
| （任意）フッター列分割時 | `footer_box1/2/3` `footer_sp` | footer-content.html を分割 |

```text
H-1 固定ページ「ホーム」を新規作成（slug=home）。本文に
    site/local-staging/home-content.html を貼る（カスタムHTML/自由形式ブロック）。
H-2 設定→表示設定：フロントページ=固定ページ「ホーム」（show_on_front=page）。
H-3 外観→ウィジェット：上表の領域へ「カスタムHTML」ブロックで各HTMLを貼付。
    ※ 探偵業届出証明書番号は ✅ **2026-05-19 先方支給で反映済**
      （footer-content.html＝第93090018号・熊本県公安委員会）。差替作業は完了。
H-4 SWELLカスタマイザー：
    ・ヘッダー：メインビジュアル「表示しない」
    ・フロントページ：1カラム（サイドバー無し）
    ・インナーページ：必要に応じ1カラム（サービスPのSWELL既定サイドバー対策。
      CSS強制はしない＝先方が連絡導線を入れる余地を残す）
```
- ✅ リハ実証: front(/) が ヘッダーCTA→FV縦書き→想い→調査メニュー6→選ばれる理由→流れ
  →料金→CTA→pre-CTA帯→刷新フッター（届出番号枠）まで実SWELLでE2E描画。
  通常P・表Pにも footer/header が site-wide 適用。desktop/mobile 提示品質確認済。
- ✅ 料金表は **2026-05-22 確定**（先方「前サイトの料金で取り急ぎ引き継ぎ」）→ home-content.html の
  料金セクションを既存サイト実料金へ差替済（日当6,600円/h〔1名・1日5h目安〕・報告書作成費11,000円税込・
  諸経費実費・行方=着手金＋成功報酬／お見積り例 1名5h=58,300円・2名1日=93,500円）。詳細料金ページ(price/ID448)は
  既存ページとして as-is 移管（TablePress table id=5・DNA鑑定料金表 等を保持）。

---

## I. 検証（本番反映前の関門・curlはローカルから）

**curl 200 必須リスト（リハの slug/parent 実測から確定）**:

| 種別 | URL（https://www.trust-supply.com…） | 期待 |
|---|---|---|
| front | `/` | 200（固定ページ「ホーム」） |
| 親 | `/serviceindex/` `/company/` | 200（**消すと全子URL崩壊**） |
| サービス15P | `/serviceindex/{cheating,whereaboutssurvey,eavesdropping,creditcheck,personalcreditcheck,assetsinvestigation,variousexpertopinionsurvey,stalkermeasures,sexualharassment,dv,ijime,intimidation,securitycamera,special}/` | 各200 |
| 代表挨拶 | `/company/atfirst/` | 200 |
| 直下4P | `/otherarea/` `/after/` `/technic/` `/akutoku/` | 各200 |
| 旧URL正規化 | 上記の `http://`／末尾スラッシュ有無 | 301→https正規 |
| /flow | `/flow/` | ✅ **5/19確定＝非公開で現状維持**（pages WXR未収録のままで整合・移管対象外。公開URLに出さない） |

- I-2 PC/SP 目視：FV縦書き・教科書体・表(class="sta")料金表・画像・内部リンク・
  パンくず・フッター届出番号枠・pre-CTA。
- I-3 Contact Form 7：実送信→通知メール受信まで（文面・送信先継承）。
- I-4 GA4：**5/19確定＝権限付与方式**（こちらで新規プロパティ＋計測タグを作成→先方指定メールへ
  **管理者権限を付与**＝所有権を客に残す／付与先メールは secrets.local.md「GA4」節）。
  ＋**CF7送信完了をキーイベント＝CV計測**。実送信テストはJ後（Phase4）。
- I-5 All in One SEO の meta/XMLサイトマップ継続、Search Console（あれば）。
- ※ C-2（方式②）の場合、I-1/I-3/I-5 の最終確定は **J直後**に本番ドメインで実施（Kと統合）。
  C-1（ステージング）の場合は反映前にステージングURLで全数。

---

## J. 本番反映（**唯一の不可逆ポイント**・先方合意の時間帯）

> 前提：**先方と切替時間帯を合意**（営業影響・問い合わせ取りこぼし最小の時間）。
> ドメイン登録有効性は**客のインフラ責任**（reply-0518通知済＝善管注意履行・我々の義務外で
> 確認手段もなし）。**Jを止める前提にしない**＝移管はドメインに非依存（同一ドメイン・期限切れは
> 移管と独立した既存リスク）。J着手の連絡時に「ドメイン更新のご確認」を任意で1回添える程度。

```text
J-0 直前バックアップ再取得（B-1 phpMyAdmin DB + B-2 FTP差分 + B-3 BackWPup）。
J-1 外観→テーマ：swell_child を「有効化」（旧BizVektorはwp_options温存・削除しない）。
J-2 H-1〜H-4 を本番で実施（front固定ページ／表示設定／ウィジェット貼付／カスタマイザー）。
J-3 G を本番で実施（G-1 phpMyAdmin SQL post_content ＋ G-2 BSR postmeta/options）。
J-4 設定→パーマリンク「変更を保存」（構造不変・rewriteフラッシュのみ）。
J-5 即 K-1 のcurl全数＋主要P目視（最短で異常検知）。
```

- C-1（ステージング検証済）の場合：J-1〜J-4をステージング確定状態の本番反映に置換可。
- パーマリンク設定は**変更しない**。

---

## K. 切替後検証＋納品

- K-1 I-1 の全URLを**本番ドメインで** curl 200/301 全数確認。
- K-2 PC/SP実機・**CF7実送信→受信**・GA4リアルタイム計測・CVイベント発火確認。
- K-3 スクショ送付＋CW納品報告＋検収依頼（月内検収希望なら明示）。

---

## ロールバック（各段階・FTP/GUIのみで即復旧）

| 段階 | 事故 | 復旧（SSH不要） |
|---|---|---|
| D | WP更新で不具合 | C-1=ステージングなので本番無傷／C-2=B-3 BackWPup復元 or B-1 phpMyAdmin import＋B-2 FTP戻し |
| G-1 | post_content破損 | phpMyAdmin で B-1 のDBダンプを再import（または当該テーブルのみ） |
| G-2 | postmeta/options破損 | 同上（Better Search Replace は元に戻す機能なし＝DB復元が確実） |
| J-1 | 切替後に致命表示崩れ | **外観→テーマで BizVektor を再有効化（1クリック・wp_options温存済）** |
| J | DB反映で広域破損 | J-0 直前バックアップから phpMyAdmin import で本番DB復元 |

> ⚠️ Better Search Replace に「取り消し」は無い。**G実行前のDBダンプ（B-1またはJ-0）を必ず保持**。
> 復旧の最終手段は常に phpMyAdmin での DB再import（FTPのみで完結）。

---

## 予行で実証済＋5/18検証（潰した不確実性）

1. ✅ setup.sh が DBドロップ→from-scratch を9秒クリーン完走（69P取込・fatal0）＝再現性。
   **5/22 最終コンテンツ（料金=前サイト実料金／住所=202号 反映済）で再実行＝8.9秒・71P・fatal0・
   front/サービスP(140)/表P(160) すべてHTTP200**＝確定コンテンツでも本番シーケンスが再現。
2. ✅ 子テーマCSSが 2014クラシックHTML（VK/sc/[tablepress]全0）に**自動適用**。
   `<table class="sta">`→確定料金表デザインへ自動変換を実SWELLで再確認。
3. ✅ footer/header を SWELLウィジェット（before_footer/head_box）に入れると全P site-wide 描画。
4. ✅ front固定P＋home-content＋show_on_front=page で承認プロト全構成がE2E描画。
5. ⚠️→✅ https置換で guid も巻き込む罠を dry-run で検知 → **G-1/G-2の2分割で回避**（FTPのみ版）。
6. ✅ 全20P＋親＋front の pretty URL（slug/parent）確定＝I-1検証表の根拠。
7. ✅ **5/18: 5/16 BackWPup zip 完全性OK**（内包DBダンプ 13.4MB＝ロールバック資産として有効）。
8. ✅ **5/18: FTP認証情報は有効**（読み取り専用LIST・curl exit0）＝切替日に失効判明する事態を排除。
9. ✅ **5/18: LIVE WPルート=`~/www/ots/`** 確定・本番は日々変化中＝B再取得は「Jの直前」が正。
10. ✅ ID2/flow は pages WXR 未収録＝**5/19先方確定「非公開で現状維持」**（移管対象外・公開URLに出さない）。

## 残（先方アクション or 別タスク）

- ドメイン登録有効期限・更新クレカ＝**客のインフラ責任**（reply-0518通知済＝善管注意履行・我々の義務外／追わない・Jを止めない／J着手連絡時に任意で1回念押し）
- ~~探偵業届出証明書番号の支給~~ → ✅ **5/19受領＝第93090018号（熊本県公安委員会）・反映済**
- ~~GA4アカウント所有者の選択~~ → ✅ **5/19確定＝権限付与方式**（実装はIフェーズ）
- ~~/flow 公開要否~~ → ✅ **5/19確定＝現状どおり非公開**（移管対象外・追加作業なし）
- ~~本番切替の作業時間帯~~ → ✅ **5/19クリア＝早朝/夜間**（具体日時は先方とすり合わせ）
- ~~現行料金表の確定値~~ → ✅ **5/22確定＝「前サイトの料金で引き継ぎ」**・home料金セクション反映済
- ~~仮払い~~ → ✅ **5/22完了**＝報酬エスクロー確保
- ⚠️ **届出番号の不一致**（公印93090018 vs 旧サイトTablePress 9308 0010/0011）＝れーや確認推奨（非ブロッカー・公印維持）
- さくらCP「バックアップ＆ステージング」＝✅5/18 利用開始済（C-1本線）
- repo private化（#0・別タスク）／SWELLユーザー認証コードを secrets.local.md へ（れーや・別）

---

## 付録：SSHを使わない判断の根拠（なぜFTPのみで十分か）

| SSH版でやること | FTPのみ代替 | 等価性 |
|---|---|---|
| `wp db export` | phpMyAdmin エクスポート | DB13.4MB＝GUIで余裕。完全等価 |
| `wp core update` | WP管理画面 ダッシュボード→更新 | 完全等価（権限要求時のみFTP情報投入） |
| `wp theme install` | 管理画面zipアップ＋FTPで子テーマ転送 | 完全等価 |
| `wp search-replace --skip-columns=guid` | G-1 phpMyAdmin SQL(post_content) ＋ G-2 BSR(postmeta/options) | **完全等価**（guid除外を2分割で再現） |
| `wp rewrite flush` | 設定→パーマリンク「変更を保存」 | 完全等価 |
| ステージング | さくらCPステージ機能(あれば) or ローカルMAMPリハ(済)＋方式② | 一次検証はローカルで完了済 |

→ SSHは速度・クリック数の利便のみ。**移管の正しさ・安全性はFTPのみで担保できる**。

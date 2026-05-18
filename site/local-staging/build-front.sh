#!/bin/bash
# 本番手順ドリル：setup.sh の後に実行する「front page＋ウィジェット＋https予行」自動化。
# setup.sh が未カバーの本番ステップ（front固定ページ／フッター・ヘッダーウィジェット／
# https一括置換のdry-run／pretty URL検証リスト）をローカルで再現する。
# 客先本番さくらには一切触れない。すべてローカルMAMP。
# 使い方:  bash site/local-staging/setup.sh && bash site/local-staging/build-front.sh
set -euo pipefail

PROJ="$(cd "$(dirname "$0")/../.." && pwd)"
PHP=/Applications/MAMP/bin/php/php8.3.30/bin/php
PHAR=/Applications/MAMP/htdocs/clubakino/wp-cli.phar
DIR=/Applications/MAMP/htdocs/ots
LS="$PROJ/site/local-staging"
WP(){ "$PHP" "$PHAR" "$@" --path="$DIR"; }

echo "[1/5] 既定の Sample Page / Hello world を撤去（新規WP由来ノイズ＝本番でも削除）"
WP post list --post_type=page --post_status=any --field=ID --name=sample-page 2>/dev/null \
  | xargs -r -I{} "$PHP" "$PHAR" post delete {} --force --path="$DIR" >/dev/null 2>&1 || true
WP post list --post_type=post --post_status=any --field=ID --name=hello-world 2>/dev/null \
  | xargs -r -I{} "$PHP" "$PHAR" post delete {} --force --path="$DIR" >/dev/null 2>&1 || true

echo "[2/5] front固定ページ「ホーム」作成＋静的フロント指定（本番と同手順）"
HOME_ID="$(WP post list --post_type=page --post_status=any --name=home --field=ID 2>/dev/null | head -1)"
if [ -z "$HOME_ID" ]; then
  HOME_ID="$(WP post create --post_type=page --post_status=publish --post_title='ホーム' \
    --post_name='home' --porcelain --post_content="$(cat "$LS/home-content.html")" 2>/dev/null)"
else
  WP post update "$HOME_ID" --post_content="$(cat "$LS/home-content.html")" >/dev/null 2>&1
fi
WP option update show_on_front page >/dev/null 2>&1
WP option update page_on_front "$HOME_ID" >/dev/null 2>&1
echo "    front page ID=$HOME_ID / show_on_front=$(WP option get show_on_front 2>/dev/null)"

echo "[3/5] フッター直前＝footer-content.html / ヘッダー内部＝header-cta-content.html を配置"
WP widget reset before_footer head_box >/dev/null 2>&1 || true
WP widget add custom_html before_footer --content="$(cat "$LS/footer-content.html")" >/dev/null 2>&1
WP widget add custom_html head_box     --content="$(cat "$LS/header-cta-content.html")" >/dev/null 2>&1
echo "    before_footer: $(WP widget list before_footer --field=id --format=csv 2>/dev/null | tr '\n' ' ')"

echo "[4/5] https一括置換 DRY-RUN（本番予行・実置換しない／guidは本番で除外する）"
WP search-replace 'http://www.trust-supply.com' 'https://www.trust-supply.com' \
  --dry-run --all-tables --report-changed-only 2>/dev/null | tail -6

echo "[5/5] 本番 pretty URL 検証リスト出力（さくらでこの全URLを curl 200/301 確認）"
"$PHP" "$PHAR" eval '
 $ids=[1908,430,1295,140,155,158,160,162,164,166,169,172,175,177,180,183,192,206,208,223,138];
 foreach($ids as $id){ $p=get_post($id); if(!$p){echo "  (missing) ID$id\n";continue;}
   $path=trim(parse_url(get_permalink($id),PHP_URL_PATH),"/");
   echo sprintf("  https://www.trust-supply.com/%s/  [ID %d %s]\n",$path,$id,$p->post_status); }
' --path="$DIR" --skip-themes --skip-plugins 2>/dev/null \
 || echo "  ※ permalink構造がローカルはプレーン。slugマップから本番URLは production-runbook.md の検証表を使用"

echo
echo "完了。front: http://localhost:8888/ots/  ／ 検証: node wp-inventory/shot-rehearsal.mjs"
echo "本番手順は site/local-staging/production-runbook.md 参照（このスクリプトの工程＝本番の[E]〜[H]に対応）"

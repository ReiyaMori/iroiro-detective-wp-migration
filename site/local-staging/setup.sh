#!/bin/bash
# ローカルSWELLステージング 自動構築（MAMP）
# 客先本番さくらサーバーには一切触れない。すべてローカル。
# 使い方: bash site/local-staging/setup.sh   （プロジェクトルートから実行）
set -euo pipefail

PROJ="$(cd "$(dirname "$0")/../.." && pwd)"          # プロジェクトルート
PHP=/Applications/MAMP/bin/php/php8.3.30/bin/php
PHAR=/Applications/MAMP/htdocs/clubakino/wp-cli.phar  # 既存WP-CLI(v2.12.0)を再利用
DIR=/Applications/MAMP/htdocs/ots                     # ローカルWPルート
MYSQL=/Applications/MAMP/Library/bin/mysql80/bin/mysql
SWELL="$PROJ/site/swell-theme/swell-2.16.0-official.zip"
CHILD="$PROJ/site/swell-theme/swell_child"
WXR="$PROJ/wp-inventory/data/wxr/pages_ots.WordPress.2026-05-12.xml"
URL="http://localhost:8888/ots"

WP(){ "$PHP" "$PHAR" "$@" --path="$DIR"; }

echo "[1/8] MAMP起動"
/Applications/MAMP/bin/start.sh >/dev/null 2>&1 || true
for i in $(seq 1 20); do
  "$MYSQL" --connect-timeout=3 -uroot -proot -h127.0.0.1 -P8889 -e "SELECT 1" >/dev/null 2>&1 && break
  sleep 1
done
echo "[2/8] DB作成 ots_local"
"$MYSQL" -uroot -proot -h127.0.0.1 -P8889 -e \
  "CREATE DATABASE IF NOT EXISTS ots_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[3/8] WP core DL + 設定 + インストール"
mkdir -p "$DIR"
[ -f "$DIR/wp-load.php" ] || "$PHP" "$PHAR" core download --locale=ja --path="$DIR"
[ -f "$DIR/wp-config.php" ] || "$PHP" "$PHAR" config create \
  --dbname=ots_local --dbuser=root --dbpass=root --dbhost=127.0.0.1:8889 \
  --locale=ja --skip-check --path="$DIR"
WP core is-installed 2>/dev/null || WP core install \
  --url="$URL" --title="OTS探偵社 ローカル検証" \
  --admin_user=admin --admin_password=admin --admin_email=reiya2796@gmail.com --skip-email

echo "[4/8] SWELL親テーマ導入"
WP theme is-installed swell 2>/dev/null || WP theme install "$SWELL"

echo "[5/8] 確定子テーマ コピー＆有効化"
rm -rf "$DIR/wp-content/themes/swell_child"
cp -R "$CHILD" "$DIR/wp-content/themes/swell_child"
WP theme activate swell_child

echo "[6/8] wordpress-importer 導入"
WP plugin is-active wordpress-importer 2>/dev/null || WP plugin install wordpress-importer --activate

echo "[7/8] 固定ページWXR取込（attachmentはskip＝画像は本番URL参照で検証）"
WP import "$WXR" --authors=create --skip=attachment

echo "[8/8] permalink プレーン化（MAMPは.htaccess未適用＝ローカル検証は ?page_id= 直叩き）"
WP option update permalink_structure '' >/dev/null

echo
echo "完了。検証URL例（プレーンpermalink）:"
echo "  代表挨拶            $URL/?page_id=138"
echo "  法人信用調査(表2)    $URL/?page_id=160"
echo "  個人信用調査(表3)    $URL/?page_id=162"
echo "  悪徳業者(長文)       $URL/?page_id=223"
echo "  浮気調査            $URL/?page_id=140"
echo "  管理画面            $URL/wp-admin/  (admin/admin)"
echo "※ 階層pretty URLの正しさは 'wp post url <ID>' で確認（本番Apacheでは正常表示）"

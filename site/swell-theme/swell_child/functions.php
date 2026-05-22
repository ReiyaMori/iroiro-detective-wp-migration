<?php
/**
 * SWELL CHILD - functions.php
 * 株式会社OTS探偵社サイト用カスタマイズ
 *
 * 親テーマのスタイルは SWELL 本体が自動で読み込むため、
 * ここでは子テーマCSSのエンキューのみ行う（SWELL公式推奨方式）。
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_enqueue_scripts', function () {

	// 確定書体: 教科書体 = Klee One（2026-05-17 先方A案＋教科書体で確定）
	wp_enqueue_style(
		'ots-klee-one',
		'https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap',
		array(),
		null
	);

	$child_style = get_stylesheet_directory() . '/style.css';
	wp_enqueue_style(
		'swell-child-style',
		get_stylesheet_uri(),
		array( 'ots-klee-one' ),
		file_exists( $child_style ) ? filemtime( $child_style ) : null
	);
}, 20 );

// Google Fonts への preconnect（描画前の接続確立で初期表示を高速化）
add_action( 'wp_head', function () {
	echo '<link rel="preconnect" href="https://fonts.googleapis.com">' . "\n";
	echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n";
}, 1 );

/**
 * 2026-05-22 本番移管時に追加（OTS探偵社）
 */

// 全ページ1カラム化（サイドバー非表示）。SWELL公式フィルタ swell_is_show_sidebar を使用。
add_filter( 'swell_is_show_sidebar', '__return_false' );

// OTS専用フッター（pre-CTA帯＋会社情報＋探偵業届出証明書番号＋サイトナビ）を出力。
// SWELL既定フッター(#footer.l-footer)は style.css で非表示にし、本フッターで置換する。
// ※ before_footer/head_box ウィジェットは SWELL のブロックウィジェット・キャッシュ機構
//    （Pre_Parse_Blocks）と噛み合わず REST 投入が反映されないため、確実な子テーマ出力方式を採用。
//    探偵業届出証明書番号（探偵業法§10）は parts/ots-footer.html 内に必須表示。
add_action( 'wp_footer', function () {
	$f = get_stylesheet_directory() . '/parts/ots-footer.html';
	if ( is_readable( $f ) ) {
		echo file_get_contents( $f ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}, 5 );

// GA4 計測タグ（測定ID G-R4QNT2LK2X・2026-05-22 設置）。既存GA計測が停止していたため再設置。
add_action( 'wp_head', function () {
	?>
<!-- Google tag (gtag.js) - GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-R4QNT2LK2X"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-R4QNT2LK2X');
</script>
	<?php
}, 2 );

// Contact Form 7 送信完了を GA4 イベント(generate_lead)として送信＝問い合わせ完了のCV計測。
// ※ GA4管理画面側で generate_lead を「キーイベント」に指定すること。
add_action( 'wp_footer', function () {
	?>
<script>
document.addEventListener('wpcf7mailsent', function (e) {
	if (typeof gtag === 'function') {
		gtag('event', 'generate_lead', {
			event_category: 'contact',
			event_label: 'cf7_submit',
			form_id: (e.detail && e.detail.contactFormId) ? e.detail.contactFormId : ''
		});
	}
}, false);
</script>
	<?php
}, 20 );

// ヘッダー右クラスタ（24時間バッジ＋電話0120＋無料相談CTA）を SWELL ヘッダーへ注入。
// SWELLヘッダーバー内に注入できるPHPフックが無いため、JSで .l-header__inner / .l-fixHeader__inner へ挿入。
// 配色は子テーマ §1b（.ots-hcta 系）が適用。承認デザイン plan-a のヘッダー右に合わせる。
add_action( 'wp_footer', function () {
	?>
<script>
(function(){
	var html = '<div class="ots-hcta"><a class="ots-hcta__tel" href="tel:0120556624">0120-556-624</a><a class="ots-hcta__form" href="/contact">無料相談</a></div>';
	function inject(){
		document.querySelectorAll('.l-header__inner, .l-fixHeader__inner').forEach(function(c){
			if (c && !c.querySelector('.ots-hcta')) { c.insertAdjacentHTML('beforeend', html); }
		});
		// ヘッダーロゴの表示名を短縮（plan-aの社名ロゴに合わせる。SEO<title>はAIOSEO管理で別管理）
		document.querySelectorAll('.c-headLogo__link').forEach(function(a){
			if (/熊本市の探偵/.test(a.textContent)) { a.textContent = '株式会社OTS探偵社'; }
		});
	}
	if (document.readyState !== 'loading') { inject(); }
	else { document.addEventListener('DOMContentLoaded', inject); }
})();
</script>
	<?php
}, 21 );

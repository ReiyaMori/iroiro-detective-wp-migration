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

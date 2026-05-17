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

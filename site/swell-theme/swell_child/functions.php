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
	$child_style = get_stylesheet_directory() . '/style.css';
	wp_enqueue_style(
		'swell-child-style',
		get_stylesheet_uri(),
		array(),
		file_exists( $child_style ) ? filemtime( $child_style ) : null
	);
}, 20 );

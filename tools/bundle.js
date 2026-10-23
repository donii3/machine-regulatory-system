#!/usr/bin/env node
/**
 * bundle.js – builds dist/sachetguard-standalone.html, a single file with all
 * CSS and JavaScript (including Chart.js) inlined. No dependencies; Node 14+.
 *
 * Usage (from the sachet-pm folder):   node tools/bundle.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

// Inline stylesheets: <link rel="stylesheet" href="css/x.css">
html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, function (_, href) {
  return '<style>/* ' + href + ' */\n' + read(href) + '\n</style>';
});

// Inline scripts: <script src="js/x.js"></script>. A function replacement is used
// so "$" characters in the source are never treated as replacement patterns.
html = html.replace(/<script\s+src="([^"]+)"\s*><\/script>/g, function (_, src) {
  var code = read(src).replace(/<\/script/gi, '<\\/script');
  return '<script>/* ' + src + ' */\n' + code + '\n</script>';
});

var outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
var out = path.join(outDir, 'sachetguard-standalone.html');
fs.writeFileSync(out, html);

var kb = Math.round(fs.statSync(out).size / 1024);
console.log('Wrote ' + path.relative(process.cwd(), out) + ' (' + kb + ' KB)');

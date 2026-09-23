/* Build script: src/ (readable) -> dist/ (production).
   - minifies CSS and JavaScript with esbuild
   - inlines critical.css in the HTML and loads style.css without blocking rendering
   - adds a content hash to CSS/JS file names so they can be cached for a year
   - minifies the HTML
   - copies fonts, images and the favicon
   Run:  npm install && npm run build */
import { transformSync } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';

const SRC = 'src';
const DIST = 'dist';
const read = (p) => readFileSync(join(SRC, p), 'utf8');
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const report = [];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'css'), { recursive: true });
mkdirSync(join(DIST, 'js'), { recursive: true });
for (const dir of ['fonts', 'images']) cpSync(join(SRC, dir), join(DIST, dir), { recursive: true });
cpSync(join(SRC, 'favicon.svg'), join(DIST, 'favicon.svg'));

function size(label, source, output) {
  report.push({ label, source: source.length, min: output.length, gzip: gzipSync(output).length, br: brotliCompressSync(output).length });
}

/* CSS */
const critical = transformSync(read('css/critical.css'), { loader: 'css', minify: true }).code.replaceAll('../fonts/', 'fonts/');
size('critical.css (inlined)', read('css/critical.css'), critical);
const rest = transformSync(read('css/style.css'), { loader: 'css', minify: true }).code;
const restName = `style.${hash(rest)}.css`;
writeFileSync(join(DIST, 'css', restName), rest);
size('style.css', read('css/style.css'), rest);

/* JavaScript */
const js = transformSync(read('js/main.js'), { minify: true, target: 'es2020' }).code;
const jsName = `main.${hash(js)}.js`;
writeFileSync(join(DIST, 'js', jsName), js);
size('main.js', read('js/main.js'), js);

/* HTML */
let html = read('index.html');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error('Marker not found in index.html: ' + from);
  html = html.replace(from, to);
};
swap('<link rel="stylesheet" href="css/critical.css" data-build="inline">', `<style>${critical}</style>`);
swap(
  '<link rel="stylesheet" href="css/style.css" data-build="defer">',
  `<link rel="preload" href="css/${restName}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="css/${restName}"></noscript>`
);
swap('src="js/main.js"', `src="js/${jsName}"`);
const out = await minifyHtml(html, { collapseWhitespace: true, conservativeCollapse: true, removeComments: true, keepClosingSlash: false, collapseBooleanAttributes: true });
writeFileSync(join(DIST, 'index.html'), out);
size('index.html', read('index.html'), out);

/* Cache rules for hosts that read a _headers file (Netlify, Cloudflare Pages) */
writeFileSync(join(DIST, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/index.html
  Cache-Control: no-cache
/css/*
  Cache-Control: public, max-age=31536000, immutable
/js/*
  Cache-Control: public, max-age=31536000, immutable
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/images/*
  Cache-Control: public, max-age=31536000, immutable
`);

console.log('\nfile'.padEnd(26) + 'source'.padStart(10) + 'minified'.padStart(11) + 'gzip'.padStart(10) + 'brotli'.padStart(10));
for (const r of report) console.log(r.label.padEnd(25) + kb(r.source).padStart(10) + kb(r.min).padStart(11) + kb(r.gzip).padStart(10) + kb(r.br).padStart(10));
const total = (dir) => readdirSync(dir, { recursive: true }).reduce((n, f) => (statSync(join(dir, f)).isFile() ? n + statSync(join(dir, f)).size : n), 0);
console.log('\ndist total on disk:', kb(total(DIST)));

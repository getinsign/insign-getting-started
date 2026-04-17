#!/usr/bin/env node
// ============================================================================
// build-vendor.js - Copy npm packages into docs/vendor/ for self-hosting
// ============================================================================
//
// Replaces CDN dependencies with locally served files.
// Run after `npm install` or when updating package versions.
//
// Usage:  node scripts/build-vendor.js
//         npm run build:vendor
//
// Dependabot updates package.json versions automatically.
// CI runs this script to keep docs/vendor/ in sync.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VENDOR = path.join(ROOT, 'docs', 'vendor');
const NM = path.join(ROOT, 'node_modules');

// ---- helpers ---------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copy(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, filter) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filter);
    } else if (!filter || filter(srcPath)) {
      copy(srcPath, destPath);
    }
  }
}

function clean(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---- main ------------------------------------------------------------------

console.log('Building docs/vendor/ from npm packages...\n');

// Clean previous build
clean(VENDOR);
ensureDir(VENDOR);

// -- Bootstrap CSS & JS -----------------------------------------------------
const bsDist = path.join(NM, 'bootstrap', 'dist');
copy(
  path.join(bsDist, 'css', 'bootstrap.min.css'),
  path.join(VENDOR, 'bootstrap', 'css', 'bootstrap.min.css')
);
copy(
  path.join(bsDist, 'css', 'bootstrap.min.css.map'),
  path.join(VENDOR, 'bootstrap', 'css', 'bootstrap.min.css.map')
);
copy(
  path.join(bsDist, 'js', 'bootstrap.bundle.min.js'),
  path.join(VENDOR, 'bootstrap', 'js', 'bootstrap.bundle.min.js')
);
copy(
  path.join(bsDist, 'js', 'bootstrap.bundle.min.js.map'),
  path.join(VENDOR, 'bootstrap', 'js', 'bootstrap.bundle.min.js.map')
);
console.log('  bootstrap .......... OK');

// -- Bootstrap Icons ---------------------------------------------------------
const biFont = path.join(NM, 'bootstrap-icons', 'font');
copy(
  path.join(biFont, 'bootstrap-icons.min.css'),
  path.join(VENDOR, 'bootstrap-icons', 'font', 'bootstrap-icons.min.css')
);
// Copy font files (woff, woff2) referenced by the CSS
const biFontsDir = path.join(biFont, 'fonts');
if (fs.existsSync(biFontsDir)) {
  copyDir(biFontsDir, path.join(VENDOR, 'bootstrap-icons', 'font', 'fonts'));
}
console.log('  bootstrap-icons .... OK');

// -- jQuery ------------------------------------------------------------------
copy(
  path.join(NM, 'jquery', 'dist', 'jquery.min.js'),
  path.join(VENDOR, 'jquery', 'jquery.min.js')
);
copy(
  path.join(NM, 'jquery', 'dist', 'jquery.min.map'),
  path.join(VENDOR, 'jquery', 'jquery.min.map')
);
console.log('  jquery ............. OK');

// -- Monaco Editor ------------------------------------------------------
// Since 0.50+ Monaco uses a flat bundle structure under min/vs/ instead of
// the old base/editor/language subdirectory layout. Copy the entire tree
// so both old and new versions work without listing individual paths.
const monacoSrc = path.join(NM, 'monaco-editor', 'min', 'vs');
const monacoDest = path.join(VENDOR, 'monaco-editor', 'min', 'vs');
copyDir(monacoSrc, monacoDest);
console.log('  monaco-editor ...... OK');

// -- PDF.js (pdf viewer for explorer) ----------------------------------------
const pdfjs = path.join(NM, 'pdfjs-dist', 'build');
const pdfjsDest = path.join(VENDOR, 'pdfjs-dist', 'build');
copy(path.join(pdfjs, 'pdf.min.mjs'), path.join(pdfjsDest, 'pdf.min.mjs'));
copy(path.join(pdfjs, 'pdf.worker.min.mjs'), path.join(pdfjsDest, 'pdf.worker.min.mjs'));
console.log('  pdfjs-dist ......... OK');

// -- Roboto fonts (latin, weights 300/400/500/700) ---------------------------
const fontsDir = path.join(VENDOR, 'fonts');
ensureDir(fontsDir);

const robotoWeights = [300, 400, 500, 700];
const robotoMonoWeights = [400, 500];

let fontsCss = '/* Self-hosted Roboto + Roboto Mono (from @fontsource) */\n\n';

for (const w of robotoWeights) {
  const cssFile = path.join(NM, '@fontsource', 'roboto', `latin-${w}.css`);
  if (fs.existsSync(cssFile)) {
    const css = fs.readFileSync(cssFile, 'utf8');
    // Rewrite paths: ./files/xxx -> ./files/xxx
    fontsCss += css.replace(/url\(\.\/files\//g, 'url(./files/') + '\n';
    // Copy woff2 + woff files
    const woff2 = path.join(NM, '@fontsource', 'roboto', 'files', `roboto-latin-${w}-normal.woff2`);
    const woff = path.join(NM, '@fontsource', 'roboto', 'files', `roboto-latin-${w}-normal.woff`);
    if (fs.existsSync(woff2)) copy(woff2, path.join(fontsDir, 'files', `roboto-latin-${w}-normal.woff2`));
    if (fs.existsSync(woff)) copy(woff, path.join(fontsDir, 'files', `roboto-latin-${w}-normal.woff`));
  }
}

for (const w of robotoMonoWeights) {
  const cssFile = path.join(NM, '@fontsource', 'roboto-mono', `latin-${w}.css`);
  if (fs.existsSync(cssFile)) {
    const css = fs.readFileSync(cssFile, 'utf8');
    fontsCss += css.replace(/url\(\.\/files\//g, 'url(./files/') + '\n';
    const woff2 = path.join(NM, '@fontsource', 'roboto-mono', 'files', `roboto-mono-latin-${w}-normal.woff2`);
    const woff = path.join(NM, '@fontsource', 'roboto-mono', 'files', `roboto-mono-latin-${w}-normal.woff`);
    if (fs.existsSync(woff2)) copy(woff2, path.join(fontsDir, 'files', `roboto-mono-latin-${w}-normal.woff2`));
    if (fs.existsSync(woff)) copy(woff, path.join(fontsDir, 'files', `roboto-mono-latin-${w}-normal.woff`));
  }
}

fs.writeFileSync(path.join(fontsDir, 'roboto.css'), fontsCss);
console.log('  roboto fonts ....... OK');

// -- Summary -----------------------------------------------------------------
const totalFiles = (function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
})(VENDOR);

console.log(`\nDone. ${totalFiles} files in docs/vendor/`);

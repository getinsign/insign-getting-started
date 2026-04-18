#!/usr/bin/env node
/**
 * Build the 1200x630 social share card at docs/img/og-card.png.
 *
 * Uses Playwright's headless Chromium to rasterize a self-contained HTML
 * template (rocket + logo embedded as data URLs, fonts loaded from Google
 * Fonts) into a PNG. Re-run whenever the design, wordmark, or tagline changes.
 *
 * Usage:
 *   npx playwright install chromium   # one-time setup
 *   node scripts/build-og-card.mjs
 *
 * Requires: playwright (installed via package.json devDependencies).
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'docs', 'img');
const OUT = path.join(IMG_DIR, 'og-card.png');

const rocketDataUrl = 'data:image/png;base64,'
    + fs.readFileSync(path.join(IMG_DIR, 'rocket.png')).toString('base64');
const logoDataUrl = 'data:image/svg+xml;base64,'
    + fs.readFileSync(path.join(IMG_DIR, 'inSign_logo.svg')).toString('base64');

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px;
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    color: #0b2545;
    background:
      radial-gradient(1200px 800px at 100% 0%, rgba(1,74,140,0.06), transparent 60%),
      linear-gradient(135deg, #ffffff 0%, #eef3f8 100%);
    display: grid;
    grid-template-columns: 1fr 720px;
    align-items: center;
    position: relative;
    overflow: hidden;
  }
  body::before {
    content: '';
    position: absolute; inset: 0;
    background-image: radial-gradient(rgba(1,74,140,0.08) 1.5px, transparent 1.5px);
    background-size: 24px 24px;
    opacity: 0.45;
    mask-image: radial-gradient(ellipse at 30% 50%, black 0%, transparent 65%);
    -webkit-mask-image: radial-gradient(ellipse at 30% 50%, black 0%, transparent 65%);
    pointer-events: none;
  }
  .left { padding: 56px 0 56px 72px; position: relative; z-index: 1; }
  .brand {
    display: flex; align-items: center; gap: 14px;
    margin-bottom: 56px;
  }
  .brand img { height: 40px; }
  .brand .divider { width: 1px; height: 28px; background: #0b2545; opacity: 0.15; }
  .brand .kicker {
    font-size: 14px; font-weight: 500; letter-spacing: 0.14em;
    text-transform: uppercase; color: #014A8C;
  }
  h1 {
    margin: 0 0 20px 0;
    font-size: 62px; font-weight: 700; line-height: 1.05;
    letter-spacing: -0.02em;
    max-width: 620px;
  }
  .sub {
    margin: 0 0 36px 0;
    font-size: 24px; font-weight: 400; line-height: 1.35;
    color: #415a77; max-width: 560px;
  }
  .sub b { color: #014A8C; font-weight: 500; }
  .badges { display: flex; gap: 10px; flex-wrap: wrap; }
  .badge {
    font-size: 15px; font-weight: 500;
    padding: 8px 14px; border-radius: 999px;
    background: rgba(1,74,140,0.08);
    color: #014A8C;
    border: 1px solid rgba(1,74,140,0.15);
  }
  .right {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    height: 100%;
  }
  .rocket-wrap {
    width: 690px; height: 690px;
    display: flex; align-items: center; justify-content: center;
  }
  .rocket-wrap img { width: 100%; height: auto; display: block; }
</style></head>
<body>
  <div class="left">
    <div class="brand">
      <img src="${logoDataUrl}" alt="inSign">
      <span class="divider"></span>
      <span class="kicker">Developer Hub</span>
    </div>
    <h1>Electronic Signature API</h1>
    <p class="sub"><b>eIDAS</b> · <b>QES</b> · EU-hosted · DSGVO-ready<br>Free sandbox — no registration, no API key.</p>
    <div class="badges">
      <span class="badge">eIDAS</span>
      <span class="badge">QES</span>
      <span class="badge">EU-hosted</span>
      <span class="badge">ISO 27001</span>
    </div>
  </div>
  <div class="right">
    <div class="rocket-wrap"><img src="${rocketDataUrl}" alt=""></div>
  </div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.screenshot({
    path: OUT,
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
console.log(`wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);

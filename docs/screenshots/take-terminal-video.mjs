#!/usr/bin/env node
/**
 * Generic animated-terminal recorder.
 *
 * Opens a self-contained terminal HTML page (terminal-java.html /
 * terminal-sigfunnel.html / ...) in headless Chrome and captures the full
 * animation as a webm under docs/video/. The page is loaded via file:// so
 * no web server is needed.
 *
 * Usage:
 *   node docs/screenshots/take-terminal-video.mjs <html-basename> <output-basename> [duration-ms]
 *
 * Example:
 *   node docs/screenshots/take-terminal-video.mjs terminal-java.html terminal-java.webm 22000
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
// Terminal pre-rolls are intermediate artifacts — they get muxed into the
// final docs/video/*.webm by scripts/stitch-video.mjs, so they live under
// .target/ (gitignored) rather than in the tracked docs/video/ tree.
const OUT_DIR = path.join(REPO, '.target', 'video');
const TMP_BASE = path.join(REPO, '.target', 'terminal-recording');
const VIEWPORT = { width: 1920, height: 1080 };

function resolveChrome() {
  const env = process.env.CHROME_PATH;
  const candidates = [env, '/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function recordTerminal(htmlName, outName, durationMs = 22_000) {
  const html = path.join(__dirname, htmlName);
  if (!fs.existsSync(html)) throw new Error(`missing ${html}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = path.join(TMP_BASE, outName.replace(/\.webm$/, ''));
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const executablePath = resolveChrome();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: tmp, size: VIEWPORT },
  });
  const page = await context.newPage();

  // Fail the recording if the terminal HTML surfaces any uncaught JS or
  // error-level console messages.
  const browserErrors = [];
  page.on('pageerror', e => browserErrors.push('UNCAUGHT: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('favicon') || t.includes('ERR_CONNECTION')) return;
    browserErrors.push(t);
  });

  console.log(`> Recording ${htmlName} → ${outName} (${(durationMs / 1000).toFixed(1)}s)`);
  await page.goto('file://' + html);
  await page.waitForTimeout(durationMs);
  await page.close();
  await context.close();
  await browser.close();

  if (browserErrors.length > 0) {
    console.error(`\n✗ Browser console is not clean (${browserErrors.length} error(s)):`);
    browserErrors.forEach(e => console.error('  ' + e.substring(0, 400)));
    throw new Error(`browser console errors during ${htmlName} recording`);
  }

  const rec = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
  if (!rec) throw new Error(`no .webm produced under ${tmp}`);
  const out = path.join(OUT_DIR, outName);
  fs.copyFileSync(path.join(tmp, rec), out);
  const { size } = fs.statSync(out);
  console.log(`  wrote ${path.relative(REPO, out)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  return out;
}

async function main() {
  const [, , htmlName, outName, durStr] = process.argv;
  if (!htmlName || !outName) {
    console.error('usage: take-terminal-video.mjs <html> <out.webm> [ms]');
    process.exit(2);
  }
  const durationMs = durStr ? Number(durStr) : 22_000;
  await recordTerminal(htmlName, outName, durationMs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { recordTerminal };

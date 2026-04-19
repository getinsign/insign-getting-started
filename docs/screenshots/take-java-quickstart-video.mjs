#!/usr/bin/env node
/**
 * Java-quickstart terminal-animation recorder.
 *
 * Opens docs/screenshots/terminal-java.html in a headless Chrome browser,
 * records the full animation (git clone → cd → mvn spring-boot:run → ready)
 * as docs/video/java-quickstart.webm. The page is self-contained; no static
 * server needed — Playwright loads it via file://.
 *
 * Usage:
 *   node docs/screenshots/take-java-quickstart-video.mjs
 *   npm run build:video:java
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const HTML = path.join(__dirname, 'terminal-java.html');
const OUT_DIR = path.join(REPO, 'docs', 'video');
const OUT_FILE = path.join(OUT_DIR, 'java-quickstart.webm');
const TMP_DIR = path.join(REPO, '.target', 'java-quickstart-recording');

const VIEWPORT = { width: 1920, height: 1080 };
// Animation total ≈ 16 s — recording 22 s leaves a comfortable tail on the
// final "Ready" line. Update this if the scene in terminal-java.html grows.
const RECORD_MS = 22_000;

// Prefer real Chrome (ships PDFium + modern renderer + consistent headless
// behaviour). Fall back to Playwright's bundled chromium if not present.
function resolveChrome() {
  const env = process.env.CHROME_PATH;
  const candidates = [env, '/home/t/bin/google-chrome', '/opt/google/chrome/chrome', '/usr/bin/google-chrome'].filter(Boolean);
  return candidates.find(p => fs.existsSync(p)) || null;
}

async function main() {
  if (!fs.existsSync(HTML)) throw new Error(`missing ${HTML}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const executablePath = resolveChrome();
  if (executablePath) {
    console.log(`> Using ${executablePath}`);
  } else {
    console.log('> Using Playwright\'s bundled chromium');
  }

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: TMP_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  console.log('> Recording terminal animation...');
  await page.goto('file://' + HTML);
  await page.waitForTimeout(RECORD_MS);

  await page.close();
  await context.close();
  await browser.close();

  const rec = fs.readdirSync(TMP_DIR).find(f => f.endsWith('.webm'));
  if (!rec) throw new Error(`no .webm produced under ${TMP_DIR}`);
  fs.copyFileSync(path.join(TMP_DIR, rec), OUT_FILE);
  const { size } = fs.statSync(OUT_FILE);
  console.log(`> Wrote ${path.relative(REPO, OUT_FILE)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

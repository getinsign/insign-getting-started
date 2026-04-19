#!/usr/bin/env node
/**
 * Records a storyboard-driven walkthrough of the Java Spring Boot sample
 * app. Assumes the app is running on http://localhost:8090 (started
 * externally via `cd src/java/app && mvn spring-boot:run -Pspring-client`,
 * or bring-up via the existing docker-compose in the user's dev env).
 *
 * If the app isn't running, the script aborts early instead of spinning
 * Maven itself — keeps the recorder fast and side-effect-free.
 *
 * Output: docs/video/java-app-demo.webm (raw app walkthrough, no terminal
 * pre-roll). scripts/stitch-video.mjs merges it with terminal-java.webm
 * into the final docs/video/java-quickstart.webm.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';
import { installDemoOverlays, runStoryboard, createMarkers, loadStoryboard } from './lib/storyboard-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const STORYBOARD = path.join(REPO, 'docs', 'video', 'java-app-narration.json');
const OUT_DIR = path.join(REPO, 'docs', 'video');
const OUT_FILE = path.join(OUT_DIR, 'java-app-demo.webm');
const TIMINGS_FILE = path.join(OUT_DIR, 'java-app-timings.json');
const TMP = path.join(REPO, '.target', 'java-app-recording');
const VIEWPORT = { width: 1920, height: 1080 };
const APP_URL = process.env.JAVA_APP_URL || 'http://localhost:8090/';

function resolveChrome() {
  const env = process.env.CHROME_PATH;
  const candidates = [env, '/home/t/bin/google-chrome', '/opt/google/chrome/chrome', '/usr/bin/google-chrome'].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function ensureAppReachable() {
  try {
    const res = await fetch(APP_URL, { method: 'HEAD' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(
      `Java sample app is not reachable at ${APP_URL} (${err.message}).\n` +
      `Start it with: cd src/java/app && mvn spring-boot:run -Pspring-client`
    );
  }
}

async function main() {
  await ensureAppReachable();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const storyboard = loadStoryboard(STORYBOARD);

  const executablePath = resolveChrome();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: TMP, size: VIEWPORT },
  });
  const page = await context.newPage();

  console.log(`> Recording Java app walkthrough (${storyboard.steps.length} steps)...`);
  const markers = createMarkers();
  try {
    await runStoryboard(page, storyboard, markers, { lang: 'en' });
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rec = fs.readdirSync(TMP).find((f) => f.endsWith('.webm'));
  if (!rec) throw new Error(`no .webm produced under ${TMP}`);
  fs.copyFileSync(path.join(TMP, rec), OUT_FILE);
  const { size } = fs.statSync(OUT_FILE);
  console.log(`  wrote ${path.relative(REPO, OUT_FILE)} (${(size / 1024 / 1024).toFixed(2)} MB)`);

  const timings = markers.finish();
  timings.viewport = VIEWPORT;
  fs.writeFileSync(TIMINGS_FILE, JSON.stringify(timings, null, 2));
  console.log(`  wrote ${path.relative(REPO, TIMINGS_FILE)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

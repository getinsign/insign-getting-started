#!/usr/bin/env node
/**
 * Funnel video generator for the broker-mandate signing demo.
 *
 * Drives the Playwright spec in src/sign-widget-demo-application with
 * DEMO_VIDEO=1 and CAPTION_LANG=<lang>, then copies the resulting .webm into
 * docs/video/ so it can be embedded. Captions are rendered in-page as styled
 * floating popups and therefore burned into the recording.
 *
 * By default records both English and German and writes:
 *   docs/video/funnel.webm      (English captions)
 *   docs/video/funnel.de.webm   (German captions)
 *
 * Usage:
 *   npm run build:video               # both languages
 *   LANGS=en node .../take-funnel-video.mjs
 *   LANGS=de node .../take-funnel-video.mjs
 *
 * Requires:
 *   - src/sign-widget-demo-application: npm install + `npx playwright install`
 *   - A Google Chrome install on $PATH (headless Chrome renders the PDF viewer)
 *
 * The underlying test hits the real inSign sandbox; failures likely mean the
 * sandbox is unreachable, not that this wrapper is broken.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const APP = path.join(REPO, 'src', 'sign-widget-demo-application');
const RESULTS = path.join(APP, '.target', 'test-results');
const OUT_DIR = path.join(REPO, 'docs', 'video');

const LANGS = (process.env.LANGS || 'en,de').split(',').map(s => s.trim()).filter(Boolean);

function runNpmTest(extraEnv) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npm',
      ['test', '--', '-g', 'Full flow - Fill, Draw signature, Finish'],
      {
        cwd: APP,
        env: { ...process.env, DEMO_VIDEO: '1', ...extraEnv },
        stdio: 'inherit',
      }
    );
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`npm test exited ${code}`)));
    proc.on('error', reject);
  });
}

function findArtifact(dir, endsWith) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findArtifact(p, endsWith);
      if (hit) return hit;
    } else if (entry.name.endsWith(endsWith)) {
      return p;
    }
  }
  return null;
}

function outNames(lang) {
  // Raw app walkthrough only. Final docs/video/funnel.{webm,de.webm} are
  // produced by scripts/stitch-video.mjs joining terminal-sigfunnel.webm
  // (pre-roll) with these app-only recordings.
  return lang === 'en'
    ? { video: 'funnel-app.webm', timings: 'funnel-timings.json' }
    : { video: `funnel-app.${lang}.webm`, timings: `funnel-timings.${lang}.json` };
}

async function recordOne(lang) {
  const names = outNames(lang);
  console.log(`\n> Recording ${lang.toUpperCase()} → ${names.video}`);
  fs.rmSync(RESULTS, { recursive: true, force: true });
  await runNpmTest({ CAPTION_LANG: lang });

  const video = findArtifact(RESULTS, '.webm');
  if (!video) throw new Error(`No .webm found under ${RESULTS}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const videoOut = path.join(OUT_DIR, names.video);
  fs.copyFileSync(video, videoOut);
  const { size } = fs.statSync(videoOut);
  console.log(`  wrote ${path.relative(REPO, videoOut)} (${(size / 1024 / 1024).toFixed(2)} MB)`);

  const timings = findArtifact(RESULTS, 'funnel-timings.json');
  if (timings) {
    const timingsOut = path.join(OUT_DIR, names.timings);
    fs.copyFileSync(timings, timingsOut);
    console.log(`  wrote ${path.relative(REPO, timingsOut)}`);
  }
}

async function main() {
  for (const lang of LANGS) {
    await recordOne(lang);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Funnel video generator for the SEPA mandate signing demo.
 *
 * Drives the existing Playwright spec in src/sign-widget-demo-application
 * with DEMO_VIDEO=1 (which widens the viewport to 1920x1080, enables video
 * recording, and inserts ~5 s demo pauses between user actions), then copies
 * the resulting .webm into docs/video/funnel.webm so it can be embedded.
 *
 * Usage:
 *   node docs/screenshots/take-funnel-video.mjs
 *   npm run build:video
 *
 * Requires:
 *   - cd src/sign-widget-demo-application && npm install (one-time)
 *   - npx playwright install chromium (one-time, in that subproject)
 *
 * The underlying test hits the real inSign sandbox; failures likely mean
 * the sandbox is unreachable, not that this wrapper is broken.
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
const OUT_FILE = path.join(OUT_DIR, 'funnel.webm');

function runNpmTest() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npm',
      ['test', '--', '-g', 'Full flow - Fill, Draw signature, Finish'],
      {
        cwd: APP,
        env: { ...process.env, DEMO_VIDEO: '1' },
        stdio: 'inherit',
      }
    );
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`npm test exited ${code}`)));
    proc.on('error', reject);
  });
}

function findVideo(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findVideo(p);
      if (hit) return hit;
    } else if (entry.name.endsWith('.webm')) {
      return p;
    }
  }
  return null;
}

async function main() {
  console.log('> Cleaning previous test artifacts...');
  fs.rmSync(RESULTS, { recursive: true, force: true });

  console.log('> Running funnel spec with DEMO_VIDEO=1 (this takes ~25-60 s)...');
  await runNpmTest();

  const video = findVideo(RESULTS);
  if (!video) throw new Error(`No .webm found under ${RESULTS}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(video, OUT_FILE);
  const { size } = fs.statSync(OUT_FILE);
  console.log(`> Wrote ${path.relative(REPO, OUT_FILE)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

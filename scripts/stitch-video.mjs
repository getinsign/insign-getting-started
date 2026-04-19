#!/usr/bin/env node
/**
 * ffmpeg wrapper for joining two webm clips with a zoom-in transition.
 *
 * The first clip (the terminal animation) plays, then the second clip (the
 * browser app walkthrough) fades in with a `zoomin` xfade effect — gives the
 * demo a cinematic "jumping into the live app" feel.
 *
 * Both inputs need matching dimensions and frame rates; ffmpeg's `scale` +
 * `fps` filters are applied defensively so slightly different encodings
 * (different video.framerate, different timebase) still stitch cleanly.
 *
 * Usage:
 *   node scripts/stitch-video.mjs <terminal.webm> <app.webm> <out.webm> [transition-seconds]
 *
 * Example:
 *   node scripts/stitch-video.mjs docs/video/terminal-java.webm \
 *                                 docs/video/java-app-demo.webm \
 *                                 docs/video/java-quickstart.webm
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

const TRANSITION = 'zoomin';   // 0.6 s zoom crossfade
const VIEWPORT = { width: 1920, height: 1080, fps: 30 };

function probe(file) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate',
      '-show_entries', 'format=duration',
      '-of', 'json',
      file,
    ]);
    let out = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited ${code}`));
      try {
        const j = JSON.parse(out);
        resolve({
          duration: parseFloat(j.format.duration),
          width: j.streams[0].width,
          height: j.streams[0].height,
        });
      } catch (e) { reject(e); }
    });
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
}

export async function stitch(firstWebm, secondWebm, outWebm, transitionSeconds = 0.6) {
  if (!fs.existsSync(firstWebm)) throw new Error(`missing ${firstWebm}`);
  if (!fs.existsSync(secondWebm)) throw new Error(`missing ${secondWebm}`);

  const firstInfo = await probe(firstWebm);
  // Crossfade starts `transitionSeconds` before the first clip ends so the
  // second clip overlays the tail of the first.
  const offset = Math.max(0.1, firstInfo.duration - transitionSeconds);

  console.log(`> Stitching ${path.basename(firstWebm)} + ${path.basename(secondWebm)}`);
  console.log(`  first clip: ${firstInfo.duration.toFixed(2)}s  -> transition at ${offset.toFixed(2)}s (${TRANSITION}, ${transitionSeconds}s)`);

  fs.mkdirSync(path.dirname(outWebm), { recursive: true });
  // `settb=AVTB` + explicit `fps` resets the timebase/framerate metadata
  // that xfade requires (Playwright's webm outputs show r_frame_rate=1/0
  // after xfade's rate probe). Inputs are already 1920×1080 so no scale/pad
  // needed. VP8 (libvpx) matches the input codec and is far faster than
  // libvpx-vp9 on CPU.
  const filter = [
    `[0:v]settb=AVTB,fps=${VIEWPORT.fps},format=yuv420p[v0]`,
    `[1:v]settb=AVTB,fps=${VIEWPORT.fps},format=yuv420p[v1]`,
    `[v0][v1]xfade=transition=${TRANSITION}:duration=${transitionSeconds}:offset=${offset.toFixed(3)},format=yuv420p[v]`,
  ].join(';');

  await runFfmpeg([
    '-y', '-hide_banner', '-loglevel', 'error', '-stats',
    '-i', firstWebm,
    '-i', secondWebm,
    '-filter_complex', filter,
    '-map', '[v]',
    '-c:v', 'libvpx',
    '-pix_fmt', 'yuv420p',
    '-b:v', '1500k',
    '-deadline', 'realtime',
    '-cpu-used', '4',
    '-an',
    outWebm,
  ]);

  const { size } = fs.statSync(outWebm);
  console.log(`  wrote ${path.relative(REPO, outWebm)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  return outWebm;
}

async function main() {
  const [, , a, b, o, t] = process.argv;
  if (!a || !b || !o) {
    console.error('usage: stitch-video.mjs <first.webm> <second.webm> <out.webm> [transition-seconds]');
    process.exit(2);
  }
  await stitch(a, b, o, t ? Number(t) : 0.6);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

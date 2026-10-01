// Copies node icons (*.svg / *.png) into dist/nodes, mirroring the directory
// structure under nodes/. Replaces the former `gulp build:icons` task — gulp
// pulled a large, partly-vulnerable dependency tree just to copy two SVGs.
import { readdir, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = 'nodes';
const DEST = 'dist/nodes';

const entries = await readdir(SRC, { recursive: true, withFileTypes: true });
let copied = 0;
for (const entry of entries) {
  if (!entry.isFile() || !/\.(svg|png)$/i.test(entry.name)) continue;
  // Node >=20.12 exposes `parentPath`; older 20.x used `path`.
  const dir = entry.parentPath ?? entry.path;
  const rel = dir.slice(SRC.length).replace(/^[\\/]/, '');
  const targetDir = join(DEST, rel);
  await mkdir(targetDir, { recursive: true });
  await copyFile(join(dir, entry.name), join(targetDir, entry.name));
  copied++;
}
console.log(`copy-icons: copied ${copied} icon(s) into ${DEST}`);

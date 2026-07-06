// Unit tests for the download output-mode transforms (zip wrap / unzip).
// Uses the same jszip the node depends on.
const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');

test('wrap a single PDF into a zip', async () => {
  const pdf = Buffer.from('%PDF-1.4\n% fake\n', 'utf8');
  const zip = new JSZip();
  zip.file('sess-1.pdf', pdf);
  const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
  assert.equal(zipBuf[0], 0x50, 'zip magic byte 1');
  assert.equal(zipBuf[1], 0x4b, 'zip magic byte 2');

  const round = await JSZip.loadAsync(zipBuf);
  const entries = Object.values(round.files).filter((e) => !e.dir);
  assert.equal(entries.length, 1);
  const back = await entries[0].async('nodebuffer');
  assert.deepEqual(back, pdf);
});

test('unzip multi-file archive → one item per file', async () => {
  const zip = new JSZip();
  zip.file('contract.pdf', Buffer.from('%PDF-1.4\n contract \n'));
  zip.file('addendum.pdf', Buffer.from('%PDF-1.4\n addendum \n'));
  const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

  const parsed = await JSZip.loadAsync(zipBuf);
  const files = Object.values(parsed.files).filter((e) => !e.dir);
  assert.equal(files.length, 2);
  const names = files.map((f) => f.name).sort();
  assert.deepEqual(names, ['addendum.pdf', 'contract.pdf']);
});

test('unzip skips directories', async () => {
  const zip = new JSZip();
  zip.folder('signed/');
  zip.file('signed/doc.pdf', Buffer.from('%PDF-1.4'));
  const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

  const parsed = await JSZip.loadAsync(zipBuf);
  const files = Object.values(parsed.files).filter((e) => !e.dir);
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'signed/doc.pdf');
});

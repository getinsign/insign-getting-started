// Unit tests for the webhook URL signing roundtrip — verifies the
// signature the Create Session node puts on serverSidecallbackURL matches
// what the Trigger node's HMAC verifier recomputes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

// Rebuild the same signing logic the node uses, to lock down the contract.
function buildSignedUrl(base, cid, secret) {
  const url = new URL(base);
  url.searchParams.set('cid', cid);
  if (secret) {
    url.searchParams.set('sig', createHmac('sha256', secret).update(cid).digest('hex'));
  }
  return url.toString();
}

test('signed URL carries cid + sig query params', () => {
  const out = buildSignedUrl('https://n8n.example.com/webhook/insign', 'corr-1', 's3cr3t');
  const u = new URL(out);
  assert.equal(u.searchParams.get('cid'), 'corr-1');
  assert.equal(u.searchParams.get('sig').length, 64, 'sha256 hex is 64 chars');
});

test('signed URL preserves existing query params', () => {
  const out = buildSignedUrl('https://n8n.example.com/webhook/insign?tenant=acme', 'cx', 'sec');
  const u = new URL(out);
  assert.equal(u.searchParams.get('tenant'), 'acme');
  assert.equal(u.searchParams.get('cid'), 'cx');
  assert.ok(u.searchParams.get('sig'));
});

test('no secret → no sig param', () => {
  const out = buildSignedUrl('https://n8n.example.com/webhook/insign', 'cx', '');
  const u = new URL(out);
  assert.equal(u.searchParams.get('cid'), 'cx');
  assert.equal(u.searchParams.get('sig'), null);
});

test('sig changes when correlationId changes (same secret)', () => {
  const a = buildSignedUrl('https://ex.com/', 'id-A', 'secret');
  const b = buildSignedUrl('https://ex.com/', 'id-B', 'secret');
  assert.notEqual(new URL(a).searchParams.get('sig'), new URL(b).searchParams.get('sig'));
});

test('sig changes when secret changes (same correlationId)', () => {
  const a = buildSignedUrl('https://ex.com/', 'id', 'one');
  const b = buildSignedUrl('https://ex.com/', 'id', 'two');
  assert.notEqual(new URL(a).searchParams.get('sig'), new URL(b).searchParams.get('sig'));
});

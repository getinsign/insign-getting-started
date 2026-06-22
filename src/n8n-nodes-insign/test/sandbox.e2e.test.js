// End-to-end test against the public inSign sandbox.
// Covers every operation the node exposes (except Send Reminder and Download,
// which require a fully signed session and are smoke-checked separately).
//
// Runs with:  INSIGN_E2E=1 node --test test/sandbox.e2e.test.js
// Skipped in normal `npm test` so CI without network stays green.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const E2E = process.env.INSIGN_E2E === '1';
const BASE = process.env.INSIGN_BASE_URL || 'https://sandbox.test.getinsign.show';
const CLIENT_ID = process.env.INSIGN_CLIENT_ID || 'controller';
const CLIENT_SECRET = process.env.INSIGN_CLIENT_SECRET || 'pwd.insign.sandbox.4561';
const SAMPLE_PDF =
  process.env.INSIGN_SAMPLE_PDF ||
  path.resolve(__dirname, '..', '..', '..', 'docs', 'data', 'sample.pdf');

let cachedToken = null;
let cachedExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < cachedExpiresAt - 30_000) return cachedToken;
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  });
  if (!res.ok) throw new Error(`/oauth2/token → HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  cachedToken = body.access_token;
  cachedExpiresAt = Date.now() + (body.expires_in || 1800) * 1000;
  return cachedToken;
}

async function post(pathName, body, { raw = false } = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${pathName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': `e2e-${Date.now()}`,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${pathName} → HTTP ${res.status}: ${await res.text()}`);
  if (raw) return Buffer.from(await res.arrayBuffer());
  return res.json();
}

test('sandbox is reachable', { skip: !E2E }, async () => {
  const res = await fetch(`${BASE}/version`);
  assert.equal(res.ok, true, `GET /version failed: ${res.status}`);
});

test('oauth2 client_credentials grant returns an access_token', { skip: !E2E }, async () => {
  cachedToken = null; // force a fresh fetch for this test
  const token = await getToken();
  assert.ok(typeof token === 'string' && token.length > 20, 'expected a non-trivial access_token');
});

test('full session lifecycle', { skip: !E2E, timeout: 60000 }, async () => {
  assert.ok(fs.existsSync(SAMPLE_PDF), `sample PDF missing at ${SAMPLE_PDF}`);
  const base64 = fs.readFileSync(SAMPLE_PDF).toString('base64');

  // 1. Create session with document inlined as base64
  const docId = `e2e-doc-${Date.now()}`;
  const created = await post('/configure/session', {
    displayname: 'n8n E2E Test',
    foruser: `e2e-user-${Date.now()}`,
    documents: [{ id: docId, displayname: 'sample.pdf', file: base64, scanSigTags: true, allowFormEditing: true }],
    uploadEnabled: false,
  });
  assert.ok(created.sessionid, 'expected sessionid in response');
  const sessionid = created.sessionid;

  try {
    // 2. Full status
    const status = await post('/get/status', { sessionid });
    assert.ok(status, 'status returned empty');

    // 3. Lightweight status
    const check = await post('/get/checkstatus', { sessionid });
    assert.ok(check, 'checkstatus returned empty');

    // 4. Make extern, then abort it (round-trip the extern lifecycle)
    await post('/extern/beginmulti', {
      sessionid,
      externUsers: [{ realName: 'E2E Signer', recipient: 'e2e@example.invalid' }],
    });
    await post('/extern/abort', { sessionid });
  } finally {
    // 5. Purge (always, even on test failure)
    await post('/persistence/purge', { sessionid });
  }
});

test('credential test endpoint (GET /version)', { skip: !E2E }, async () => {
  const token = await getToken();
  const res = await fetch(`${BASE}/version`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.ok, true);
  const body = await res.text();
  assert.ok(body.length > 0, 'expected non-empty version payload');
});

test('send manual reminder', { skip: !E2E, timeout: 30000 }, async () => {
  const base64 = fs.readFileSync(SAMPLE_PDF).toString('base64');
  const created = await post('/configure/session', {
    displayname: 'n8n E2E Reminder',
    foruser: `e2e-rem-${Date.now()}`,
    documents: [{ id: `e2e-rem-doc-${Date.now()}`, displayname: 'sample.pdf', file: base64 }],
  });
  try {
    // Must be extern first for a reminder to have a target
    await post('/extern/beginmulti', {
      sessionid: created.sessionid,
      externUsers: [{ realName: 'Reminder Target', recipient: 'reminder@example.invalid' }],
    });
    const res = await post('/load/sendManualReminder', { sessionid: created.sessionid });
    assert.ok(res, 'expected a JSON response');
  } finally {
    await post('/persistence/purge', { sessionid: created.sessionid });
  }
});

test('download signed documents (on unsigned: returns source PDF or JSON error)', { skip: !E2E, timeout: 30000 }, async () => {
  const base64 = fs.readFileSync(SAMPLE_PDF).toString('base64');
  const created = await post('/configure/session', {
    displayname: 'n8n E2E Download',
    foruser: `e2e-dl-${Date.now()}`,
    documents: [{ id: `e2e-dl-doc-${Date.now()}`, displayname: 'sample.pdf', file: base64 }],
  });
  try {
    // Session is unsigned, so the sandbox either returns the source PDF or
    // a structured error. Both are valid - just assert we got a response
    // and that the node's arraybuffer handling path would work.
    const token = await getToken();
    const res = await fetch(`${BASE}/get/documents/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionid: created.sessionid }),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 0, 'expected non-empty response body');
    const isPdf = buf.slice(0, 4).toString() === '%PDF';
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // PK
    const isJson = buf[0] === 0x7b || buf[0] === 0x5b; // { or [
    assert.ok(isPdf || isZip || isJson, `expected PDF/ZIP/JSON, got prefix: ${buf.slice(0, 16).toString('hex')}`);
  } finally {
    await post('/persistence/purge', { sessionid: created.sessionid });
  }
});

test('audit trail returns JSON events', { skip: !E2E, timeout: 30000 }, async () => {
  const base64 = fs.readFileSync(SAMPLE_PDF).toString('base64');
  const created = await post('/configure/session', {
    displayname: 'n8n E2E Audit',
    foruser: `e2e-audit-${Date.now()}`,
    documents: [{ id: `e2e-audit-doc-${Date.now()}`, displayname: 'sample.pdf', file: base64 }],
  });
  try {
    const audit = await post('/get/audit', { sessionid: created.sessionid });
    assert.ok(Array.isArray(audit) || typeof audit === 'object', 'audit response should be JSON');
  } finally {
    await post('/persistence/purge', { sessionid: created.sessionid });
  }
});

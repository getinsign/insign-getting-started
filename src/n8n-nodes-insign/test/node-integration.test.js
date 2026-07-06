// Integration tests that drive the actual Insign.execute() code path against
// the public inSign sandbox, using a hand-rolled IExecuteFunctions mock. This
// verifies parameter handling, body construction, binary flow, and output
// shaping — not just raw HTTP contract.
//
// Run:  INSIGN_E2E=1 node --test test/node-integration.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');

const { Insign } = require('../dist/nodes/Insign/Insign.node');

const E2E = process.env.INSIGN_E2E === '1';
const BASE = (process.env.INSIGN_BASE_URL || 'https://sandbox.test.getinsign.show').replace(/\/+$/, '');
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

// Minimal IExecuteFunctions mock. Only implements what the node actually uses.
function makeCtx({ params = {}, binaries = {} } = {}) {
  const node = { name: 'inSign-test', type: 'insign', typeVersion: 1, id: 'test' };
  const items = [{ json: {}, binary: binaries }];
  return {
    getInputData: () => items,
    getNode: () => node,
    continueOnFail: () => false,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    getCredentials: async () => ({ baseUrl: BASE, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
    getNodeParameter: (name, _i, fallback) => {
      if (name in params) return params[name];
      if (fallback !== undefined) return fallback;
      throw new Error(`missing param ${name}`);
    },
    helpers: {
      httpRequest: async function (options) {
        const res = await fetch(options.url, {
          method: options.method,
          headers: options.headers,
          body: options.body !== undefined ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
        });
        if (!res.ok) {
          const txt = await res.text();
          const err = new Error(`${options.method} ${options.url} → HTTP ${res.status}: ${txt}`);
          err.response = { status: res.status, body: txt };
          throw err;
        }
        if (options.encoding === 'arraybuffer') {
          const ab = await res.arrayBuffer();
          const hdrs = {};
          res.headers.forEach((v, k) => (hdrs[k] = v));
          return { body: ab, headers: hdrs, statusCode: res.status };
        }
        return res.json();
      },
      assertBinaryData: (_i, prop) => {
        const b = items[0].binary[prop];
        if (!b) throw new Error(`no binary property '${prop}'`);
        return b;
      },
      getBinaryDataBuffer: async (_i, prop) => Buffer.from(items[0].binary[prop]._buffer),
      prepareBinaryData: async (buf, fileName, mimeType) => ({
        mimeType,
        fileName,
        data: Buffer.from(buf).toString('base64'),
        _buffer: Buffer.from(buf),
      }),
    },
  };
}

async function runNode(params, binaries) {
  const node = new Insign();
  const ctx = makeCtx({ params, binaries });
  const out = await node.execute.call(ctx);
  return out[0];
}

function baseCreateParams(extra = {}) {
  return {
    operation: 'createSession',
    displayName: 'n8n node-integration',
    binaryPropertyName: 'data',
    documentDisplayName: 'sample.pdf',
    scanSigTags: true,
    allowFormEditing: true,
    uploadEnabled: false,
    forUser: '',
    userFullName: '',
    // all the prominent toggles have a default, supply falsy
    workflowFinishAfterLastSign: false,
    externCompleteOnFinish: false,
    externSendDocsOnFinishCustomer: false,
    documentEmailDownload: false,
    skipFinishModal: false,
    skipFinishModalExtern: false,
    externUserGuidance: true,
    gdprPopupActive: false,
    privacyLink: '',
    imprintLink: '',
    externalPropertiesURL: '',
    correlationId: '',
    serverSidecallbackURL: '',
    additionalFields: '{}',
    requestOptions: {},
    ...extra,
  };
}

function pdfBinary() {
  const buf = fs.readFileSync(SAMPLE_PDF);
  return { data: { mimeType: 'application/pdf', fileName: 'sample.pdf', _buffer: buf } };
}

test('node: create session via execute()', { skip: !E2E, timeout: 30000 }, async () => {
  const [item] = await runNode(baseCreateParams(), pdfBinary());
  assert.ok(item.json.sessionid, 'expected sessionid from node');
  try {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: item.json.sessionid });
  } catch {
    /* best effort */
  }
});

test('node: create session with prominent toggles + links', { skip: !E2E, timeout: 30000 }, async () => {
  const [item] = await runNode(
    baseCreateParams({
      workflowFinishAfterLastSign: true,
      externCompleteOnFinish: true,
      externSendDocsOnFinishCustomer: true,
      documentEmailDownload: true,
      skipFinishModal: true,
      skipFinishModalExtern: true,
      gdprPopupActive: true,
      privacyLink: 'https://example.com/privacy',
      imprintLink: 'https://example.com/imprint',
      externalPropertiesURL: 'https://example.com/branding.css',
    }),
    pdfBinary(),
  );
  const sid = item.json.sessionid;
  assert.ok(sid, 'expected sessionid');
  try {
    const [statusItem] = await runNode({ ...baseCreateParams(), operation: 'getStatus', sessionId: sid });
    assert.ok(statusItem.json, 'getStatus returned empty');
  } finally {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
  }
});

test('node: additionalFields JSON is merged into body', { skip: !E2E, timeout: 30000 }, async () => {
  const marker = `MergedCustomer-${Date.now()}`;
  const [item] = await runNode(
    baseCreateParams({
      additionalFields: JSON.stringify({ displaycustomer: marker }),
    }),
    pdfBinary(),
  );
  const sid = item.json.sessionid;
  try {
    const [status] = await runNode({ ...baseCreateParams(), operation: 'getStatus', sessionId: sid });
    assert.equal(status.json.displaycustomer, marker, 'additionalFields.displaycustomer should round-trip');
  } finally {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
  }
});

test('node: makeExtern + abortExtern', { skip: !E2E, timeout: 30000 }, async () => {
  const [created] = await runNode(baseCreateParams(), pdfBinary());
  const sid = created.json.sessionid;
  try {
    await runNode({
      ...baseCreateParams(),
      operation: 'makeExtern',
      sessionId: sid,
      externUsers: { user: [{ realName: 'Node Test', recipient: 'ext@example.invalid' }] },
      additionalFields: '{}',
    });
    await runNode({ ...baseCreateParams(), operation: 'abortExtern', sessionId: sid });
  } finally {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
  }
});

test('node: getAudit returns JSON events wrapped by the node', { skip: !E2E, timeout: 30000 }, async () => {
  const [created] = await runNode(baseCreateParams(), pdfBinary());
  const sid = created.json.sessionid;
  try {
    const [audit] = await runNode({ ...baseCreateParams(), operation: 'getAudit', sessionId: sid });
    assert.ok('events' in audit.json || Array.isArray(audit.json), 'expected audit events array or wrapper');
  } finally {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
  }
});

test('node: download (mode=auto) produces a binary attachment', { skip: !E2E, timeout: 30000 }, async () => {
  const [created] = await runNode(baseCreateParams(), pdfBinary());
  const sid = created.json.sessionid;
  try {
    const [dl] = await runNode({
      ...baseCreateParams(),
      operation: 'download',
      sessionId: sid,
      downloadOutputMode: 'auto',
      outputBinaryProperty: 'data',
    });
    assert.ok(dl.binary?.data, 'expected binary.data on output');
    assert.ok(['application/pdf', 'application/zip'].includes(dl.binary.data.mimeType));
  } finally {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
  }
});

test('node: download (mode=zip) wraps PDF into a one-file ZIP', { skip: !E2E, timeout: 30000 }, async () => {
  const [created] = await runNode(baseCreateParams(), pdfBinary());
  const sid = created.json.sessionid;
  try {
    const [dl] = await runNode({
      ...baseCreateParams(),
      operation: 'download',
      sessionId: sid,
      downloadOutputMode: 'zip',
      outputBinaryProperty: 'data',
    });
    assert.equal(dl.binary.data.mimeType, 'application/zip');
    const zip = await JSZip.loadAsync(dl.binary.data._buffer);
    const files = Object.values(zip.files).filter((f) => !f.dir);
    assert.ok(files.length >= 1, 'zip should contain at least one file');
  } finally {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
  }
});

test('node: create session accepts correlationId + webhook URL (inSign stores customInfo server-side)', { skip: !E2E, timeout: 30000 }, async () => {
  const cid = `int-${Date.now()}`;
  const [item] = await runNode(
    baseCreateParams({
      correlationId: cid,
      serverSidecallbackURL: 'https://example.com/insign-hook',
    }),
    pdfBinary(),
  );
  const sid = item.json.sessionid;
  assert.ok(sid, 'expected sessionid from node');
  // customInfo is stored on the session server-side but not echoed in /get/status.
  // The URL-signing round-trip is covered by the unit test in url-signing.test.js.
  await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
});

test('node: download (mode=files) emits one item per document', { skip: !E2E, timeout: 30000 }, async () => {
  const [created] = await runNode(baseCreateParams(), pdfBinary());
  const sid = created.json.sessionid;
  try {
    const items = await runNode({
      ...baseCreateParams(),
      operation: 'download',
      sessionId: sid,
      downloadOutputMode: 'files',
      outputBinaryProperty: 'data',
    });
    assert.ok(items.length >= 1, 'expected at least one file item');
    for (const it of items) {
      assert.ok(it.binary?.data, 'each item should have binary.data');
      assert.ok(it.json.fileName, 'each item should carry fileName in json');
    }
  } finally {
    await runNode({ ...baseCreateParams(), operation: 'purge', sessionId: sid });
  }
});

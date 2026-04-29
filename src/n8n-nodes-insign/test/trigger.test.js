// Unit test for the InsignTrigger webhook handler. Exercises the filter +
// extraction logic without booting n8n by passing a mock IWebhookFunctions.
const test = require('node:test');
const assert = require('node:assert/strict');

const { InsignTrigger } = require('../dist/nodes/InsignTrigger/InsignTrigger.node');

function mockCtx({ body = {}, headers = {}, query = {}, params = {}, credential = null, res } = {}) {
  let statusCode;
  let sent;
  return {
    getBodyData: () => body,
    getHeaderData: () => headers,
    getQueryData: () => query,
    getNodeParameter: (name, fallback) => (params[name] !== undefined ? params[name] : fallback),
    getCredentials: async () => {
      if (!credential) throw new Error('no credential');
      return credential;
    },
    getResponseObject: () =>
      res ?? {
        status(code) { statusCode = code; return this; },
        send(body) { sent = body; return this; },
        _peek: () => ({ statusCode, sent }),
      },
  };
}

async function runWebhook(ctx) {
  const node = new InsignTrigger();
  return node.webhook.call(ctx);
}

test('trigger: emits every field for an unfiltered callback', async () => {
  const body = { eventid: 'SESSION_FINISHED', sessionid: 'abc', data: { foo: 'bar' } };
  const res = await runWebhook(mockCtx({ body }));
  assert.equal(res.workflowData.length, 1);
  const item = res.workflowData[0][0].json;
  assert.equal(item.eventid, 'SESSION_FINISHED');
  assert.equal(item.sessionid, 'abc');
  assert.deepEqual(item.data, { foo: 'bar' });
  assert.deepEqual(item.raw, body);
  assert.ok(item.receivedAt, 'receivedAt should be set');
});

test('trigger: event filter drops non-matching events', async () => {
  const body = { eventid: 'SESSION_STARTED', sessionid: 'abc' };
  const res = await runWebhook(
    mockCtx({ body, params: { eventIdFilter: 'SESSION_FINISHED,SESSION_EXPIRED' } }),
  );
  assert.deepEqual(res.workflowData, [[]], 'expected no items emitted');
});

test('trigger: event filter passes matching events', async () => {
  const body = { eventid: 'SESSION_FINISHED', sessionid: 'abc' };
  const res = await runWebhook(
    mockCtx({ body, params: { eventIdFilter: 'SESSION_FINISHED,SESSION_EXPIRED' } }),
  );
  assert.equal(res.workflowData[0].length, 1);
});

test('trigger: session filter drops non-matching session', async () => {
  const body = { eventid: 'X', sessionid: 'wrong' };
  const res = await runWebhook(mockCtx({ body, params: { sessionIdFilter: 'right' } }));
  assert.deepEqual(res.workflowData, [[]]);
});

test('trigger: tolerates missing eventid/sessionid (emits nulls)', async () => {
  const body = { some: 'other-payload' };
  const res = await runWebhook(mockCtx({ body }));
  const item = res.workflowData[0][0].json;
  assert.equal(item.eventid, null);
  assert.equal(item.sessionid, null);
  assert.equal(item.data, null);
});

test('trigger: falls back to camelCase (eventId/sessionId) fields', async () => {
  const body = { eventId: 'X', sessionId: 'y', data: 'ok' };
  const res = await runWebhook(mockCtx({ body }));
  const item = res.workflowData[0][0].json;
  assert.equal(item.eventid, 'X');
  assert.equal(item.sessionid, 'y');
});

// ── HMAC verification ───────────────────────────────────────────────────
const { createHmac } = require('node:crypto');
function sign(secret, cid) {
  return createHmac('sha256', secret).update(cid).digest('hex');
}

test('trigger: rejects calls with missing sig when secret is configured', async () => {
  let statusCode;
  const res = { status(c) { statusCode = c; return this; }, send() { return this; } };
  const out = await runWebhook(
    mockCtx({
      body: { eventid: 'X', sessionid: 's' },
      query: { cid: 'my-corr-id' },
      credential: { webhookSecret: 'super-secret' },
      res,
    }),
  );
  assert.equal(statusCode, 403);
  assert.deepEqual(out, { noWebhookResponse: true });
});

test('trigger: rejects calls with wrong sig', async () => {
  let statusCode;
  const res = { status(c) { statusCode = c; return this; }, send() { return this; } };
  const out = await runWebhook(
    mockCtx({
      body: { eventid: 'X', sessionid: 's' },
      query: { cid: 'id1', sig: 'deadbeef'.repeat(8) },
      credential: { webhookSecret: 'secret' },
      res,
    }),
  );
  assert.equal(statusCode, 403);
  assert.deepEqual(out, { noWebhookResponse: true });
});

test('trigger: accepts calls with correct sig', async () => {
  const cid = 'correlation-42';
  const secret = 'shared-s3cret';
  const out = await runWebhook(
    mockCtx({
      body: { eventid: 'VORGANGABGESCHLOSSEN', sessionid: 's-abc' },
      query: { cid, sig: sign(secret, cid) },
      credential: { webhookSecret: secret },
    }),
  );
  assert.equal(out.workflowData[0].length, 1);
  assert.equal(out.workflowData[0][0].json.correlationId, cid);
});

test('trigger: verifyHmac=false bypasses signature check', async () => {
  const out = await runWebhook(
    mockCtx({
      body: { eventid: 'X', sessionid: 's' },
      query: { cid: 'anything', sig: 'garbage' },
      credential: { webhookSecret: 'secret' },
      params: { verifyHmac: false },
    }),
  );
  assert.equal(out.workflowData[0].length, 1);
});

test('trigger: no credential/secret → verification skipped gracefully', async () => {
  const out = await runWebhook(
    mockCtx({
      body: { eventid: 'X', sessionid: 's' },
      query: {},
      // no credential provided
    }),
  );
  assert.equal(out.workflowData[0].length, 1);
});

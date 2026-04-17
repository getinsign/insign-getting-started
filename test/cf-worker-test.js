#!/usr/bin/env node
/**
 * Integration tests for the Cloudflare Worker (CORS Proxy + Webhook Relay)
 * Usage:
 *   node test/cf-worker-test.js              - starts local harness, tests against it
 *   node test/cf-worker-test.js <worker-url> - tests against a remote worker
 */

var childProcess = require('child_process');
var path = require('path');

var REMOTE_URL = process.argv[2] || null;
var LOCAL_PORT = 8787;
var WORKER_URL = REMOTE_URL || ('http://localhost:' + LOCAL_PORT);
var localServer = null;
var pass = 0, fail = 0, errors = [];

async function test(name, fn) {
    try {
        await fn();
        pass++;
        console.log('  PASS  ' + name);
    } catch (e) {
        fail++;
        errors.push({ name: name, error: e.message || e });
        console.log('  FAIL  ' + name + ' - ' + (e.message || e));
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) throw new Error((msg || '') + ' expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
}

async function fetchJSON(url, opts) {
    var res = await fetch(url, opts);
    var body = await res.text();
    return { status: res.status, headers: res.headers, body: body, json: function() { return JSON.parse(body); } };
}

async function run() {
    console.log('Testing worker at: ' + WORKER_URL + '\n');

    // =========================================================================
    // 1. Root endpoint - info
    // =========================================================================
    console.log('--- Root Endpoint ---');
    await test('GET / returns info JSON', async function() {
        var res = await fetchJSON(WORKER_URL + '/');
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assert(data.info, 'should have info field');
        assert(data.usage, 'should have usage field');
    });

    await test('GET / has CORS headers', async function() {
        var res = await fetchJSON(WORKER_URL + '/');
        assertEqual(res.headers.get('access-control-allow-origin'), '*', 'ACAO');
    });

    // =========================================================================
    // 2. OPTIONS preflight
    // =========================================================================
    console.log('\n--- CORS Preflight ---');
    await test('OPTIONS / returns 204 with CORS headers', async function() {
        var res = await fetch(WORKER_URL + '/', { method: 'OPTIONS' });
        assertEqual(res.status, 204, 'status');
        assertEqual(res.headers.get('access-control-allow-origin'), '*', 'ACAO');
        assert(res.headers.get('access-control-allow-methods'), 'should have allow-methods');
    });

    // =========================================================================
    // 3. Webhook relay - channel lifecycle
    // =========================================================================
    console.log('\n--- Webhook Relay ---');
    var channelId, channelUrl, pollUrl;

    await test('POST /channel/new creates a channel', async function() {
        var res = await fetchJSON(WORKER_URL + '/channel/new', { method: 'POST' });
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assert(data.id, 'should have id');
        assert(data.url, 'should have url');
        assert(data.pollUrl, 'should have pollUrl');
        channelId = data.id;
        channelUrl = data.url;
        pollUrl = data.pollUrl;
        console.log('        channel: ' + channelId);
    });

    await test('GET /channel/{id}/requests returns empty initially', async function() {
        var res = await fetchJSON(pollUrl);
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assert(Array.isArray(data.data), 'data should be array');
        assertEqual(data.total, 0, 'total');
    });

    await test('POST /channel/{id} stores a webhook callback', async function() {
        var payload = JSON.stringify({ event: 'session.completed', sessionId: 'test-123' });
        var res = await fetchJSON(channelUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assert(data.ok, 'should be ok');
        assert(data.requestId, 'should have requestId');
    });

    await test('GET /channel/{id}/requests returns the stored callback', async function() {
        var res = await fetchJSON(pollUrl);
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assertEqual(data.total, 1, 'total');
        var entry = data.data[0];
        assertEqual(entry.method, 'POST', 'method');
        assert(entry.timestamp, 'should have timestamp');
        assert(entry.id, 'should have id');
        var body = JSON.parse(entry.body);
        assertEqual(body.event, 'session.completed', 'body.event');
        assertEqual(body.sessionId, 'test-123', 'body.sessionId');
    });

    await test('POST multiple callbacks and poll returns all', async function() {
        await fetch(channelUrl, { method: 'POST', body: 'callback-2' });
        await fetch(channelUrl, { method: 'POST', body: 'callback-3' });
        var res = await fetchJSON(pollUrl);
        var data = res.json();
        assertEqual(data.total, 3, 'total');
    });

    await test('GET /channel/{id}/requests?since= filters by timestamp', async function() {
        var res1 = await fetchJSON(pollUrl);
        var allData = res1.json();
        // Use the timestamp of the second entry as "since" - should return only entries after it
        var since = allData.data[1].timestamp;
        var res2 = await fetchJSON(pollUrl + '?since=' + encodeURIComponent(since));
        var filtered = res2.json();
        assertEqual(filtered.total, 1, 'should have 1 entry after since filter');
    });

    await test('POST to non-existent channel auto-creates it', async function() {
        var fakeChannel = WORKER_URL + '/channel/nonexistent999';
        var res = await fetchJSON(fakeChannel, { method: 'POST', body: 'test' });
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assert(data.ok, 'should be ok');
    });

    await test('DELETE /channel/{id} removes channel', async function() {
        var res = await fetchJSON(channelUrl, { method: 'DELETE' });
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assert(data.ok, 'should be ok');
    });

    await test('GET after DELETE returns empty (may need cache propagation)', async function() {
        // Allow a brief wait for cross-isolate cache deletion to propagate
        await new Promise(function(r) { setTimeout(r, 1500); });
        var res = await fetchJSON(pollUrl);
        var data = res.json();
        assertEqual(data.total, 0, 'total after delete');
    });

    // =========================================================================
    // 4. CORS Proxy (via httpbin.org)
    // =========================================================================
    console.log('\n--- CORS Proxy ---');
    await test('GET /?<url> proxies to target (httpbin)', async function() {
        var target = 'https://httpbin.org/get?foo=bar';
        var res = await fetchJSON(WORKER_URL + '/?' + encodeURIComponent(target));
        assertEqual(res.status, 200, 'status');
        assertEqual(res.headers.get('access-control-allow-origin'), '*', 'CORS header');
        var data = res.json();
        assert(data.args, 'should have args from httpbin');
        assertEqual(data.args.foo, 'bar', 'args.foo');
    });

    await test('POST /?<url> proxies POST body to target', async function() {
        var target = 'https://httpbin.org/post';
        var payload = JSON.stringify({ test: 'proxy-post' });
        var res = await fetchJSON(WORKER_URL + '/?' + encodeURIComponent(target), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        var sent = JSON.parse(data.data);
        assertEqual(sent.test, 'proxy-post', 'proxied body');
    });

    await test('Proxy with non-encoded URL also works', async function() {
        var res = await fetchJSON(WORKER_URL + '/?https://httpbin.org/get?test=raw');
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assertEqual(data.args.test, 'raw', 'args.test');
    });

    await test('Proxy to invalid URL returns error status', async function() {
        var res = await fetch(WORKER_URL + '/?https://thisdomaindoesnotexist.invalid/test');
        assert(res.status >= 400, 'should be error status (4xx/5xx), got ' + res.status);
    });

    // =========================================================================
    // 5. Edge cases / 404
    // =========================================================================
    console.log('\n--- Edge Cases ---');
    await test('GET /unknown returns 404 or info', async function() {
        var res = await fetchJSON(WORKER_URL + '/unknown');
        // /unknown doesn't match /channel/{id} pattern, so it returns info
        assertEqual(res.status, 200, 'status');
        var data = res.json();
        assert(data.info || data.error, 'should have info or error');
    });

    await test('GET /channel/{id}/unknown returns 404', async function() {
        var res = await fetchJSON(WORKER_URL + '/channel/abc123/unknown');
        assertEqual(res.status, 404, 'status');
    });

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n========================================');
    console.log('Results: ' + pass + ' passed, ' + fail + ' failed');
    if (errors.length > 0) {
        console.log('\nFailures:');
        errors.forEach(function(e) { console.log('  - ' + e.name + ': ' + e.error); });
    }
    console.log('========================================');
}

async function startLocal() {
    return new Promise(function(resolve, reject) {
        var harness = path.join(__dirname, 'cf-worker-local.js');
        localServer = childProcess.spawn(process.execPath, [harness, String(LOCAL_PORT)], {
            stdio: ['ignore', 'pipe', 'inherit']
        });
        localServer.stdout.on('data', function(data) {
            var msg = data.toString();
            if (msg.indexOf('running on') !== -1) resolve();
        });
        localServer.on('error', reject);
        localServer.on('exit', function(code) {
            if (code) reject(new Error('Harness exited with code ' + code));
        });
        setTimeout(function() { reject(new Error('Harness startup timeout')); }, 5000);
    });
}

function stopLocal() {
    if (localServer) {
        localServer.kill();
        localServer = null;
    }
}

(async function() {
    try {
        if (!REMOTE_URL) {
            console.log('Starting local worker harness on port ' + LOCAL_PORT + '...');
            await startLocal();
        }
        await run();
    } catch (e) {
        console.error('Fatal: ' + e);
        process.exitCode = 2;
    } finally {
        stopLocal();
        process.exit(pass > 0 && fail === 0 ? 0 : 1);
    }
})();

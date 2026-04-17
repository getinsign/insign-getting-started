/**
 * Cloudflare Worker - CORS Proxy + Webhook Relay for inSign API Explorer
 *
 * Deploy this script to Cloudflare Workers (free tier, no credit card).
 * It serves two purposes:
 *   1. CORS Proxy - forwards API requests and adds CORS headers (replaces local cors-proxy.js)
 *   2. Webhook Relay - receives inSign callbacks and lets your browser poll for them
 *
 * SETUP:
 *   1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create
 *   2. Click "Create Worker", give it a name, click "Deploy"
 *   3. Click "Edit Code", select all, paste this script, click "Deploy"
 *   4. Copy the worker URL (e.g. https://my-relay.username.workers.dev)
 *   5. In the API Explorer, set this URL as both CORS proxy and webhook provider
 *
 * CORS PROXY:
 *   GET/POST/etc /?https://target.com/api/path  - proxies the request to the target URL
 *   Same URL pattern as the local cors-proxy.js, so it's a drop-in replacement.
 *
 * WEBHOOK RELAY:
 *   POST /channel/{id}          - inSign posts callbacks here (the webhook URL)
 *   GET  /channel/{id}/requests - browser polls for stored requests
 *   POST /channel/new           - browser creates a new channel
 *   DELETE /channel/{id}        - cleanup
 *
 * Each webhook entry is stored as an individual cache key to avoid
 * read-modify-write conflicts across isolates. A channel index tracks
 * the list of entry IDs.
 * Logs are visible in the CF dashboard under Workers -> Logs -> Real-time.
 */

// In-memory fast path (instant when POST and poll hit same isolate)
var channels = {};

// Cache key prefixes
var CH_PREFIX = 'https://webhook-cache.internal/ch/';
var ENTRY_PREFIX = 'https://webhook-cache.internal/entry/';

var CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-max-age': '86400'
};

function addCorsHeaders(headers) {
    var result = {};
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i].toLowerCase();
        if (k.indexOf('access-control-') !== 0) {
            result[k] = headers[keys[i]];
        }
    }
    var corsKeys = Object.keys(CORS_HEADERS);
    for (var j = 0; j < corsKeys.length; j++) {
        result[corsKeys[j]] = CORS_HEADERS[corsKeys[j]];
    }
    return result;
}

function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: addCorsHeaders({ 'content-type': 'application/json' })
    });
}

// --- Storage: individual cache entries + in-memory ---

async function cacheGet(key) {
    try {
        var resp = await caches.default.match(key);
        if (resp) return await resp.json();
    } catch (e) { /* ignore */ }
    return null;
}

async function cachePut(key, data) {
    try {
        await caches.default.put(key, new Response(JSON.stringify(data), {
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' }
        }));
    } catch (e) {
        console.log('[cachePut] error:', e.message);
    }
}

async function cacheDel(key) {
    try { await caches.default.delete(key); } catch (e) { /* ignore */ }
}

// Append a single entry - no read-modify-write of the full array
async function appendEntry(channelId, entry) {
    // In-memory
    if (!channels[channelId]) channels[channelId] = [];
    channels[channelId].push(entry);
    if (channels[channelId].length > 200) {
        channels[channelId] = channels[channelId].slice(-200);
    }

    // Cache: store entry individually
    await cachePut(ENTRY_PREFIX + entry.id, entry);

    // Cache: update index (list of entry IDs + timestamps)
    var index = (await cacheGet(CH_PREFIX + channelId)) || [];
    index.push({ id: entry.id, ts: entry.timestamp });
    if (index.length > 200) index = index.slice(-200);
    await cachePut(CH_PREFIX + channelId, index);

    console.log('[appendEntry] ch=' + channelId + ' id=' + entry.id + ' index=' + index.length);
}

// Load all entries for a channel
async function loadChannel(channelId) {
    // In-memory first
    var mem = channels[channelId];
    if (mem && mem.length > 0) {
        console.log('[loadChannel] ch=' + channelId + ' from mem: ' + mem.length);
        return mem;
    }

    // Cache: read index, then fetch each entry
    var index = await cacheGet(CH_PREFIX + channelId);
    if (!index || index.length === 0) {
        console.log('[loadChannel] ch=' + channelId + ' empty');
        return [];
    }

    var entries = [];
    for (var i = 0; i < index.length; i++) {
        var entry = await cacheGet(ENTRY_PREFIX + index[i].id);
        if (entry) entries.push(entry);
    }

    // Populate in-memory for fast subsequent reads on this isolate
    if (entries.length > 0) channels[channelId] = entries;

    console.log('[loadChannel] ch=' + channelId + ' from cache: index=' + index.length + ' resolved=' + entries.length);
    return entries;
}

async function createChannel(channelId) {
    channels[channelId] = [];
    await cachePut(CH_PREFIX + channelId, []);
    console.log('[createChannel] ch=' + channelId);
}

async function deleteChannel(channelId) {
    // Delete all cached entries
    var index = (await cacheGet(CH_PREFIX + channelId)) || [];
    for (var i = 0; i < index.length; i++) {
        await cacheDel(ENTRY_PREFIX + index[i].id);
    }
    await cacheDel(CH_PREFIX + channelId);
    delete channels[channelId];
    console.log('[deleteChannel] ch=' + channelId + ' entries=' + index.length);
}

// --- CORS Proxy ---

async function handleProxy(request, targetUrl) {
    console.log('[proxy] ' + request.method + ' -> ' + targetUrl);
    var fwdHeaders = {};
    var skipHeaders = { 'host': 1, 'origin': 1, 'referer': 1, 'connection': 1 };
    var entries = Array.from(request.headers.entries());
    for (var i = 0; i < entries.length; i++) {
        if (!skipHeaders[entries[i][0]]) {
            fwdHeaders[entries[i][0]] = entries[i][1];
        }
    }

    var body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.arrayBuffer();
    }

    var resp;
    try {
        resp = await fetch(targetUrl, {
            method: request.method,
            headers: fwdHeaders,
            body: body
        });
    } catch (e) {
        console.log('[proxy] error:', e.message);
        return new Response('Proxy error: ' + e.message, {
            status: 502,
            headers: addCorsHeaders({ 'content-type': 'text/plain' })
        });
    }

    console.log('[proxy] response: ' + resp.status);
    var respHeaders = {};
    var respEntries = Array.from(resp.headers.entries());
    for (var k = 0; k < respEntries.length; k++) {
        respHeaders[respEntries[k][0]] = respEntries[k][1];
    }

    return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: addCorsHeaders(respHeaders)
    });
}

// --- Main request handler ---

async function handleRequest(request) {
    var url = new URL(request.url);
    var path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // CORS Proxy: /?https://target.com/path
    var rawUrl = request.url;
    var qIdx = rawUrl.indexOf('?');
    if (qIdx >= 0 && path === '/') {
        var raw = rawUrl.substring(qIdx + 1);
        var targetUrl;
        try { targetUrl = decodeURIComponent(raw); } catch (e) { targetUrl = raw; }
        if (targetUrl.indexOf('http://') === 0 || targetUrl.indexOf('https://') === 0) {
            return handleProxy(request, targetUrl);
        }
    }

    // POST /channel/new - create a new channel
    if (request.method === 'POST' && path === '/channel/new') {
        var id = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
        await createChannel(id);
        var channelUrl = url.origin + '/channel/' + id;
        return jsonResponse({ id: id, url: channelUrl, pollUrl: channelUrl + '/requests' });
    }

    // Match /channel/{id}...
    var match = path.match(/^\/channel\/([a-z0-9]+)(\/.*)?$/i);
    if (!match) {
        return jsonResponse({
            info: 'inSign CORS Proxy + Webhook Relay Worker',
            usage: 'Proxy: /?https://target/path  |  Webhooks: POST /channel/new'
        });
    }

    var channelId = match[1];
    var sub = match[2] || '';

    // POST /channel/{id} - receive a webhook callback
    if (request.method === 'POST' && !sub) {
        console.log('[webhook] POST ch=' + channelId);

        var body = '';
        try { body = await request.text(); } catch (e) { /* empty */ }

        var headers = {};
        var hEntries = Array.from(request.headers.entries());
        for (var h = 0; h < hEntries.length; h++) {
            headers[hEntries[h][0]] = hEntries[h][1];
        }

        var entry = {
            id: crypto.randomUUID(),
            method: request.method,
            timestamp: new Date().toISOString(),
            content_type: request.headers.get('content-type') || '',
            body: body,
            headers: headers
        };

        // Append only - no read-modify-write of entire channel
        await appendEntry(channelId, entry);

        return jsonResponse({ ok: true, requestId: entry.id });
    }

    // GET /channel/{id}/requests - poll for stored requests
    if (request.method === 'GET' && sub === '/requests') {
        var since = url.searchParams.get('since');
        var q = await loadChannel(channelId);

        var data = q;
        if (since) {
            var sinceTime = new Date(since).getTime();
            data = q.filter(function(r) { return new Date(r.timestamp).getTime() > sinceTime; });
        }

        console.log('[requests] ch=' + channelId + ' total=' + data.length + (since ? ' since=' + since : ''));
        return jsonResponse({ data: data, total: data.length });
    }

    // DELETE /channel/{id} - cleanup
    if (request.method === 'DELETE' && !sub) {
        await deleteChannel(channelId);
        return jsonResponse({ ok: true, msg: 'Channel deleted' });
    }

    return jsonResponse({ error: 'Not found' }, 404);
}

addEventListener('fetch', function(event) {
    event.respondWith(handleRequest(event.request));
});

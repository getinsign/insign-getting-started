#!/usr/bin/env node
/**
 * Local Node.js harness for cf-webhook-worker.js
 * Emulates the CF Worker runtime (addEventListener, caches, Response, etc.)
 * so the exact same worker script runs locally for testing.
 *
 * Usage: node test/cf-worker-local.js [port]
 * Starts an HTTP server on localhost:<port> (default 8787).
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { ReadableStream, WritableStream, TransformStream } = require('stream/web');
var { TextEncoder, TextDecoder } = require('util');

var PORT = parseInt(process.argv[2] || '8787', 10);

// --- CF Worker runtime shims ---

// In-memory cache (single process = single "isolate", no propagation issues)
var cacheStore = {};
var cachesShim = {
    default: {
        match: function(key) {
            var entry = cacheStore[key];
            if (!entry) return Promise.resolve(undefined);
            // Return a fresh Response clone each time
            return Promise.resolve(new Response(entry.body, { headers: entry.headers }));
        },
        put: function(key, response) {
            return response.text().then(function(body) {
                var headers = {};
                response.headers.forEach(function(v, k) { headers[k] = v; });
                cacheStore[key] = { body: body, headers: headers };
            });
        },
        delete: function(key) {
            delete cacheStore[key];
            return Promise.resolve(true);
        }
    }
};

// Shim crypto.randomUUID if not available
if (!crypto.randomUUID) {
    crypto.randomUUID = function() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
            return (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16);
        });
    };
}

// --- Load and execute the worker script ---

var workerPath = path.join(__dirname, '..', 'docs', 'data', 'cf-webhook-worker.js');
var workerCode = fs.readFileSync(workerPath, 'utf8');

// The worker calls addEventListener('fetch', handler).
// We capture that handler.
var fetchHandler = null;

// Create a sandbox with CF Worker globals
var sandbox = {
    addEventListener: function(event, handler) {
        if (event === 'fetch') fetchHandler = handler;
    },
    console: console,
    crypto: crypto,
    caches: cachesShim,
    Response: Response,
    Request: Request,
    Headers: Headers,
    URL: URL,
    URLSearchParams: URLSearchParams,
    ReadableStream: ReadableStream,
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    Array: Array,
    Object: Object,
    JSON: JSON,
    Date: Date,
    Math: Math,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    fetch: globalThis.fetch
};

// Execute worker code
var vm = require('vm');
var context = vm.createContext(sandbox);
vm.runInContext(workerCode, context);

if (!fetchHandler) {
    console.error('Worker did not register a fetch handler');
    process.exit(1);
}

// --- HTTP server that dispatches to the worker ---

var server = http.createServer(function(nodeReq, nodeRes) {
    // Build the full URL
    var fullUrl = 'http://localhost:' + PORT + nodeReq.url;

    // Collect body
    var chunks = [];
    nodeReq.on('data', function(chunk) { chunks.push(chunk); });
    nodeReq.on('end', function() {
        var bodyBuf = Buffer.concat(chunks);

        // Build a fetch API Request
        var reqInit = {
            method: nodeReq.method,
            headers: nodeReq.headers
        };
        if (nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD' && bodyBuf.length > 0) {
            reqInit.body = bodyBuf;
        }

        var request;
        try {
            request = new Request(fullUrl, reqInit);
        } catch (e) {
            nodeRes.writeHead(500, { 'Content-Type': 'text/plain' });
            nodeRes.end('Request construction error: ' + e.message);
            return;
        }

        // Create a FetchEvent-like object
        var respondPromise = null;
        var event = {
            request: request,
            respondWith: function(p) { respondPromise = Promise.resolve(p); }
        };

        try {
            fetchHandler(event);
        } catch (e) {
            nodeRes.writeHead(500, { 'Content-Type': 'text/plain' });
            nodeRes.end('Worker error: ' + e.message);
            return;
        }

        if (!respondPromise) {
            nodeRes.writeHead(500, { 'Content-Type': 'text/plain' });
            nodeRes.end('Worker did not call respondWith');
            return;
        }

        respondPromise.then(function(response) {
            // Convert Response headers to plain object
            var headers = {};
            response.headers.forEach(function(v, k) { headers[k] = v; });
            nodeRes.writeHead(response.status, headers);

            // Handle streaming (ReadableStream) vs regular body
            if (response.body && typeof response.body.getReader === 'function') {
                var reader = response.body.getReader();
                function pump() {
                    reader.read().then(function(result) {
                        if (result.done) {
                            nodeRes.end();
                            return;
                        }
                        nodeRes.write(Buffer.from(result.value));
                        pump();
                    }).catch(function(err) {
                        console.log('[harness] stream error:', err.message);
                        nodeRes.end();
                    });
                }
                pump();
                // Handle client disconnect
                nodeReq.on('close', function() {
                    reader.cancel().catch(function() {});
                });
            } else if (response.body) {
                response.arrayBuffer().then(function(buf) {
                    nodeRes.end(Buffer.from(buf));
                });
            } else {
                nodeRes.end();
            }
        }).catch(function(err) {
            console.error('[harness] respondWith error:', err);
            if (!nodeRes.headersSent) {
                nodeRes.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            nodeRes.end('Internal error: ' + err.message);
        });
    });
});

server.listen(PORT, function() {
    console.log('CF Worker local harness running on http://localhost:' + PORT);
});

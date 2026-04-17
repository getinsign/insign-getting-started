#!/usr/bin/env node
// Minimal local CORS proxy - pass target URL as query parameter
// Usage: node cors-proxy.js [port]
// Request: http://localhost:9009/?https://target.com/api/path

const http = require('http');
const https = require('https');

const port = parseInt(process.argv[2] || '9009', 10);

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
};

http.createServer((clientReq, clientRes) => {
    // Handle CORS preflight first (browser sends OPTIONS without the real URL)
    if (clientReq.method === 'OPTIONS') {
        console.log('[PREFLIGHT] %s', clientReq.url);
        clientRes.writeHead(204, CORS_HEADERS);
        clientRes.end();
        return;
    }

    // Extract target URL from query string (everything after first '?'), decode if needed
    const qIdx = clientReq.url.indexOf('?');
    const raw = qIdx >= 0 ? clientReq.url.slice(qIdx + 1) : '';
    const targetUrl = decodeURIComponent(raw);

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        clientRes.writeHead(400, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
        clientRes.end('Pass target URL as query parameter, e.g. http://localhost:' + port + '/?https://example.com/api');
        return;
    }

    // Forward headers, skip hop-by-hop and browser origin headers
    const fwdHeaders = {};
    for (const [k, v] of Object.entries(clientReq.headers)) {
        if (!['host', 'origin', 'referer', 'connection'].includes(k)) {
            fwdHeaders[k] = v;
        }
    }

    // Collect request body for logging
    const bodyChunks = [];
    clientReq.on('data', chunk => bodyChunks.push(chunk));
    clientReq.on('end', () => {
        const bodyBuf = Buffer.concat(bodyChunks);

        // Log request
        console.log('\n[%s] %s %s', new Date().toISOString(), clientReq.method, targetUrl);
        console.log('  Headers: %s', JSON.stringify(fwdHeaders, null, 2).replace(/\n/g, '\n  '));
        if (bodyBuf.length > 0) {
            const bodyStr = bodyBuf.toString('utf8');
            console.log('  Body (%d bytes): %s', bodyBuf.length, bodyStr.length > 2000 ? bodyStr.slice(0, 2000) + '...' : bodyStr);
        }

        const parsed = new URL(targetUrl);
        const transport = parsed.protocol === 'https:' ? https : http;

        const proxyReq = transport.request(parsed, {
            method: clientReq.method,
            headers: fwdHeaders
        }, (proxyRes) => {
            console.log('  Response: %d %s', proxyRes.statusCode, proxyRes.statusMessage);
            const resHeaders = { ...proxyRes.headers, ...CORS_HEADERS, 'X-Proxy-Status': 'ok' };
            clientRes.writeHead(proxyRes.statusCode, resHeaders);
            proxyRes.pipe(clientRes);
        });

        proxyReq.on('error', (err) => {
            console.log('  Error: %s (code: %s)', err.message, err.code || 'none');
            var detail = err.message;
            // Map common error codes to human-readable messages
            if (err.code === 'ECONNREFUSED') detail = 'Connection refused - target server is not running or not listening on that port';
            else if (err.code === 'ENOTFOUND') detail = 'DNS lookup failed - hostname "' + parsed.hostname + '" does not resolve';
            else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') detail = 'Connection timed out - target server did not respond';
            else if (err.code === 'ECONNRESET') detail = 'Connection reset by target server';
            else if (err.code === 'EHOSTUNREACH') detail = 'Host unreachable - no route to "' + parsed.hostname + '"';
            else if (err.code === 'CERT_HAS_EXPIRED') detail = 'Target server SSL certificate has expired';
            else if (err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || err.code === 'SELF_SIGNED_CERT_IN_CHAIN') detail = 'Target server uses a self-signed SSL certificate';
            else if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') detail = 'Target server SSL certificate cannot be verified';
            else if (err.code && err.code.startsWith('ERR_TLS')) detail = 'TLS/SSL error connecting to target: ' + err.message;
            clientRes.writeHead(502, { 'Content-Type': 'text/plain', ...CORS_HEADERS, 'X-Proxy-Status': 'error' });
            clientRes.end(detail);
        });

        proxyReq.end(bodyBuf);
    });
}).listen(port, () => {
    console.log('CORS proxy running on http://localhost:' + port);
    console.log('Usage: http://localhost:' + port + '/?https://your-insign-server.com/api/path');
});

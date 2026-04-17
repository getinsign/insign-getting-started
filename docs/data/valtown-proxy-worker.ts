/**
 * Val.town HTTP Val - CORS Proxy + Webhook Relay with SSE
 *
 * A drop-in replacement for the Cloudflare Worker. Provides:
 *   1. CORS Proxy - forwards API requests and adds CORS headers
 *   2. Webhook Relay - receives callbacks and lets your browser poll or stream them via SSE
 *
 * SETUP:
 *   1. Go to https://val.town -> New -> HTTP
 *   2. Paste this entire script into the editor
 *   3. Click "Save" - you get a URL like https://<you>-<valname>.web.val.run
 *   4. In the API Explorer, set this URL as both CORS proxy and webhook provider
 *
 * CORS PROXY:
 *   GET/POST/etc /?https://target.com/api/path
 *   Same URL pattern as the local cors-proxy.js, so it's a drop-in replacement.
 *
 * WEBHOOK RELAY:
 *   POST /channel/new              - create a new channel
 *   POST /channel/{id}             - inSign posts callbacks here (the webhook URL)
 *   GET  /channel/{id}/requests    - browser polls for stored requests (?since=ISO)
 *   GET  /channel/{id}/stream      - SSE real-time stream of incoming webhooks
 *   DELETE /channel/{id}           - cleanup
 *
 * STORAGE: Val.town SQLite (persistent across invocations, free tier included).
 * SSE: Server-Sent Events stream with heartbeat. Free tier has ~30s timeout
 *       so EventSource auto-reconnects seamlessly using Last-Event-ID.
 *
 * LOGS: Visible in the Val.town dashboard under your val's "Logs" tab.
 */

import { sqlite } from "https://esm.town/v/std/sqlite";

// --- Init DB (idempotent) ---

await sqlite.batch([
  `CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    method TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    content_type TEXT,
    body TEXT,
    headers TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_entries_channel_ts ON entries(channel_id, timestamp)`,
]);

// --- CORS helpers ---

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "86400",
};

function addCors(h: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (!k.toLowerCase().startsWith("access-control-")) out[k] = v;
  }
  return { ...out, ...CORS_HEADERS };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: addCors({ "content-type": "application/json" }),
  });
}

// --- CORS Proxy ---

async function handleProxy(req: Request, targetUrl: string) {
  console.log(`[proxy] ${req.method} -> ${targetUrl}`);
  const skip = new Set(["host", "origin", "referer", "connection"]);
  const fwd: Record<string, string> = {};
  for (const [k, v] of req.headers.entries()) {
    if (!skip.has(k)) fwd[k] = v;
  }

  let body: ArrayBuffer | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
    console.log(`[proxy] request body: ${body.byteLength} bytes`);
  }

  try {
    const resp = await fetch(targetUrl, { method: req.method, headers: fwd, body });
    const respHeaders: Record<string, string> = {};
    for (const [k, v] of resp.headers.entries()) respHeaders[k] = v;
    console.log(`[proxy] response: ${resp.status} ${resp.statusText}`);
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: addCors(respHeaders),
    });
  } catch (e: any) {
    console.log(`[proxy] error: ${e.message}`);
    return new Response("Proxy error: " + e.message, {
      status: 502,
      headers: addCors({ "content-type": "text/plain" }),
    });
  }
}

// --- Channel helpers ---

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

async function channelExists(id: string): Promise<boolean> {
  const r = await sqlite.execute({ sql: "SELECT 1 FROM channels WHERE id = ?", args: [id] });
  return r.rows.length > 0;
}

// --- Row mapper (Val.town sqlite returns arrays or objects depending on version) ---

function mapEntryRow(r: any) {
  return {
    id: r.id ?? r[0],
    channel_id: r.channel_id ?? r[1],
    method: r.method ?? r[2],
    timestamp: r.timestamp ?? r[3],
    content_type: r.content_type ?? r[4],
    body: r.body ?? r[5],
    headers: JSON.parse((r.headers ?? r[6]) || "{}"),
  };
}

// --- Main handler ---

export default async function(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const t0 = Date.now();

  console.log(`[req] ${req.method} ${path}${url.search}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[preflight] 204");
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // CORS Proxy: /?https://target.com/path
  const raw = req.url;
  const qIdx = raw.indexOf("?");
  if (qIdx >= 0 && path === "/") {
    let target: string;
    try {
      target = decodeURIComponent(raw.substring(qIdx + 1));
    } catch {
      target = raw.substring(qIdx + 1);
    }
    if (target.startsWith("http://") || target.startsWith("https://")) {
      return handleProxy(req, target);
    }
  }

  // POST /channel/new - create channel
  if (req.method === "POST" && path === "/channel/new") {
    const id = newId();
    await sqlite.execute({ sql: "INSERT INTO channels (id) VALUES (?)", args: [id] });
    const channelUrl = url.origin + "/channel/" + id;
    console.log(`[createChannel] id=${id} url=${channelUrl}`);
    return json({ id, url: channelUrl, pollUrl: channelUrl + "/requests" });
  }

  // Match /channel/{id}...
  const match = path.match(/^\/channel\/([a-z0-9]+)(\/.*)?$/i);
  if (!match) {
    console.log("[info] root request, returning usage info");
    return json({
      info: "inSign CORS Proxy + Webhook Relay (Val.town)",
      usage: "Proxy: /?https://target/path  |  Webhooks: POST /channel/new",
    });
  }

  const channelId = match[1];
  const sub = match[2] || "";

  // POST /channel/{id} - receive webhook callback
  if (req.method === "POST" && !sub) {
    // Auto-create channel if it doesn't exist
    const existed = await channelExists(channelId);
    if (!existed) {
      await sqlite.execute({ sql: "INSERT INTO channels (id) VALUES (?)", args: [channelId] });
      console.log(`[webhook] auto-created channel ${channelId}`);
    }

    let body = "";
    try { body = await req.text(); } catch { /* empty */ }

    const headers: Record<string, string> = {};
    for (const [k, v] of req.headers.entries()) headers[k] = v;

    const entryId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await sqlite.execute({
      sql: `INSERT INTO entries (id, channel_id, method, timestamp, content_type, body, headers)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entryId,
        channelId,
        req.method,
        timestamp,
        req.headers.get("content-type") || "",
        body,
        JSON.stringify(headers),
      ],
    });

    const bodyPreview = body.length > 200 ? body.substring(0, 200) + "..." : body;
    console.log(`[webhook] POST ch=${channelId} id=${entryId} type=${req.headers.get("content-type") || "?"} body=${bodyPreview} (${Date.now() - t0}ms)`);
    return json({ ok: true, requestId: entryId });
  }

  // GET /channel/{id}/requests - poll
  if (req.method === "GET" && sub === "/requests") {
    const since = url.searchParams.get("since");
    let rows;
    if (since) {
      rows = (await sqlite.execute({
        sql: "SELECT * FROM entries WHERE channel_id = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT 200",
        args: [channelId, since],
      })).rows;
    } else {
      rows = (await sqlite.execute({
        sql: "SELECT * FROM entries WHERE channel_id = ? ORDER BY timestamp ASC LIMIT 200",
        args: [channelId],
      })).rows;
    }

    const data = rows.map(mapEntryRow);
    console.log(`[requests] ch=${channelId} total=${data.length}${since ? " since=" + since : ""} (${Date.now() - t0}ms)`);
    return json({ data, total: data.length });
  }

  // GET /channel/{id}/stream - SSE
  if (req.method === "GET" && sub === "/stream") {
    const lastEventId = req.headers.get("last-event-id");
    let since = url.searchParams.get("since") || lastEventId || new Date(0).toISOString();
    console.log(`[stream] SSE start ch=${channelId} since=${since}${lastEventId ? " (reconnect, lastEventId=" + lastEventId + ")" : ""}`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: string, id?: string) => {
          let msg = `event: ${event}\ndata: ${data}\n`;
          if (id) msg += `id: ${id}\n`;
          msg += "\n";
          controller.enqueue(encoder.encode(msg));
        };

        // Send initial connected event
        send("connected", JSON.stringify({ channelId, connectedAt: new Date().toISOString() }));

        // Poll loop - run for up to 25 seconds (leaving margin before 30s timeout)
        const deadline = Date.now() + 25_000;
        let tick = 0;
        let totalSent = 0;

        while (Date.now() < deadline) {
          // Check for new entries since last timestamp
          const rows = (await sqlite.execute({
            sql: "SELECT * FROM entries WHERE channel_id = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT 50",
            args: [channelId, since],
          })).rows;

          for (const r of rows) {
            const entry = mapEntryRow(r);
            since = entry.timestamp;
            send("webhook", JSON.stringify(entry), entry.id);
            totalSent++;
            console.log(`[stream] SSE sent webhook ch=${channelId} id=${entry.id}`);
          }

          // Heartbeat every ~4 ticks (8 seconds)
          if (tick % 4 === 0 && rows.length === 0) {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }

          tick++;
          // Wait 2 seconds between polls
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Graceful close - client EventSource will auto-reconnect
        send("timeout", JSON.stringify({ reconnect: true }));
        console.log(`[stream] SSE closing ch=${channelId} sent=${totalSent} ticks=${tick}`);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      },
    });
  }

  // DELETE /channel/{id} - cleanup
  if (req.method === "DELETE" && !sub) {
    const countResult = await sqlite.execute({
      sql: "SELECT COUNT(*) as cnt FROM entries WHERE channel_id = ?",
      args: [channelId],
    });
    const entryCount = (countResult.rows[0] as any)?.cnt ?? (countResult.rows[0] as any)?.[0] ?? 0;

    await sqlite.batch([
      { sql: "DELETE FROM entries WHERE channel_id = ?", args: [channelId] },
      { sql: "DELETE FROM channels WHERE id = ?", args: [channelId] },
    ]);
    console.log(`[deleteChannel] ch=${channelId} entries=${entryCount} (${Date.now() - t0}ms)`);
    return json({ ok: true, msg: "Channel deleted" });
  }

  console.log(`[404] ${req.method} ${path}`);
  return json({ error: "Not found" }, 404);
}

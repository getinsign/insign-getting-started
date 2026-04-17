/**
 * Deno Deploy - CORS Proxy + Webhook Relay with SSE
 *
 * A drop-in replacement for the Val.town / Cloudflare Worker. Provides:
 *   1. CORS Proxy - forwards API requests and adds CORS headers
 *   2. Webhook Relay - receives callbacks and lets your browser poll or stream them via SSE
 *
 * SETUP:
 *   1. Go to https://dash.deno.com -> New Project -> Playground
 *   2. Paste this entire script into the editor
 *   3. Click "Save & Deploy" - you get a URL like https://<project>.deno.dev
 *   4. In the API Explorer, set this URL as both CORS proxy and webhook provider
 *
 *   Alternative (CLI):
 *   1. Install deployctl: deno install -Arf jsr:@deno/deployctl
 *   2. Run: deployctl deploy --project=<name> deno-deploy-proxy-worker.ts
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
 * STORAGE: In-memory Map + Web Cache API fallback (same approach as the CF Worker).
 *          In-memory is instant when POST and poll hit the same isolate.
 *          Cache API persists across cold starts within the same region.
 *
 * SSE: Server-Sent Events stream with heartbeat. Deno Deploy supports long-lived
 *       connections (~5 min), so SSE stays open much longer than Val.town's 30s.
 *       EventSource auto-reconnects using Last-Event-ID if the connection drops.
 *
 * LOGS: Visible in the Deno Deploy dashboard under your project's "Logs" tab.
 */

// --- In-memory storage (instant when POST and poll hit same isolate) ---
const channels: Map<string, WebhookEntry[]> = new Map();

// Cache key prefixes (for cross-isolate persistence)
const CACHE_NAME = "webhook-relay";
const CH_PREFIX = "https://webhook-cache.internal/ch/";
const ENTRY_PREFIX = "https://webhook-cache.internal/entry/";

// Max entries per channel (sliding window)
const MAX_ENTRIES = 200;

// SSE stream duration (4 minutes, leaving margin before Deno Deploy's ~5 min limit)
const SSE_DURATION_MS = 4 * 60 * 1000;

interface WebhookEntry {
  id: string;
  channel_id: string;
  method: string;
  timestamp: string;
  content_type: string;
  body: string;
  headers: Record<string, string>;
}

interface IndexEntry {
  id: string;
  ts: string;
}

// --- Cache helpers ---

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await cache.match(key);
    if (resp) return await resp.json() as T;
  } catch { /* ignore */ }
  return null;
}

async function cachePut(key: string, data: unknown): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json", "cache-control": "max-age=3600" },
    }));
  } catch (e: any) {
    console.log(`[cachePut] error: ${e.message}`);
  }
}

async function cacheDel(key: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(key);
  } catch { /* ignore */ }
}

// --- Storage: in-memory + cache ---

async function appendEntry(channelId: string, entry: WebhookEntry): Promise<void> {
  // In-memory
  if (!channels.has(channelId)) channels.set(channelId, []);
  const mem = channels.get(channelId)!;
  mem.push(entry);
  if (mem.length > MAX_ENTRIES) channels.set(channelId, mem.slice(-MAX_ENTRIES));

  // Cache: store entry individually
  await cachePut(ENTRY_PREFIX + entry.id, entry);

  // Cache: update index (list of entry IDs + timestamps)
  const index = (await cacheGet<IndexEntry[]>(CH_PREFIX + channelId)) || [];
  index.push({ id: entry.id, ts: entry.timestamp });
  if (index.length > MAX_ENTRIES) index.splice(0, index.length - MAX_ENTRIES);
  await cachePut(CH_PREFIX + channelId, index);

  console.log(`[appendEntry] ch=${channelId} id=${entry.id} index=${index.length}`);
}

async function loadChannel(channelId: string): Promise<WebhookEntry[]> {
  // In-memory first
  const mem = channels.get(channelId);
  if (mem && mem.length > 0) {
    console.log(`[loadChannel] ch=${channelId} from mem: ${mem.length}`);
    return mem;
  }

  // Cache: read index, then fetch each entry
  const index = await cacheGet<IndexEntry[]>(CH_PREFIX + channelId);
  if (!index || index.length === 0) {
    console.log(`[loadChannel] ch=${channelId} empty`);
    return [];
  }

  const entries: WebhookEntry[] = [];
  for (const idx of index) {
    const entry = await cacheGet<WebhookEntry>(ENTRY_PREFIX + idx.id);
    if (entry) entries.push(entry);
  }

  // Populate in-memory for fast subsequent reads on this isolate
  if (entries.length > 0) channels.set(channelId, entries);
  console.log(`[loadChannel] ch=${channelId} from cache: index=${index.length} resolved=${entries.length}`);
  return entries;
}

async function createChannel(channelId: string): Promise<void> {
  channels.set(channelId, []);
  await cachePut(CH_PREFIX + channelId, []);
  console.log(`[createChannel] ch=${channelId}`);
}

async function deleteChannel(channelId: string): Promise<void> {
  const index = (await cacheGet<IndexEntry[]>(CH_PREFIX + channelId)) || [];
  for (const idx of index) {
    await cacheDel(ENTRY_PREFIX + idx.id);
  }
  await cacheDel(CH_PREFIX + channelId);
  channels.delete(channelId);
  console.log(`[deleteChannel] ch=${channelId} entries=${index.length}`);
}

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

// --- Helpers ---

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

// --- Main handler ---

Deno.serve(async (req: Request): Promise<Response> => {
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
    await createChannel(id);
    const channelUrl = url.origin + "/channel/" + id;
    return json({ id, url: channelUrl, pollUrl: channelUrl + "/requests" });
  }

  // Match /channel/{id}...
  const match = path.match(/^\/channel\/([a-z0-9]+)(\/.*)?$/i);
  if (!match) {
    console.log("[info] root request, returning usage info");
    return json({
      info: "inSign CORS Proxy + Webhook Relay (Deno Deploy)",
      usage: "Proxy: /?https://target/path  |  Webhooks: POST /channel/new",
    });
  }

  const channelId = match[1];
  const sub = match[2] || "";

  // POST /channel/{id} - receive webhook callback
  if (req.method === "POST" && !sub) {
    console.log(`[webhook] POST ch=${channelId}`);

    let body = "";
    try { body = await req.text(); } catch { /* empty */ }

    const headers: Record<string, string> = {};
    for (const [k, v] of req.headers.entries()) headers[k] = v;

    const entry: WebhookEntry = {
      id: crypto.randomUUID(),
      channel_id: channelId,
      method: req.method,
      timestamp: new Date().toISOString(),
      content_type: req.headers.get("content-type") || "",
      body,
      headers,
    };

    await appendEntry(channelId, entry);

    const bodyPreview = body.length > 200 ? body.substring(0, 200) + "..." : body;
    console.log(`[webhook] stored id=${entry.id} type=${entry.content_type || "?"} body=${bodyPreview} (${Date.now() - t0}ms)`);
    return json({ ok: true, requestId: entry.id });
  }

  // GET /channel/{id}/requests - poll
  if (req.method === "GET" && sub === "/requests") {
    const since = url.searchParams.get("since");
    const all = await loadChannel(channelId);

    let data = all;
    if (since) {
      const sinceTime = new Date(since).getTime();
      data = all.filter((r) => new Date(r.timestamp).getTime() > sinceTime);
    }

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

        // Poll loop - Deno Deploy supports ~5 min, we use 4 min
        const deadline = Date.now() + SSE_DURATION_MS;
        let tick = 0;
        let totalSent = 0;

        while (Date.now() < deadline) {
          const all = await loadChannel(channelId);
          const sinceTime = new Date(since).getTime();
          const fresh = all.filter((r) => new Date(r.timestamp).getTime() > sinceTime);

          for (const entry of fresh) {
            since = entry.timestamp;
            send("webhook", JSON.stringify(entry), entry.id);
            totalSent++;
            console.log(`[stream] SSE sent webhook ch=${channelId} id=${entry.id}`);
          }

          // Heartbeat every ~4 ticks (8 seconds)
          if (tick % 4 === 0 && fresh.length === 0) {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }

          tick++;
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
    await deleteChannel(channelId);
    return json({ ok: true, msg: "Channel deleted" });
  }

  console.log(`[404] ${req.method} ${path}`);
  return json({ error: "Not found" }, 404);
});

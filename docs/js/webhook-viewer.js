/* ==========================================================================
   Webhook Viewer - multi-provider webhook receiver for inSign callbacks

   Supported providers (all no-signup, all shown inline):
     • webhook.site     - free REST API, polls for requests
     • smee.io          - SSE real-time streaming (GitHub's service)
     • postb.in         - Toptal PostBin, REST FIFO poll
     • requestcatcher   - any subdomain, WebSocket real-time
     • ntfy.sh          - pub/sub notification relay via SSE (creative abuse)
     • custom           - user provides own URL (no auto-listen)

   No external pages need to be visited - everything is shown inline.
   ========================================================================== */

window.WebhookViewer = class WebhookViewer {

    constructor(containerEl) {
        this.$container = $(containerEl);
        this.channelUrl = null;       // the URL inSign posts callbacks to
        this.requests = [];
        this.onUrlCreated = null;     // callback(url)  - endpoint ready
        this.onError = null;          // callback(message) - endpoint creation failed
        this.onRequestReceived = null; // callback(request)

        // Shared state
        this._eventSource = null;     // SSE EventSource (smee, ntfy)
        this._webSocket = null;       // WebSocket (requestcatcher)
        this._pollTimer = null;       // poll timer (webhook.site, postbin)
        this._seenIds = new Set();    // de-dupe requests
        this._pollInterval = 4000;

        // Provider-specific
        this._wsToken = null;         // webhook.site token UUID
        this._postbinId = null;       // postb.in bin ID
        this._provider = 'smee';
        this._corsProxyUrl = null;    // CORS proxy URL (set by app.js)
        this._valtownUrl = null;      // Val.town base URL (set by app.js)
        this._vtChannelId = null;     // Val.town channel ID
        this._vtBaseUrl = null;       // Val.town resolved base URL
        this._vtRestoredChannelId = null; // restore after page reload
        this._denoDeployUrl = null;   // Deno Deploy base URL (set by app.js)
        this._ddChannelId = null;     // Deno Deploy channel ID
        this._ddBaseUrl = null;       // Deno Deploy resolved base URL
        this._ddRestoredChannelId = null; // restore after page reload
    }

    /** Set the CORS proxy URL for routing requests through a proxy */
    setCorsProxy(proxyUrl) { this._corsProxyUrl = proxyUrl; }

    /** Fetch through CORS proxy if configured, otherwise direct */
    _fetch(url, opts) {
        if (this._corsProxyUrl) {
            url = this._corsProxyUrl + encodeURIComponent(url);
        }
        return fetch(url, opts);
    }

    /* ------------------------------------------------------------------
       Provider selection
       ------------------------------------------------------------------ */
    setProvider(name) { this.destroy(); this._provider = name; }
    getProvider() { return this._provider; }

    /* ------------------------------------------------------------------
       Create endpoint (dispatches to provider)
       ------------------------------------------------------------------ */
    async createEndpoint() {
        const fn = {
            'webhook.site':    () => this._createWebhookSite(),
            'smee':            () => this._createSmee(),
            'postbin':         () => this._createPostbin(),
            'ntfy':            () => this._createNtfy(),
            'cfworker':        () => this._createCfWorker(),
            'valtown':         () => this._createValtown(),
            'denodeploy':      () => this._createDenoDeploy(),
        }[this._provider];
        if (fn) return fn();
        // custom - no auto-create
        return Promise.resolve(null);
    }

    /* ------------------------------------------------------------------
       Start / stop listening (dispatches to provider)
       ------------------------------------------------------------------ */
    startPolling() {
        const fn = {
            'webhook.site':    () => this._pollWebhookSite(),
            'smee':            () => this._sseSmee(),
            'postbin':         () => this._pollPostbin(),
            'ntfy':            () => this._sseNtfy(),
            'cfworker':        () => this._pollCfWorker(),
            'valtown':         () => this._sseValtown(),
            'denodeploy':      () => this._sseDenoDeploy(),
        }[this._provider];
        if (fn) fn();
    }

    stopPolling() {
        if (this._eventSource) { this._eventSource.close(); this._eventSource = null; }
        if (this._webSocket) { this._webSocket.close(); this._webSocket = null; }
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    }

    /* ------------------------------------------------------------------
       Public helpers
       ------------------------------------------------------------------ */
    getUrl() { return this.channelUrl; }

    destroy() {
        this.stopPolling();
        this.channelUrl = null;
        this._wsToken = null;
        this._postbinId = null;
        this._vtChannelId = null;
        this._vtBaseUrl = null;
        this._ddChannelId = null;
        this._ddBaseUrl = null;
        this._seenIds.clear();
        this.requests = [];
    }

    /* ==================================================================
       1. WEBHOOK.SITE - REST poll
       POST /token → uuid, GET /token/{uuid}/requests
       ================================================================== */

    async _createWebhookSite() {
        try {
            const resp = await this._fetch('https://webhook.site/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ cors: true, default_status: 200, default_content: 'ok', default_content_type: 'text/plain' })
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const token = await resp.json();
            this._wsToken = token.uuid;
            this.channelUrl = 'https://webhook.site/' + token.uuid;
            this._seenIds.clear();
            this._finishCreate();
            return this.channelUrl;
        } catch (err) {
            console.warn('[webhook] webhook.site failed:', err.message);
            this.renderError('webhook.site unavailable: ' + err.message, err.message && err.message.includes('Failed to fetch'));
            return null;
        }
    }

    _pollWebhookSite() {
        this.stopPolling();
        if (!this._wsToken) return;
        const poll = async () => {
            try {
                const resp = await this._fetch(
                    'https://webhook.site/token/' + this._wsToken + '/requests?sorting=newest&per_page=50',
                    { headers: { 'Accept': 'application/json' } }
                );
                if (!resp.ok) return;
                const json = await resp.json();
                const items = json.data || [];
                let hasNew = false;
                for (let i = items.length - 1; i >= 0; i--) {
                    const item = items[i];
                    if (this._seenIds.has(item.uuid)) continue;
                    this._seenIds.add(item.uuid);
                    hasNew = true;
                    this._addRequest({
                        id: item.uuid,
                        method: (item.method || 'POST').toUpperCase(),
                        content_type: item.content_type || '',
                        body: this._tryParseJson(item.content),
                        timestamp: item.created_at ? new Date(item.created_at) : new Date(),
                        headers: this._flattenHeaders(item.headers)
                    });
                }
                if (hasNew) this.renderRequests();
            } catch (err) { console.warn('[webhook] poll error:', err.message); }
        };
        poll();
        this._pollTimer = setInterval(poll, this._pollInterval);
    }

    /* ==================================================================
       2. SMEE.IO - SSE real-time
       Random channel, EventSource stream
       ================================================================== */

    _createSmee() {
        const id = this._randomId(16);
        this.channelUrl = 'https://smee.io/insign-' + id;
        this._finishCreate();
        return Promise.resolve(this.channelUrl);
    }

    _sseSmee() {
        this.stopPolling();
        if (!this.channelUrl) return;
        this._eventSource = new EventSource(this.channelUrl);
        this._eventSource.addEventListener('ping', () => {});
        this._eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const skipKeys = new Set(['body', 'timestamp', 'method', 'query', 'host', 'url']);
                const headers = {};
                for (const [k, v] of Object.entries(data)) {
                    if (!skipKeys.has(k) && typeof v === 'string') headers[k] = v;
                }
                this._addRequest({
                    id: data['x-request-id'] || data.timestamp || String(Date.now()),
                    method: data.method || 'POST',
                    content_type: data['content-type'] || '',
                    body: data.body || data,
                    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                    headers
                });
                this.renderRequests();
            } catch { /* ignore */ }
        };
        this._eventSource.onerror = () => {};
    }

    /* ==================================================================
       3. POSTB.IN (Toptal PostBin) - REST FIFO poll
       POST /api/bin → {binId}, POST to /{binId}, GET /api/bin/{binId}/req/shift
       Bins expire after 30 min.
       ================================================================== */

    async _createPostbin() {
        try {
            const resp = await this._fetch('https://www.postb.in/api/bin', { method: 'POST' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            this._postbinId = data.binId;
            this.channelUrl = 'https://www.postb.in/' + data.binId;
            this._finishCreate();
            return this.channelUrl;
        } catch (err) {
            console.warn('[webhook] postb.in failed:', err.message);
            this.renderError('postb.in unavailable: ' + err.message);
            return null;
        }
    }

    _pollPostbin() {
        this.stopPolling();
        if (!this._postbinId) return;
        const poll = async () => {
            try {
                // Shift returns one request at a time (FIFO), 404 when empty
                const resp = await this._fetch('https://www.postb.in/api/bin/' + this._postbinId + '/req/shift');
                if (resp.status === 404) return; // no requests waiting
                if (!resp.ok) return;
                const item = await resp.json();
                this._addRequest({
                    id: item.id || String(Date.now()),
                    method: (item.method || 'POST').toUpperCase(),
                    content_type: (item.headers && item.headers['content-type']) || '',
                    body: this._tryParseJson(item.body),
                    timestamp: item.inserted ? new Date(item.inserted) : new Date(),
                    headers: item.headers || {}
                });
                this.renderRequests();
                // There might be more - poll again immediately
                setTimeout(poll, 200);
            } catch (err) { console.warn('[webhook] postbin poll error:', err.message); }
        };
        poll();
        this._pollTimer = setInterval(poll, this._pollInterval);
    }

    /* ==================================================================
       4. REQUESTCATCHER.COM - WebSocket real-time
       Any subdomain works: {name}.requestcatcher.com
       WebSocket at wss://{name}.requestcatcher.com
       ================================================================== */

    _createRequestCatcher() {
        const name = 'insign-' + this._randomId(10);
        this.channelUrl = 'https://' + name + '.requestcatcher.com/callback';
        this._rcSubdomain = name;
        this._finishCreate();
        return Promise.resolve(this.channelUrl);
    }

    _wsRequestCatcher() {
        this.stopPolling();
        if (!this._rcSubdomain) return;
        try {
            const wsUrl = 'wss://' + this._rcSubdomain + '.requestcatcher.com';
            this._webSocket = new WebSocket(wsUrl);
            this._webSocket.onmessage = (event) => {
                try {
                    // requestcatcher sends HTML fragments - try to extract useful data
                    const raw = event.data;
                    let body = raw;
                    let method = 'POST';

                    // Try JSON parse first
                    const parsed = this._tryParseJson(raw);
                    if (parsed && typeof parsed === 'object') {
                        body = parsed.body || parsed;
                        method = parsed.method || 'POST';
                    }

                    this._addRequest({
                        id: String(Date.now()),
                        method: method,
                        content_type: '',
                        body: typeof body === 'string' ? this._tryParseJson(body) : body,
                        timestamp: new Date(),
                        headers: {}
                    });
                    this.renderRequests();
                } catch { /* ignore unparseable */ }
            };
            this._webSocket.onerror = () => {
                console.warn('[webhook] requestcatcher WS error');
            };
            this._webSocket.onclose = () => {
                // Auto-reconnect after 5s
                if (this._provider === 'requestcatcher' && this._rcSubdomain) {
                    setTimeout(() => this._wsRequestCatcher(), 5000);
                }
            };
        } catch (err) {
            console.warn('[webhook] requestcatcher WS failed:', err.message);
        }
    }

    /* ==================================================================
       5. NTFY.SH - SSE (abusing pub/sub notification service)
       POST body goes to topic, subscribe via SSE at /{topic}/sse
       Note: JSON bodies with Content-Type: application/json may be
       interpreted as ntfy commands - works best with text/plain callbacks.
       ================================================================== */

    _createNtfy() {
        const topic = 'insign-wh-' + this._randomId(12);
        this.channelUrl = 'https://ntfy.sh/' + topic;
        this._ntfyTopic = topic;
        this._finishCreate();
        return Promise.resolve(this.channelUrl);
    }

    _sseNtfy() {
        this.stopPolling();
        if (!this._ntfyTopic) return;
        const url = 'https://ntfy.sh/' + this._ntfyTopic + '/sse';
        this._eventSource = new EventSource(url);
        this._eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event !== 'message') return; // skip keepalive, open

                // ntfy puts the body in "message" field - try to parse it as JSON
                let body = data.message || '';
                body = this._tryParseJson(body) || body;

                // If ntfy interpreted JSON fields, reconstruct from available data
                if (!body && data.title) body = { title: data.title };

                this._addRequest({
                    id: data.id || String(Date.now()),
                    method: 'POST',
                    content_type: '',
                    body: body,
                    timestamp: data.time ? new Date(data.time * 1000) : new Date(),
                    headers: {}
                });
                this.renderRequests();
            } catch { /* ignore */ }
        };
        this._eventSource.onerror = () => {};
    }

    /* ==================================================================
       6. CLOUDFLARE WORKER - self-deployed relay (poll)
       User deploys cf-webhook-worker.js to their CF account.
       POST /channel/new → {id, url, pollUrl}
       POST /channel/{id} ← inSign callbacks
       GET  /channel/{id}/stream → SSE real-time stream
       ================================================================== */

    async _createCfWorker() {
        const baseUrl = (this._cfWorkerUrl || '').replace(/\/+$/, '');
        if (!baseUrl) {
            this.renderError('Enter your Cloudflare Worker URL first (deploy cf-webhook-worker.js).');
            return null;
        }

        // Reuse existing channel if we have one (e.g. after page reload)
        if (this._cfRestoredChannelId) {
            this._cfChannelId = this._cfRestoredChannelId;
            this._cfBaseUrl = baseUrl;
            this.channelUrl = baseUrl + '/channel/' + this._cfChannelId;
            this._cfRestoredChannelId = null;
            console.log('[webhook] reusing existing CF channel:', this._cfChannelId);
            this._seenIds.clear();
            this._finishCreate();
            return this.channelUrl;
        }

        try {
            const resp = await fetch(baseUrl + '/channel/new', { method: 'POST' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            this._cfChannelId = data.id;
            this._cfBaseUrl = baseUrl;
            this.channelUrl = data.url;
            console.log('[webhook] created new CF channel:', this._cfChannelId);
            this._seenIds.clear();
            this._finishCreate();
            return this.channelUrl;
        } catch (err) {
            console.warn('[webhook] CF Worker failed:', err.message);
            this.renderError('CF Worker unavailable: ' + err.message);
            return null;
        }
    }

    /** Restore a previously saved CF Worker channel ID (call before createEndpoint) */
    setCfWorkerChannelId(channelId) { this._cfRestoredChannelId = channelId; }

    _pollCfWorker() {
        this.stopPolling();
        if (!this._cfChannelId || !this._cfBaseUrl) return;
        const poll = async () => {
            try {
                const resp = await fetch(
                    this._cfBaseUrl + '/channel/' + this._cfChannelId + '/requests',
                    { headers: { 'Accept': 'application/json' } }
                );
                if (!resp.ok) return;
                const json = await resp.json();
                const items = json.data || [];
                let hasNew = false;
                for (const item of items) {
                    if (this._seenIds.has(item.id)) continue;
                    this._seenIds.add(item.id);
                    hasNew = true;
                    this._addRequest({
                        id: item.id,
                        method: (item.method || 'POST').toUpperCase(),
                        content_type: item.content_type || '',
                        body: this._tryParseJson(item.body),
                        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                        headers: item.headers || {}
                    });
                }
                if (hasNew) this.renderRequests();
            } catch (err) { console.warn('[webhook] CF Worker poll error:', err.message); }
        };
        poll();
        this._pollTimer = setInterval(poll, this._pollInterval);
    }

    _sseCfWorker() {
        this.stopPolling();
        if (!this._cfChannelId || !this._cfBaseUrl) return;
        const streamUrl = this._cfBaseUrl + '/channel/' + this._cfChannelId + '/stream';
        this._eventSource = new EventSource(streamUrl);
        this._eventSource.addEventListener('webhook', (event) => {
            try {
                const item = JSON.parse(event.data);
                if (this._seenIds.has(item.id)) return;
                this._seenIds.add(item.id);
                this._addRequest({
                    id: item.id,
                    method: (item.method || 'POST').toUpperCase(),
                    content_type: item.content_type || '',
                    body: this._tryParseJson(item.body),
                    timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                    headers: item.headers || {}
                });
                this.renderRequests();
            } catch (err) { console.warn('[webhook] CF Worker SSE parse error:', err.message); }
        });
        this._eventSource.onerror = () => {};
    }

    /** Set the CF Worker base URL (called from app.js config) */
    setCfWorkerUrl(url) { this._cfWorkerUrl = url; }

    /* ==================================================================
       7. VAL.TOWN - self-deployed relay (SSE + poll fallback)
       User deploys valtown-proxy-worker.ts to their Val.town account.
       Same channel API as CF Worker - drop-in replacement with SSE.
       POST /channel/new -> {id, url, pollUrl}
       POST /channel/{id} <- inSign callbacks
       GET  /channel/{id}/stream -> SSE real-time stream
       GET  /channel/{id}/requests -> poll fallback
       ================================================================== */

    /** Set the Val.town base URL (called from app.js config) */
    setValtownUrl(url) { this._valtownUrl = url; }

    /** Restore a previously saved Val.town channel ID (call before createEndpoint) */
    setValtownChannelId(channelId) { this._vtRestoredChannelId = channelId; }

    async _createValtown() {
        const baseUrl = (this._valtownUrl || '').replace(/\/+$/, '');
        if (!baseUrl) {
            this.renderError('Enter your Val.town HTTP Val URL first (deploy valtown-proxy-worker.ts).');
            return null;
        }

        // Reuse existing channel if we have one (e.g. after page reload)
        if (this._vtRestoredChannelId) {
            this._vtChannelId = this._vtRestoredChannelId;
            this._vtBaseUrl = baseUrl;
            this.channelUrl = baseUrl + '/channel/' + this._vtChannelId;
            this._vtRestoredChannelId = null;
            console.log('[webhook] reusing existing Val.town channel:', this._vtChannelId);
            this._seenIds.clear();
            this._finishCreate();
            return this.channelUrl;
        }

        try {
            const resp = await fetch(baseUrl + '/channel/new', { method: 'POST' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            this._vtChannelId = data.id;
            this._vtBaseUrl = baseUrl;
            this.channelUrl = data.url;
            console.log('[webhook] created new Val.town channel:', this._vtChannelId);
            this._seenIds.clear();
            this._finishCreate();
            return this.channelUrl;
        } catch (err) {
            console.warn('[webhook] Val.town failed:', err.message);
            this.renderError('Val.town unavailable: ' + err.message);
            return null;
        }
    }

    _sseValtown() {
        this.stopPolling();
        if (!this._vtChannelId || !this._vtBaseUrl) return;
        const streamUrl = this._vtBaseUrl + '/channel/' + this._vtChannelId + '/stream';
        this._eventSource = new EventSource(streamUrl);
        this._eventSource.addEventListener('webhook', (event) => {
            try {
                const item = JSON.parse(event.data);
                if (this._seenIds.has(item.id)) return;
                this._seenIds.add(item.id);
                this._addRequest({
                    id: item.id,
                    method: (item.method || 'POST').toUpperCase(),
                    content_type: item.content_type || '',
                    body: this._tryParseJson(item.body),
                    timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                    headers: item.headers || {}
                });
                this.renderRequests();
            } catch (err) { console.warn('[webhook] Val.town SSE parse error:', err.message); }
        });
        this._eventSource.addEventListener('timeout', () => {
            // Server gracefully closed after ~25s, EventSource auto-reconnects
            console.log('[webhook] Val.town SSE timeout, auto-reconnecting...');
        });
        this._eventSource.onerror = () => {};
    }

    _pollValtown() {
        this.stopPolling();
        if (!this._vtChannelId || !this._vtBaseUrl) return;
        const poll = async () => {
            try {
                const resp = await fetch(
                    this._vtBaseUrl + '/channel/' + this._vtChannelId + '/requests',
                    { headers: { 'Accept': 'application/json' } }
                );
                if (!resp.ok) return;
                const json = await resp.json();
                const items = json.data || [];
                let hasNew = false;
                for (const item of items) {
                    if (this._seenIds.has(item.id)) continue;
                    this._seenIds.add(item.id);
                    hasNew = true;
                    this._addRequest({
                        id: item.id,
                        method: (item.method || 'POST').toUpperCase(),
                        content_type: item.content_type || '',
                        body: this._tryParseJson(item.body),
                        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                        headers: item.headers || {}
                    });
                }
                if (hasNew) this.renderRequests();
            } catch (err) { console.warn('[webhook] Val.town poll error:', err.message); }
        };
        poll();
        this._pollTimer = setInterval(poll, this._pollInterval);
    }

    /* ==================================================================
       8. DENO DEPLOY - self-deployed relay (SSE + poll fallback)
       User deploys deno-deploy-proxy-worker.ts to Deno Deploy.
       Same channel API as Val.town/CF Worker - drop-in replacement.
       SSE streams stay open ~4 min (vs Val.town's 25s).
       POST /channel/new -> {id, url, pollUrl}
       POST /channel/{id} <- inSign callbacks
       GET  /channel/{id}/stream -> SSE real-time stream
       GET  /channel/{id}/requests -> poll fallback
       ================================================================== */

    /** Set the Deno Deploy base URL (called from app.js config) */
    setDenoDeployUrl(url) { this._denoDeployUrl = url; }

    /** Restore a previously saved Deno Deploy channel ID (call before createEndpoint) */
    setDenoDeployChannelId(channelId) { this._ddRestoredChannelId = channelId; }

    async _createDenoDeploy() {
        const baseUrl = (this._denoDeployUrl || '').replace(/\/+$/, '');
        if (!baseUrl) {
            this.renderError('Enter your Deno Deploy project URL first (deploy deno-deploy-proxy-worker.ts).');
            return null;
        }

        // Reuse existing channel if we have one (e.g. after page reload)
        if (this._ddRestoredChannelId) {
            this._ddChannelId = this._ddRestoredChannelId;
            this._ddBaseUrl = baseUrl;
            this.channelUrl = baseUrl + '/channel/' + this._ddChannelId;
            this._ddRestoredChannelId = null;
            console.log('[webhook] reusing existing Deno Deploy channel:', this._ddChannelId);
            this._seenIds.clear();
            this._finishCreate();
            return this.channelUrl;
        }

        try {
            const resp = await fetch(baseUrl + '/channel/new', { method: 'POST' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            this._ddChannelId = data.id;
            this._ddBaseUrl = baseUrl;
            this.channelUrl = data.url;
            console.log('[webhook] created new Deno Deploy channel:', this._ddChannelId);
            this._seenIds.clear();
            this._finishCreate();
            return this.channelUrl;
        } catch (err) {
            console.warn('[webhook] Deno Deploy failed:', err.message);
            this.renderError('Deno Deploy unavailable: ' + err.message);
            return null;
        }
    }

    _sseDenoDeploy() {
        this.stopPolling();
        if (!this._ddChannelId || !this._ddBaseUrl) return;
        const streamUrl = this._ddBaseUrl + '/channel/' + this._ddChannelId + '/stream';
        this._eventSource = new EventSource(streamUrl);
        this._eventSource.addEventListener('webhook', (event) => {
            try {
                const item = JSON.parse(event.data);
                if (this._seenIds.has(item.id)) return;
                this._seenIds.add(item.id);
                this._addRequest({
                    id: item.id,
                    method: (item.method || 'POST').toUpperCase(),
                    content_type: item.content_type || '',
                    body: this._tryParseJson(item.body),
                    timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                    headers: item.headers || {}
                });
                this.renderRequests();
            } catch (err) { console.warn('[webhook] Deno Deploy SSE parse error:', err.message); }
        });
        this._eventSource.addEventListener('timeout', () => {
            console.log('[webhook] Deno Deploy SSE timeout, auto-reconnecting...');
        });
        this._eventSource.onerror = () => {};
    }

    _pollDenoDeploy() {
        this.stopPolling();
        if (!this._ddChannelId || !this._ddBaseUrl) return;
        const poll = async () => {
            try {
                const resp = await fetch(
                    this._ddBaseUrl + '/channel/' + this._ddChannelId + '/requests',
                    { headers: { 'Accept': 'application/json' } }
                );
                if (!resp.ok) return;
                const json = await resp.json();
                const items = json.data || [];
                let hasNew = false;
                for (const item of items) {
                    if (this._seenIds.has(item.id)) continue;
                    this._seenIds.add(item.id);
                    hasNew = true;
                    this._addRequest({
                        id: item.id,
                        method: (item.method || 'POST').toUpperCase(),
                        content_type: item.content_type || '',
                        body: this._tryParseJson(item.body),
                        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                        headers: item.headers || {}
                    });
                }
                if (hasNew) this.renderRequests();
            } catch (err) { console.warn('[webhook] Deno Deploy poll error:', err.message); }
        };
        poll();
        this._pollTimer = setInterval(poll, this._pollInterval);
    }

    /* ==================================================================
       Shared helpers
       ================================================================== */

    _randomId(len) {
        return Array.from(crypto.getRandomValues(new Uint8Array(len)),
            b => b.toString(36)).join('').substring(0, len);
    }

    _tryParseJson(str) {
        if (typeof str !== 'string') return str;
        try { return JSON.parse(str); } catch { return str; }
    }

    _flattenHeaders(headers) {
        if (!headers || typeof headers !== 'object') return {};
        const flat = {};
        for (const [k, v] of Object.entries(headers)) {
            flat[k] = Array.isArray(v) ? v.join(', ') : String(v);
        }
        return flat;
    }

    _addRequest(req) {
        this.requests.unshift(req);
        if (this.onRequestReceived) this.onRequestReceived(req);
    }

    _finishCreate() {
        this.renderEndpoint();
        if (this.onUrlCreated) this.onUrlCreated(this.channelUrl);
    }

    /* ==================================================================
       Rendering (shared by all providers)
       ================================================================== */

    renderEndpoint() {
        const $urlSection = this.$container.find('.webhook-url-section');
        if ($urlSection.length === 0) return;

        const LABELS = {
            'webhook.site':   { name: 'webhook.site',     mode: 'poll',  cls: 'bg-info' },
            'smee':           { name: 'smee.io',           mode: 'SSE',   cls: 'bg-success' },
            'postbin':        { name: 'postb.in',          mode: 'poll',  cls: 'bg-info' },
            'ntfy':           { name: 'ntfy.sh',           mode: 'SSE',   cls: 'bg-success' },
            'cfworker':       { name: 'CF Worker',         mode: 'poll',  cls: 'bg-info' },
            'valtown':        { name: 'Val.town',          mode: 'SSE',   cls: 'bg-success' },
            'denodeploy':     { name: 'Deno Deploy',       mode: 'SSE',   cls: 'bg-success' },
            'custom':         { name: 'custom',            mode: '',      cls: 'bg-secondary' },
        };
        const info = LABELS[this._provider] || LABELS.custom;

        const el = document.getElementById('tpl-webhook-url').content.cloneNode(true).firstElementChild;
        el.querySelector('#webhook-url-input').value = this.channelUrl || '';
        el.querySelector('[data-slot="provider"]').textContent = info.name;
        if (info.mode) {
            const badgeEl = el.querySelector('[data-slot="badge"]');
            badgeEl.classList.remove('d-none');
            badgeEl.className = 'badge ' + info.cls;
            badgeEl.style.cssText = 'font-size:0.65rem;vertical-align:middle';
            badgeEl.textContent = info.mode;
        }
        $urlSection.empty().append(el);
    }

    renderRequests() {
        const $list = this.$container.find('.webhook-requests');
        if ($list.length === 0) return;

        if (this.requests.length === 0) {
            $list.html('<div class="text-center text-muted-sm py-4"><i class="bi bi-hourglass-split"></i> Waiting for webhooks...</div>');
            return;
        }

        const frag = document.createDocumentFragment();
        const now = Date.now();

        this.requests.forEach((req, idx) => {
            let bodyDisplay = '';
            if (req.body) {
                if (typeof req.body === 'string') {
                    try { bodyDisplay = JSON.stringify(JSON.parse(req.body), null, 2); }
                    catch { bodyDisplay = req.body; }
                } else {
                    bodyDisplay = JSON.stringify(req.body, null, 2);
                }
            }

            const time = req.timestamp instanceof Date ? req.timestamp.toLocaleTimeString() : new Date().toLocaleTimeString();
            const method = req.method || 'POST';
            const hasHeaders = req.headers && Object.keys(req.headers).length > 0;

            const detailsId = 'wh-det-' + idx + '-' + now;
            const headersId = 'wh-hdr-' + idx + '-' + now;

            const el = document.getElementById('tpl-webhook-entry').content.cloneNode(true).firstElementChild;
            el.querySelector('.webhook-method').textContent = method;
            el.querySelector('.webhook-time').textContent = time;

            const detailsToggle = el.querySelector('[data-slot="details-toggle"]');
            detailsToggle.dataset.bsToggle = 'collapse';
            detailsToggle.dataset.bsTarget = '#' + detailsId;

            const detailsPanel = el.querySelector('[data-slot="details"]');
            detailsPanel.id = detailsId;

            if (hasHeaders) {
                const headerToggle = el.querySelector('[data-slot="headers-toggle"]');
                headerToggle.classList.remove('d-none');
                headerToggle.dataset.bsToggle = 'collapse';
                headerToggle.dataset.bsTarget = '#' + headersId;
                headerToggle.querySelector('[data-slot="headers-count"]').textContent = Object.keys(req.headers).length;

                const headerPanel = el.querySelector('[data-slot="headers-panel"]');
                headerPanel.classList.remove('d-none');
                headerPanel.id = headersId;

                // Build header text
                const headerLines = Object.entries(req.headers).map(([k, v]) => k + ': ' + String(v)).join('\n');
                headerPanel.querySelector('.wh-headers').textContent = headerLines;
            }

            if (bodyDisplay) {
                const bodySection = el.querySelector('[data-slot="body-section"]');
                bodySection.classList.remove('d-none');
                bodySection.querySelector('.wh-body').textContent = bodyDisplay;
            }

            frag.appendChild(el);
        });

        $list.empty().append(frag);

        // Rotate chevron on headers collapse toggle
        $list.find('.wh-section-toggle').each(function () {
            const $toggle = $(this);
            const targetId = $toggle.attr('data-bs-target');
            $(targetId).on('show.bs.collapse', () => $toggle.find('.wh-chevron').css('transform', 'rotate(90deg)'));
            $(targetId).on('hide.bs.collapse', () => $toggle.find('.wh-chevron').css('transform', 'rotate(0deg)'));
        });
    }

    renderError(message, suggestCorsProxy) {
        const $urlSection = this.$container.find('.webhook-url-section');
        if ($urlSection.length > 0) {
            const el = document.getElementById('tpl-webhook-error').content.cloneNode(true).firstElementChild;
            const msgSlot = el.querySelector('[data-slot="message"]');
            msgSlot.textContent = message;
            if (suggestCorsProxy) {
                msgSlot.appendChild(document.createElement('br'));
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = 'Enable the CORS proxy';
                link.addEventListener('click', e => {
                    e.preventDefault();
                    document.getElementById('step-1-panel').scrollIntoView({ behavior: 'smooth' });
                    const wrap = document.getElementById('cors-proxy-toggle-wrap');
                    wrap.classList.add('highlight-flash');
                    setTimeout(() => wrap.classList.remove('highlight-flash'), 2000);
                });
                msgSlot.appendChild(link);
                msgSlot.appendChild(document.createTextNode(' on the Connection Settings page to fix this.'));
            }
            $urlSection.empty().append(el);
        }
        // Notify app of the failure
        if (this.onError) this.onError(message);
        // Notify app that CORS proxy may be needed (Failed to fetch = CORS block)
        if (message && message.includes('Failed to fetch') && this.onCorsNeeded) {
            this.onCorsNeeded();
        }
    }

    copyUrl() {
        const $input = $('#webhook-url-input');
        if ($input.length > 0) {
            navigator.clipboard.writeText($input.val()).then(() => {
                const $btn = $input.next();
                const origHtml = $btn.html();
                $btn.html('<i class="bi bi-check"></i>');
                setTimeout(() => $btn.html(origHtml), 1500);
            });
        }
    }

    escapeHtml(str) {
        return $('<div>').text(str).html();
    }
};

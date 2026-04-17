/* ==========================================================================
   inSign API Client - Browser-based fetch() wrapper with Basic/OAuth2 Auth
   ========================================================================== */

window.InsignApiClient = class InsignApiClient {

    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.username = username;
        this.password = password;
        this.useCorsProxy = false;
        this.corsProxyUrl = 'http://localhost:9009/?';
        // Auth mode: 'basic' or 'oauth2'
        this.authMode = 'basic';
        this.oauth2Token = null;       // current Bearer token
        this.oauth2ExpiresAt = null;   // Date.now() + expires_in*1000
        // Trace log
        this._traceLog = [];
        this._traceListeners = [];
    }

    /** Register a listener called with (entry) on every traced request */
    onTrace(fn) { this._traceListeners.push(fn); }

    /** Push a trace entry and notify listeners */
    _trace(entry) {
        this._traceLog.push(entry);
        this._traceListeners.forEach(fn => { try { fn(entry); } catch (_) {} });
    }

    /** Get all trace entries */
    getTraceLog() { return this._traceLog; }

    /** Clear trace log */
    clearTraceLog() { this._traceLog = []; }

    /**
     * Set OAuth2 token from a successful /oauth2/token response
     */
    setOAuth2Token(tokenResult) {
        this.oauth2Token = tokenResult.access_token;
        this.oauth2ExpiresAt = Date.now() + (tokenResult.expires_in || 1800) * 1000;
        this.authMode = 'oauth2';
    }

    /**
     * Clear OAuth2 token (revert to basic auth)
     */
    clearOAuth2Token() {
        this.oauth2Token = null;
        this.oauth2ExpiresAt = null;
    }

    /**
     * Check if OAuth2 token is valid and not expired
     */
    isOAuth2TokenValid() {
        // 30s safety margin to refresh before actual expiry
        return this.oauth2Token && this.oauth2ExpiresAt && Date.now() < (this.oauth2ExpiresAt - 30000);
    }

    /**
     * Get remaining seconds on OAuth2 token (0 if expired/none)
     */
    getOAuth2TokenTTL() {
        if (!this.oauth2ExpiresAt) return 0;
        return Math.max(0, Math.round((this.oauth2ExpiresAt - Date.now()) / 1000));
    }

    /**
     * Get the Authorization header value
     */
    getAuthHeader() {
        if (this.authMode === 'oauth2' && this.isOAuth2TokenValid()) {
            return 'Bearer ' + this.oauth2Token;
        }
        return 'Basic ' + btoa(this.username + ':' + this.password);
    }

    /**
     * Build the full URL, optionally through a CORS proxy
     */
    buildUrl(path, queryParams) {
        let url = this.baseUrl + (path.startsWith('/') ? path : '/' + path);
        if (queryParams && Object.keys(queryParams).length > 0) {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(queryParams)) {
                if (value !== undefined && value !== null && value !== '') {
                    params.append(key, value);
                }
            }
            const qs = params.toString();
            if (qs) url += '?' + qs;
        }
        if (this.useCorsProxy) {
            url = this.corsProxyUrl + encodeURIComponent(url);
        }
        return url;
    }

    /**
     * Make an API call
     * @param {string} method - HTTP method (GET, POST, DELETE, PUT)
     * @param {string} path - API path (e.g. '/configure/session')
     * @param {Object} [options] - Optional settings
     * @param {Object} [options.body] - Request body (will be JSON.stringify'd)
     * @param {Object} [options.queryParams] - URL query parameters
     * @param {string} [options.contentType] - Content-Type header (default: application/json)
     * @param {FormData} [options.formData] - FormData for multipart uploads (overrides body)
     * @param {boolean} [options.blobResponse] - If true, returns response as Blob
     * @returns {Promise<ApiResponse>}
     */
    async call(method, path, options = {}) {
        const {
            body = null,
            queryParams = null,
            contentType = 'application/json',
            accept = 'application/json',
            formData = null,
            blobResponse = false
        } = options;

        const url = this.buildUrl(path, queryParams);

        // Pre-call hook (e.g. auto-refresh OAuth2 token) - must run before
        // building headers so a refreshed token is used for this request
        if (this._beforeCall) {
            await this._beforeCall(method, path);
        }

        const headers = {
            'Authorization': this.getAuthHeader(),
            'Accept': accept
        };

        const fetchOptions = {
            method: method.toUpperCase(),
            headers,
            mode: 'cors'
        };

        if (formData) {
            // For multipart/form-data, let the browser set Content-Type with boundary
            fetchOptions.body = formData;
        } else if (body !== null && method.toUpperCase() !== 'GET') {
            headers['Content-Type'] = contentType;
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        // Build request body snapshot for trace (avoid logging binary FormData)
        const reqBodySnapshot = formData ? '[FormData]'
            : (body !== null && method.toUpperCase() !== 'GET') ? body : null;

        const startTime = performance.now();
        let result;

        try {
            const response = await fetch(url, fetchOptions);
            const duration = Math.round(performance.now() - startTime);

            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            let responseBody;
            let rawText = '';

            if (blobResponse && response.ok) {
                responseBody = await response.blob();
                rawText = `[Binary data: ${responseBody.size} bytes, type: ${responseBody.type}]`;
            } else {
                // Force UTF-8 decoding (some servers omit charset header)
                var buf = await response.arrayBuffer();
                rawText = new TextDecoder('utf-8').decode(buf);
                try {
                    responseBody = JSON.parse(rawText);
                } catch {
                    responseBody = rawText;
                }
            }

            // Detect application-level errors: JSON body with "error" != 0
            let appError = false;
            let appErrorText = '';
            if (response.ok && responseBody && typeof responseBody === 'object' && responseBody.error !== undefined && responseBody.error !== 0) {
                appError = true;
                appErrorText = responseBody.message || ('Application error: ' + responseBody.error);
            }

            result = {
                ok: response.ok && !appError,
                status: response.status,
                statusText: appError ? appErrorText : response.statusText,
                headers: responseHeaders,
                body: responseBody,
                raw: rawText,
                duration,
                blob: blobResponse && response.ok ? responseBody : null
            };

        } catch (err) {
            const duration = Math.round(performance.now() - startTime);

            // Detect CORS errors - auto-retry through proxy if available
            if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('Failed') || err.message.includes('NetworkError'))) {
                // Auto-enable CORS proxy and retry the request once
                if (!this.useCorsProxy && this.corsProxyUrl) {
                    this.useCorsProxy = true;
                    if (this._onCorsAutoEnabled) {
                        this._onCorsAutoEnabled();
                    }
                    return this.call(method, path, options);
                }

                result = {
                    ok: false,
                    status: 0,
                    statusText: 'CORS / Network Error',
                    headers: {},
                    body: {
                        error: 'CORS_OR_NETWORK_ERROR',
                        message: 'Could not reach the API server. This is most likely a CORS (Cross-Origin Resource Sharing) issue - your browser blocks requests from this page to the inSign server because the server has not allowed this origin.',
                        fixes: [
                            '1. Server fix: Set the inSign property cors.allowed-origins=* (or your specific origin) in the inSign server configuration',
                            '2. Browser fix: Install a CORS browser extension (e.g. "CORS Unblock" for Chrome/Firefox)',
                            '3. If running locally: serve this page via HTTP (npx serve docs) instead of file://'
                        ],
                        originalError: err.message
                    },
                    raw: err.message,
                    duration,
                    blob: null
                };
            } else {
                result = {
                    ok: false,
                    status: 0,
                    statusText: 'Error',
                    headers: {},
                    body: { error: err.name, message: err.message },
                    raw: err.toString(),
                    duration,
                    blob: null
                };
            }
        }

        // Record trace entry
        this._trace({
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            timestamp: new Date().toISOString(),
            method: method.toUpperCase(),
            path,
            url,
            requestHeaders: { ...headers },
            requestBody: reqBodySnapshot,
            status: result.status,
            statusText: result.statusText,
            ok: result.ok,
            responseHeaders: result.headers,
            responseBody: result.body,
            duration: result.duration
        });

        return result;
    }

    /**
     * Convenience: POST with JSON body
     */
    async post(path, body, queryParams) {
        return this.call('POST', path, { body, queryParams });
    }

    /**
     * Convenience: GET request
     */
    async get(path, queryParams, options) {
        return this.call('GET', path, { queryParams, ...options });
    }

    /**
     * Convenience: Download as blob
     */
    async download(path, body, queryParams) {
        return this.call('POST', path, { body, queryParams, blobResponse: true });
    }

    /**
     * Convenience: Upload file via multipart/form-data
     */
    async upload(path, file, queryFields = {}) {
        const formData = new FormData();
        formData.append('file', file);
        return this.call('POST', path, { formData, queryParams: queryFields });
    }

    /**
     * Get a display-friendly representation of current headers
     */
    getHeadersDisplay(contentType = 'application/json') {
        const authValue = this.getAuthHeader();
        // Truncate long Bearer tokens for display
        let displayAuth = authValue;
        if (displayAuth.startsWith('Bearer ') && displayAuth.length > 60) {
            displayAuth = 'Bearer ' + displayAuth.substring(7, 40) + '...' + displayAuth.substring(displayAuth.length - 10);
        }
        return [
            { name: 'Authorization', value: displayAuth },
            { name: 'Content-Type', value: contentType },
            { name: 'Accept', value: 'application/json' }
        ];
    }

    /**
     * Get context object for code generation
     */
    getCodeContext(method, path, body) {
        return {
            method,
            baseUrl: this.baseUrl,
            path,
            url: this.baseUrl + path,
            username: this.username,
            password: this.password,
            body,
            contentType: 'application/json'
        };
    }
};

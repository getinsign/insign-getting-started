'use strict';

/* ==========================================================================
   API Client, OAuth2, Monaco Editor Init
   ========================================================================== */


function updateApiClient() {
    const baseUrl = $('#cfg-base-url').val();
    const username = $('#cfg-username').val();
    const password = $('#cfg-password').val();

    state.apiClient = new window.InsignApiClient(baseUrl, username, password);
    hookTrace();

    // Install pre-call hook for auto-refreshing OAuth2 tokens
    state.apiClient._beforeCall = async (method, path) => {
        // Skip for the token endpoint itself to avoid recursion
        if (path === '/oauth2/token') return;
        await ensureOAuth2Token();
    };

    // Restore auth mode
    state.apiClient.authMode = state.authMode || 'basic';

    // Restore pending OAuth2 token
    if (state._pendingOAuth2) {
        state.apiClient.oauth2Token = state._pendingOAuth2.token;
        state.apiClient.oauth2ExpiresAt = state._pendingOAuth2.expiresAt;
        delete state._pendingOAuth2;
        startOAuth2TokenCountdown();
        updateOAuth2TokenStatus();
    }

    const corsProxy = $('#cfg-cors-proxy').is(':checked');
    state.apiClient.useCorsProxy = corsProxy;
    state.apiClient.corsProxyUrl = $('#cfg-cors-proxy-url').val() || 'http://localhost:9009/?';

    // Auto-enable CORS proxy on first CORS error: update UI toggle and notify user
    state.apiClient._onCorsAutoEnabled = () => {
        $('#cfg-cors-proxy').prop('checked', true);
        $('#cors-proxy-url-group').css('display', '');
        $('#cors-proxy-security-warning').removeClass('d-none');
        showToast('CORS error detected - automatically enabled CORS proxy.', 'info');
        saveAppState();
    };

    // Update trust indicator
    const $trustUrl = $('#trust-target-url');
    if ($trustUrl.length) $trustUrl.text('\u2192 ' + baseUrl);

    updateHeadersDisplay();

    // Load OpenAPI schemas from the server (non-blocking)
    if (baseUrl && !state.schemaLoader.loaded) {
        const proxy = corsProxy ? (state.apiClient.corsProxyUrl || 'https://corsproxy.io/?') : null;
        var $badge = $('#openapi-badge');
        var showTime = Date.now();
        $badge.removeClass('d-none fade-out done');
        state.schemaLoader.load(baseUrl, proxy).then(ok => {
            if (ok) {
                state.schemaLoader.enrichGuiProperties(FEATURE_GROUPS);
                refreshFeatureDescriptions();
                if (state.monacoReady) {
                    state.schemaLoader.registerWithMonaco(monaco);
                }
            }
            var elapsed = Date.now() - showTime;
            $badge.addClass('done');
            $badge.find('.openapi-badge-spin').removeClass('bi-arrow-repeat').addClass(ok ? 'bi-check-lg' : 'bi-x-lg');
            if (ok) {
                // Success: show load time, then fade out after min 3s visible
                $badge.find('.openapi-badge-text').text(
                    'API schema loaded (' + (elapsed / 1000).toFixed(1) + 's)'
                );
                var delay = Math.max(0, 3000 - elapsed);
                setTimeout(function () {
                    $badge.addClass('fade-out');
                    setTimeout(function () { $badge.addClass('d-none'); }, 600);
                }, delay);
            } else {
                // Error: keep badge visible, show toast with details
                $badge.addClass('openapi-badge-error');
                $badge.find('.openapi-badge-text').text('API schema unavailable');
                showToast('OpenAPI schema could not be loaded from ' + baseUrl + '/v3/api-docs'
                    + (proxy ? ' (via CORS proxy)' : '')
                    + ' - autocomplete and tooltips will be limited.', 'warning');
            }
        });
    }
}

function _createHeaderRow(name, value) {
    const row = document.getElementById('tpl-header-row').content.cloneNode(true).firstElementChild;
    row.querySelector('.header-name').textContent = name + ':';
    row.querySelector('.header-value').textContent = value;
    return row;
}

function _buildHeaderRows(headers) {
    const frag = document.createDocumentFragment();
    for (const h of headers) frag.appendChild(_createHeaderRow(h.name, h.value));
    return frag;
}

function updateHeadersDisplay() {
    if (!state.apiClient) return;
    const defaultHeaders = state.apiClient.getHeadersDisplay();
    const defaultFrag = _buildHeaderRows(defaultHeaders);

    // Step 1 headers
    $('#step1-headers').empty().append(defaultFrag.cloneNode(true));

    // Per-operation headers (respect accept/formParams overrides)
    $('.op-headers').each(function () {
        const opKey = $(this).data('op');
        const opDef = OPERATIONS[opKey];
        if (opDef && (opDef.accept || opDef.formParams)) {
            const headers = state.apiClient.getHeadersDisplay();
            const frag = document.createDocumentFragment();
            for (const h of headers) {
                if (h.name === 'Content-Type' && opDef.formParams) continue;
                const val = (h.name === 'Accept' && opDef.accept) ? opDef.accept : h.value;
                frag.appendChild(_createHeaderRow(h.name, val));
            }
            $(this).empty().append(frag);
        } else {
            $(this).empty().append(defaultFrag.cloneNode(true));
        }
    });
}

// =====================================================================
// OAuth2 Authentication
// =====================================================================

function setAuthMode(mode) {
    state.authMode = mode;

    // Toggle button styles
    $('#auth-mode-toggle button').each(function () {
        const $btn = $(this);
        if ($btn.data('mode') === mode) {
            $btn.removeClass('btn-insign-outline').addClass('active');
        } else {
            $btn.addClass('btn-insign-outline').removeClass('active');
        }
    });

    // Show/hide panels
    $('#auth-basic-panel').css('display', mode === 'basic' ? '' : 'none');
    $('#auth-oauth2-panel').css('display', mode === 'oauth2' ? '' : 'none');

    // Update API client auth mode
    if (state.apiClient) {
        state.apiClient.authMode = mode;
        updateHeadersDisplay();
        updateAuthHeaders();
    }

    saveAppState();
}

function syncOAuth2Credentials() {
    // Sync client_id/client_secret from sidebar username/password
    const username = $('#cfg-username').val() || '';
    const password = $('#cfg-password').val() || '';
    $('#oauth2-client-id').val(username);
    $('#oauth2-client-secret').val(password);
}

function updateAuthHeaders() {
    if (!state.apiClient) return;

    // Basic auth panel headers
    const basicHeaders = [
        { name: 'Authorization', value: 'Basic ' + btoa((state.apiClient.username || '') + ':' + (state.apiClient.password || '')) }
    ];
    $('#auth-basic-headers').empty().append(_buildHeaderRows(basicHeaders));
}

async function executeOAuth2Token() {
    if (!state.apiClient) return;

    const clientId = $('#oauth2-client-id').val() || '';
    const clientSecret = $('#oauth2-client-secret').val() || '';

    const formBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
    }).toString();

    const url = state.apiClient.buildUrl('/oauth2/token');

    const $statusEl = $(`.response-status[data-op="oauth2-token"]`);
    $statusEl.css('display', '').attr('class', 'response-status').html(
        '<span class="spinner-insign spinner-dark me-2"></span> Requesting token...'
    );

    const startTime = performance.now();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody,
            mode: 'cors'
        });
        const duration = Math.round(performance.now() - startTime);
        const rawText = await response.text();
        let body;
        try { body = JSON.parse(rawText); } catch { body = rawText; }

        const respHeaders = {};
        response.headers.forEach((v, k) => { respHeaders[k] = v; });

        $statusEl.attr('class', 'response-status ' + (response.ok ? 'success' : 'error'));
        $statusEl.html(`
            <strong>${response.status}</strong> ${response.statusText}
            <span class="ms-auto text-muted-sm">${duration}ms</span>
        `);

        // Show response in editor
        showResponseEditor('op-oauth2-token', body);

        // Trace the OAuth2 call
        if (state.apiClient) {
            state.apiClient._trace({
                id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                timestamp: new Date().toISOString(),
                method: 'POST',
                path: '/oauth2/token',
                url,
                requestHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
                requestBody: formBody,
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                responseHeaders: respHeaders,
                responseBody: body,
                duration
            });
        }

        if (response.ok && body && body.access_token) {
            // Apply token to API client
            state.apiClient.setOAuth2Token(body);
            state.authMode = 'oauth2';
            updateOAuth2TokenStatus();
            updateHeadersDisplay();
            startOAuth2TokenCountdown();
            saveAppState();
        }
    } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        $statusEl.attr('class', 'response-status error');
        $statusEl.html(`
            <strong>0</strong> Network/CORS Error
            <span class="ms-auto text-muted-sm">${duration}ms</span>
        `);
        const errBody = {
            error: 'CORS_OR_NETWORK_ERROR',
            message: err.message,
            hint: 'Enable the CORS proxy toggle in the Connection settings if you cannot reach the API directly.'
        };
        showResponseEditor('op-oauth2-token', errBody);

        // Trace the failed OAuth2 call
        if (state.apiClient) {
            state.apiClient._trace({
                id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                timestamp: new Date().toISOString(),
                method: 'POST',
                path: '/oauth2/token',
                url,
                requestHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
                requestBody: formBody,
                status: 0,
                statusText: 'Network/CORS Error',
                ok: false,
                responseHeaders: {},
                responseBody: errBody,
                duration
            });
        }
    }
}

/**
 * Auto-request an OAuth2 token if auth mode is oauth2 but no valid token exists.
 * Populates the token response UI on the Connection tab just like a manual request.
 */
var _tokenRefreshPromise = null;
async function ensureOAuth2Token() {
    if (!state.apiClient) return;
    if (state.apiClient.authMode !== 'oauth2') return;
    if (state.apiClient.isOAuth2TokenValid()) return;
    if (!state.apiClient.username && !state.apiClient.password) return;

    // Deduplicate concurrent callers
    if (_tokenRefreshPromise) return _tokenRefreshPromise;

    _tokenRefreshPromise = (async () => {
        try {
            // Ensure OAuth2 form fields are synced from credentials
            updateHeadersDisplay();
            await executeOAuth2Token();
        } finally {
            _tokenRefreshPromise = null;
        }
    })();

    return _tokenRefreshPromise;
}

function updateOAuth2TokenStatus() {
    const $status = $('#oauth2-token-status');
    if (!state.apiClient || !state.apiClient.oauth2Token) {
        $status.css('display', 'none');
        return;
    }
    $status.css('display', '');

    const ttl = state.apiClient.getOAuth2TokenTTL();
    const valid = ttl > 0;
    const $badge = $('#oauth2-status-badge');
    const $ttl = $('#oauth2-token-ttl');
    const $header = $('#oauth2-active-header');

    $badge.attr('class', 'badge ' + (valid ? 'bg-success' : 'bg-danger'))
          .html(valid ? '<i class="bi bi-check-circle"></i> Valid' : '<i class="bi bi-x-circle"></i> Expired');

    const mins = Math.floor(ttl / 60);
    const secs = ttl % 60;
    $ttl.text(valid ? `Expires in ${mins}m ${secs}s` : 'Token expired - requests fall back to Basic Auth');

    // Show truncated auth header
    const authVal = state.apiClient.getAuthHeader();
    let displayVal = authVal;
    if (displayVal.length > 80) {
        displayVal = displayVal.substring(0, 50) + '...' + displayVal.substring(displayVal.length - 15);
    }
    $header.empty().append(_createHeaderRow('Authorization', displayVal));
}

var _oauth2CountdownInterval = null;
function startOAuth2TokenCountdown() {
    if (_oauth2CountdownInterval) clearInterval(_oauth2CountdownInterval);
    _oauth2CountdownInterval = setInterval(() => {
        updateOAuth2TokenStatus();
        if (!state.apiClient || !state.apiClient.isOAuth2TokenValid()) {
            clearInterval(_oauth2CountdownInterval);
            _oauth2CountdownInterval = null;
            updateHeadersDisplay();
        }
    }, 1000);
}

function clearOAuth2Token() {
    if (state.apiClient) {
        state.apiClient.clearOAuth2Token();
    }
    if (_oauth2CountdownInterval) {
        clearInterval(_oauth2CountdownInterval);
        _oauth2CountdownInterval = null;
    }
    $('#oauth2-token-status').css('display', 'none');
    updateHeadersDisplay();
    saveAppState();
}

// =====================================================================
// Monaco Editor
// =====================================================================

function initMonaco() {
    require.config({
        paths: { vs: 'vendor/monaco-editor/min/vs' }
    });

    require(['vs/editor/editor.main'], function () {
        state.monacoReady = true;

        // Register JSON schemas from OpenAPI spec (loaded dynamically)
        if (state.schemaLoader && state.schemaLoader.loaded) {
            state.schemaLoader.enrichGuiProperties(FEATURE_GROUPS);
            state.schemaLoader.registerWithMonaco(monaco);
        }

        // Create Step 1 editor
        createEditor('create-session', getDefaultCreateSessionBody(), 'configureSession', { uncapped: true });

        // Restore persisted editor content (overrides defaults if user had custom edits)
        const savedState = loadAppState();
        if (savedState && savedState.createSessionContent) {
            setEditorValue('create-session', savedState.createSessionContent);
        } else {
            // Apply saved feature toggle settings to the editor (only when no full content was saved)
            applyFeatureSettingsToEditor();
        }

        // Apply branding (colors + logos) to the newly created editor
        applyBrandingCSS();
        applyBrandingLogos();

        // Bidirectional sync: editor changes → sidebar inputs & feature toggles
        if (state.editors['create-session']) {
            state.editors['create-session'].onDidChangeModelContent(() => {
                if (state._editorSyncLock) return;
                syncEditorToUI();
            });
        }

        // Create operation editors - use schemaKey from operations.json,
        // falling back to OpenAPI spec lookup for request body schemas
        for (const [opKey, opDef] of Object.entries(OPERATIONS)) {
            if (opDef.getBody) {
                let sk = opDef.schemaKey;
                if (!sk && state.schemaLoader) {
                    sk = state.schemaLoader.getRequestSchemaKey(opDef.path, opDef.method) || null;
                }
                createEditor('op-' + opKey, opDef.getBody(), sk);
            }
        }

        // Free request editor with default sessionid body
        createEditor('op-free', getSessionIdBody(), null);

        // Sync extern option buttons when user edits the extern JSON
        if (state.editors['op-extern']) {
            state.editors['op-extern'].onDidChangeModelContent(() => {
                if (state._editorSyncLock) return;
                syncExternOptionsFromJson();
            });
        }

        // Code snippet editor (read-only)
        createReadOnlyEditor('code-snippet', '// Select a language tab above to see code snippets', 'javascript', { uncapped: true });

        // Init code language tabs
        initCodeTabs();
    });
}

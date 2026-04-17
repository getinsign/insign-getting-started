'use strict';

/* ==========================================================================
   Initialization & Hash Navigation
   ========================================================================== */

// =====================================================================
// Generate Step 3 operation tabs from operations.json + templates
// =====================================================================

function generateOperationTabs(tabOrder) {
    var $tabList = $('#operation-tabs');
    var $tabContent = $('#operation-tab-content');
    var tabTpl = document.getElementById('tpl-operation-tab');
    var paneTpl = document.getElementById('tpl-operation-pane');
    if (!$tabList.length || !tabTpl || !paneTpl) return;

    var isFirst = true;

    tabOrder.forEach(function (key) {
        var op = OPERATIONS[key];
        if (!op || !op.icon) return;

        // --- Tab button (always generated) ---
        var $tab = $(tabTpl.content.cloneNode(true));
        var $btn = $tab.find('button');
        $btn.attr('data-bs-target', '#op-' + key);
        $btn.find('i').addClass(op.icon);
        $btn.find('.op-tab-label').text(op.label || key);
        if (isFirst) $btn.addClass('active');
        $tabList.append($tab);

        // --- Tab pane: skip if already in HTML (special cases) ---
        if (op.type === 'special') {
            // Special-case panes are already in the HTML.
            // Just mark the first one active if needed.
            if (isFirst) $('#op-' + key).addClass('show active');
            isFirst = false;
            return;
        }

        // --- Standard tab pane (generated from template) ---
        var $pane = $(paneTpl.content.cloneNode(true));
        var $root = $pane.children().first();
        $root.attr('id', 'op-' + key);
        if (isFirst) $root.addClass('show active');

        // Header
        var $badge = $root.find('.badge-method');
        $badge.addClass('badge-method-' + (op.method || 'post').toLowerCase());
        $badge.text(op.method || 'POST');
        $root.find('.endpoint-path').text(op.path || '');
        $root.find('h5').html(op.title || key);

        // Description
        $root.find('.op-description').html(op.description || '');

        // Headers display
        $root.find('.op-headers').attr('data-op', key);

        // Editor (hide for GET requests with no body)
        var $editor = $root.find('.op-editor');
        $editor.attr('id', 'editor-op-' + key);
        if (!op.getBody) {
            $root.find('.op-body-section').remove();
        }

        // Send button
        var $sendBtn = $root.find('.op-send-btn');
        var handler = op.handler || "executeOperation('" + key + "')";
        $sendBtn.attr('onclick', 'window.app.' + handler);
        if (op.buttonIcon) $sendBtn.find('i').attr('class', 'bi ' + op.buttonIcon);
        if (op.buttonLabel) $sendBtn.find('span').text(op.buttonLabel);
        if (op.buttonStyle === 'danger') $sendBtn.css('background', 'var(--insign-danger)');

        // Response
        $root.find('.op-response').attr('data-op', key);
        $root.find('.response-status').attr('data-op', key);
        $root.find('.op-response-editor').attr('id', 'editor-op-' + key + '-response');

        $tabContent.append($pane);
        isFirst = false;
    });
}

// =====================================================================
// Initialization
// =====================================================================

async function init() {
    // Deferred from state declaration (loadProfiles not yet available at parse time)
    state.userId = getOrCreateUserId();

    // Load catalog data from JSON files
    var [whResp, docResp, opsResp] = await Promise.all([
        fetch('data/webhook-providers.json'),
        fetch('data/documents.json'),
        fetch('data/operations.json')
    ]);
    if (whResp.ok) WEBHOOK_PROVIDERS = await whResp.json();
    if (docResp.ok) DOCUMENTS = await docResp.json();
    if (opsResp.ok) {
        var opsData = await opsResp.json();
        var tabOrder = opsData.tabOrder || [];
        delete opsData.tabOrder;
        OPERATIONS = opsData;
        // Hydrate bodyFn strings into actual function references
        var bodyFns = {
            getSessionIdBody: getSessionIdBody,
            getDefaultExternBody: getDefaultExternBody,
            getDocumentSingleBody: getDocumentSingleBody,
            getSSOBody: getSSOBody,
            getUserSessionsBody: getUserSessionsBody
        };
        for (var op of Object.values(OPERATIONS)) {
            if (typeof op !== 'object') continue;
            op.getBody = op.bodyFn ? bodyFns[op.bodyFn] : null;
            delete op.bodyFn;
        }
        // Generate operation tabs from template + data
        generateOperationTabs(tabOrder);
    }

    // Restore saved state before populating defaults
    restoreAppState();
    renderProfiles();
    // Show localStorage warning if profiles were saved previously
    if (loadProfiles().length > 0) {
        $('#save-credentials-warning').removeClass('d-none');
    }

    updateSaveButtonState();

    // Load names list for user generation
    try {
        const resp = await fetch('data/names.json');
        if (resp.ok) state.namesList = await resp.json();
    } catch { /* ok, use defaults */ }

    // Populate owner fields with a random user (only if not restored from saved state)
    {
        const $dnInput = $('#cfg-displayname');
        const $fnInput = $('#cfg-userfullname');
        const $emInput = $('#cfg-userEmail');
        const $fuInput = $('#cfg-foruser');
        if ($fuInput.length && !$fuInput.val()) {
            const user = generateRandomUser();
            $fuInput.val(user.foruser);
            if ($fnInput.length && !$fnInput.val()) $fnInput.val(user.userFullName);
            if ($emInput.length && !$emInput.val()) $emInput.val(user.userEmail);
            state.userId = user.foruser;
        }
        if ($dnInput.length && !$dnInput.val()) {
            const selDoc = getSelectedDocument();
            $dnInput.val(selDoc.label || '');
        }
    }

    // Show Session Manager button and populate navbar foruser early (only needs a foruser, not a session)
    {
        const foruser = ($('#cfg-foruser').val() || '').trim() || state.userId || '';
        if (foruser) {
            $('#navbar-btn-session-mgr').removeClass('d-none');
            $('#navbar-foruser-id').val(foruser);
            _updateNavSub('navbar-foruser-id-display', foruser);
        }
    }

    // Build document selector, feature toggles, and branding presets
    buildDocumentSelector();
    // Re-trigger thumbnail lazy-loading when the doc list section is expanded
    const docPanel = document.getElementById('doc-selector-panel');
    if (docPanel) {
        docPanel.addEventListener('shown.bs.collapse', () => _lazyLoadVisibleThumbs());
    }
    initFileDeliveryDropdown();
    initDragDrop();
    buildWebhookProviderDropdown();
    buildFeatureToggles();
    _initJsonHoverTooltip();
    buildColorSchemePresets();
    buildLogoSets();
    restoreBranding();
    // When sync toggle is turned on, immediately apply current document's brand
    $('#brand-sync-doc').on('change', function() {
        saveAppState();
        if ($(this).is(':checked')) {
            var doc = getSelectedDocument();
            if (doc.brand) {
                var idx = LOGO_SETS.findIndex(function(s) { return s.prefix === doc.brand; });
                if (idx >= 0) { selectColorScheme(idx); selectLogoSet(idx); }
            }
        }
    });
    // Apply branding matching the selected document if no saved branding
    var saved = loadAppState();
    if ((!saved || saved.brandColorScheme == null) && $('#brand-sync-doc').is(':checked')) {
        var doc = getSelectedDocument();
        if (doc.brand) {
            var idx = LOGO_SETS.findIndex(function(s) { return s.prefix === doc.brand; });
            if (idx >= 0) { selectColorScheme(idx); selectLogoSet(idx); }
        }
    }
    // Only generate/apply CSS if a non-default color scheme is explicitly selected;
    // when Default or nothing is selected, ensure no CSS leaks into JSON
    const activeSchemeBtn = document.querySelector('.color-scheme-btn.active');
    const isNonDefault = activeSchemeBtn && activeSchemeBtn !== document.querySelector('.color-scheme-btn:first-child');
    if (isNonDefault) {
        updateBrandColor();
    } else {
        removeColorScheme();
    }

    // Update collapsed section summaries
    _updateFeatureChangedCount();
    _updateBrandingHeaderSummary();

    // Derive GitHub repo link from Pages URL (user.github.io/repo → github.com/user/repo)
    const ghMatch = location.hostname.match(/^(.+)\.github\.io$/);
    if (ghMatch) {
        const ghRepo = location.pathname.split('/')[1] || '';
        const ghBase = 'https://github.com/' + ghMatch[1] + (ghRepo ? '/' + ghRepo : '');
        // Legacy single element
        const ghLink = document.getElementById('github-repo-link');
        if (ghLink) ghLink.href = ghBase;
        // All elements with data-github-link class
        document.querySelectorAll('.data-github-link').forEach(function (el) {
            var suffix = el.getAttribute('data-github-path') || '';
            el.href = ghBase + suffix;
        });
    } else {
        const ghLink = document.getElementById('github-repo-link');
        if (ghLink) ghLink.style.display = 'none';
    }

    // Init API client
    updateApiClient();

    // Sync OAuth2 credentials from sidebar and initialize auth mode
    syncOAuth2Credentials();
    updateAuthHeaders();
    if (state.authMode === 'oauth2') {
        setAuthMode('oauth2');
    }

    // Update trust indicator with target URL
    const $trustUrl = $('#trust-target-url');
    if ($trustUrl.length) $trustUrl.text('\u2192 ' + $('#cfg-base-url').val());

    // Bind sidebar events
    $('#cfg-base-url').on('change input', () => { if (!_profileSelecting) _selectedProfileKey = null; updateApiClient(); saveAppState(); updateCorsVisibility(); updateSaveButtonState(); });
    $('#cfg-username').on('change input', () => { if (!_profileSelecting) _selectedProfileKey = null; updateApiClient(); syncOAuth2Credentials(); saveAppState(); updateSaveButtonState(); });
    $('#cfg-password').on('change input', () => { if (!_profileSelecting) _selectedProfileKey = null; updateApiClient(); syncOAuth2Credentials(); saveAppState(); updateSaveButtonState(); });

    $('#btn-use-sandbox').on('click', () => {
        $('#cfg-base-url').val('https://sandbox.test.getinsign.show');
        $('#cfg-username').val('controller');
        $('#cfg-password').val('pwd.insign.sandbox.4561');
        updateApiClient();
        syncOAuth2Credentials();
        saveAppState();
        updateCorsVisibility();
    });

    // ---- CORS: probe directly first, only offer proxy if needed ----
    const SANDBOX_URL = 'sandbox.test.getinsign.show';
    let directProbeAbort = null;

    function isSandboxUrl(url) {
        return (url || '').toLowerCase().includes(SANDBOX_URL);
    }

    function setCorsNeeded(needed) {
        state._corsIssueApi = needed;
        reconcileWebhookCorsState();
    }

    function updateCorsVisibility() {
        const baseUrl = ($('#cfg-base-url').val() || '').replace(/\/+$/, '');

        // Abort any in-flight direct probe and clear version
        if (directProbeAbort) { directProbeAbort.abort(); directProbeAbort = null; }
        $('#cors-direct-version').text('').addClass('d-none');

        if (!baseUrl) { setCorsNeeded(false); return; }

        // Sandbox has relaxed CORS - no probe needed, but still fetch version
        if (isSandboxUrl(baseUrl)) {
            setCorsNeeded(false);
            fetch(baseUrl + '/version', { method: 'GET', mode: 'cors', cache: 'no-store' })
                .then(r => r.ok ? r.text() : null)
                .then(t => { if (t) $('#cors-direct-version').text('inSign ' + t.trim()).removeClass('d-none'); })
                .catch(() => {});
            return;
        }

        // Probe the URL directly (no proxy) to see if CORS is an issue
        directProbeAbort = new AbortController();
        fetch(baseUrl + '/version', {
            method: 'GET', mode: 'cors', cache: 'no-store',
            signal: directProbeAbort.signal
        })
            .then(r => {
                if (r.ok) {
                    // Server responds with CORS headers - no proxy needed
                    setCorsNeeded(false);
                    r.text().then(t => {
                        const v = t.trim();
                        if (v) $('#cors-direct-version').text('inSign ' + v).removeClass('d-none');
                    });
                } else {
                    // Server reachable but returned error - still no CORS issue
                    setCorsNeeded(false);
                }
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
                // Network/CORS error - proxy is needed
                setCorsNeeded(true);
            });
    }

    // ---- CORS proxy with local probe ----
    let probeInterval = null;
    let probeStatus = null; // 'ok' | 'fail' | null

    function probeLocalProxy() {
        // Probe the proxy by requesting the inSign base URL through it.
        // This confirms the full chain: proxy running + can reach the target.
        const proxyUrl = $('#cfg-cors-proxy-url').val() || 'http://localhost:9009/?';
        const baseUrl = ($('#cfg-base-url').val() || '').replace(/\/+$/, '');
        const $dot = $('#proxy-probe-dot');
        if (!$dot.length) return;
        $dot.attr('class', 'proxy-probe-dot probe-pending');
        if (!baseUrl) { applyProbeResult(false, null, 'No API base URL configured'); return; }
        const url = proxyUrl + encodeURIComponent(baseUrl + '/version');
        fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store', signal: AbortSignal.timeout(4000) })
            .then(r => {
                if (r.ok) return r.text().then(t => applyProbeResult(true, t.trim()));
                var proxyOk = r.headers.get('X-Proxy-Status') === 'ok';
                if (proxyOk) {
                    // Proxy reached the target, but target returned an error
                    return applyProbeResult(false, null, 'Target returned HTTP ' + r.status + ' - check API Base URL');
                }
                // Proxy itself failed (502 with X-Proxy-Status: error)
                return r.text().then(t => applyProbeResult(false, null, t || ('Proxy error ' + r.status)));
            })
            .catch(() => applyProbeResult(false, null, 'Proxy not running'));
    }

    function applyProbeResult(ok, version, errorDetail) {
        const prev = probeStatus;
        probeStatus = ok ? 'ok' : 'fail';
        const $dot = $('#proxy-probe-dot');
        const $label = $('#proxy-probe-label');
        $dot.attr('class', 'proxy-probe-dot probe-' + probeStatus);
        if (ok) {
            const vText = version ? 'Connected - inSign ' + version : 'Connected';
            $label.text(vText).attr('class', 'proxy-probe-label probe-label-ok');
        } else {
            var failText = errorDetail || 'Not reachable';
            // Truncate long error messages for the label
            if (failText.length > 80) failText = failText.slice(0, 77) + '...';
            $label.text(failText).attr('class', 'proxy-probe-label probe-label-fail');
        }
        // Toast on status change (skip first probe)
        if (prev !== null && prev !== probeStatus) {
            showProxyToast(ok, version, errorDetail);
        }
    }

    function startProbePolling() {
        stopProbePolling();
        if (state.currentStep !== 1) return; // only probe on connection tab
        probeLocalProxy();
        probeInterval = setInterval(() => {
            if (state.currentStep !== 1) { stopProbePolling(); return; }
            if ($('#cors-proxy-url-group').css('display') !== 'none') {
                probeLocalProxy();
            }
        }, 5000);
    }

    function stopProbePolling() {
        if (probeInterval) {
            clearInterval(probeInterval);
            probeInterval = null;
        }
        probeStatus = null;
    }

    function showProxyToast(ok, version, errorDetail) {
        $('.proxy-toast').remove();
        const icon = ok ? '<i class="bi bi-check-circle-fill"></i>' : '<i class="bi bi-x-circle-fill"></i>';
        var msg = ok ? ('Connected to inSign' + (version ? ' ' + version : '')) : (errorDetail || 'Proxy - inSign not reachable');
        if (msg.length > 100) msg = msg.slice(0, 97) + '...';
        const cls = ok ? 'toast-ok' : 'toast-fail';
        const $toast = $('<div class="proxy-toast ' + cls + '">' + icon + ' ' + msg + '</div>');
        $('body').append($toast);
        setTimeout(() => $toast.fadeOut(300, () => $toast.remove()), 3500);
    }

    const $corsToggle = $('#cfg-cors-proxy');
    $corsToggle.on('change', () => {
        const on = $corsToggle.is(':checked');
        $('#cors-proxy-url-group').css('display', on ? '' : 'none');
        $('#cors-proxy-security-warning').toggleClass('d-none', !on);
        updateApiClient();
        saveAppState();
        if (on) {
            startProbePolling();
        } else {
            stopProbePolling();
        }
        // Reinit webhook so it retries through (or without) the proxy
        if ($('#cfg-webhooks').is(':checked') && state.webhookViewer) {
            reinitWebhook();
        }
        updateSelectedProfile();
    });

    $('#cfg-cors-proxy-url').on('change', () => {
        updateApiClient();
        saveAppState();
        // Update webhook viewer proxy
        if (state.webhookViewer) {
            var proxy = $corsToggle.is(':checked') ? ($('#cfg-cors-proxy-url').val() || 'http://localhost:9009/?') : null;
            state.webhookViewer.setCorsProxy(proxy);
        }
        updateSelectedProfile();
    });

    // Show actual origin in CORS config hint
    $('#cors-origin-hint').text(window.location.origin);

    // Set initial CORS visibility based on URL
    updateCorsVisibility();

    // If CORS proxy is already enabled on load, start probing
    if ($corsToggle.is(':checked')) {
        setTimeout(() => startProbePolling(), 500);
    }

    // "Save connection" button
    $('#btn-save-connection').on('click', function() { saveConnectionProfile(); });

    // "Clear all saved data" button
    $('#btn-clear-all-storage').on('click', function() {
        if (!confirm('Delete all saved connection profiles and settings from browser localStorage?')) return;
        clearAllStorage();
        showToast('All saved data cleared from browser.', 'info');
    });

    // Bind owner field inputs → update JSON editor when changed
    const ownerRefresh = () => {
        if (state.editors['create-session']) {
            const body = getEditorValue('create-session');
            if (typeof body === 'object') {
                const owner = getOwnerFields();
                body.foruser = owner.foruser;
                body.userFullName = owner.userFullName;
                if (owner.userEmail) body.userEmail = owner.userEmail;
                else delete body.userEmail;
                setEditorValue('create-session', body);
            }
        }
    };
    const displaynameRefresh = () => {
        if (state.editors['create-session']) {
            const body = getEditorValue('create-session');
            if (typeof body === 'object') {
                body.displayname = getSessionDisplayName();
                setEditorValue('create-session', body);
            }
        }
    };
    ['cfg-foruser', 'cfg-userfullname', 'cfg-userEmail'].forEach(id => {
        const $el = $('#' + id);
        if ($el.length) $el.on('input', () => {
            ownerRefresh();
            if (id === 'cfg-foruser') { $('#navbar-foruser-id').val($el.val()); _updateNavSub('navbar-foruser-id-display', $el.val()); }
            saveAppState();
        });
    });
    const $dnEl = $('#cfg-displayname');
    if ($dnEl.length) $dnEl.on('input', () => { displaynameRefresh(); saveAppState(); });

    // Regenerate user button - picks a new random name and fills foruser/fullname/email
    $('#btn-regenerate-user').on('click', () => {
        const user = generateRandomUser();
        $('#cfg-foruser').val(user.foruser);
        $('#cfg-userfullname').val(user.userFullName);
        $('#cfg-userEmail').val(user.userEmail);
        state.userId = user.foruser;
        $('#navbar-foruser-id').val(user.foruser);
        _updateNavSub('navbar-foruser-id-display', user.foruser);
        ownerRefresh();
        saveAppState();
    });

    // Bind session ID input
    const $sessionInput = $('#manual-session-id');
    if ($sessionInput.length) {
        $sessionInput.on('keydown', e => {
            if (e.key === 'Enter') applyManualSessionId();
        });
    }

    // Init webhook viewer in sidebar (before Monaco so URL is available for default JSON body)
    state.webhookViewer = new window.WebhookViewer('#sidebar-webhook-container');
    state.webhookViewer.setProvider(state.webhookProvider);
    // Pass CORS proxy URL so webhook providers can be reached from localhost
    var corsProxyUrl = $('#cfg-cors-proxy').is(':checked') ? ($('#cfg-cors-proxy-url').val() || 'http://localhost:9009/?') : null;
    if (corsProxyUrl) state.webhookViewer.setCorsProxy(corsProxyUrl);
    window.webhookViewer = state.webhookViewer; // for inline onclick handlers

    state.webhookViewer.onUrlCreated = handleWebhookReady;
    state.webhookViewer.onError = handleWebhookError;

    // Only create endpoint and start polling if webhook relay is enabled
    if ($('#cfg-webhooks').is(':checked')) {
        state.webhookViewer.createEndpoint().then(url => {
            if (url) state.webhookViewer.startPolling();
        });
    }

    // Webhooks toggle in step 1 - sync with sidebar toggle and session JSON
    const $webhooksToggle = $('#cfg-webhooks');
    if ($webhooksToggle.length) {
        $webhooksToggle.on('change', () => {
            const checked = $webhooksToggle.is(':checked');
            const $providerGroup = $('#webhook-provider-group');
            if ($providerGroup.length) $providerGroup.css('display', checked ? '' : 'none');
            $('#webhook-relay-warning').toggleClass('d-none', !checked);

            if (!checked) {
                state._corsIssueWebhook = false;
                toggleWebhookSection(false);
            } else {
                // Re-enable: reinit webhook to retry connection and probe
                reinitWebhook();
            }

            reconcileWebhookCorsState();
            saveAppState();
            updateSelectedProfile();
        });
        // Show warning if already enabled on load
        if ($webhooksToggle.is(':checked')) {
            $('#webhook-relay-warning').removeClass('d-none');
        }
    }

    // Init Monaco
    initMonaco();

    // Update headers display
    updateHeadersDisplay();

    // file:// hint: local docs can't be fetched via fetch()
    if (window.location.protocol === 'file:') {
        const $hintEl = $('#file-delivery-hint');
        if ($hintEl.length) $hintEl.html('<i class="bi bi-exclamation-triangle"></i> ' +
            'Running from <code>file://</code> - base64/upload requires serving via HTTP ' +
            '(<code>npx serve docs</code>). Use your own file or URL mode instead.');
    }

    // Init PDF viewer
    if (window.PdfViewer) {
        state.pdfViewer = new window.PdfViewer();
    }

    // Restore extern options from localStorage
    restoreExternOptions();

    // Handle hash navigation
    handleHashNavigation();
    $(window).on('hashchange', handleHashNavigation);

    // Track operation sub-tab switches
    $('#operation-tabs').on('shown.bs.tab', 'button[data-bs-toggle="tab"]', function () {
        if (state.currentStep === 3) {
            const target = $(this).data('bs-target'); // e.g. #op-status
            const subTab = target ? target.replace('#op-', '') : '';
            if (subTab) history.replaceState(null, '', '#step3/' + subTab);
        }
    });

    // Dark mode
    initDarkMode();

    // Persist state on page unload so editor content is not lost
    window.addEventListener('beforeunload', () => saveAppState());
}

function handleHashNavigation() {
    const hash = window.location.hash;
    const match = hash.match(/^#step(\d)(?:\/(.+))?$/);
    if (match) {
        const step = parseInt(match[1]);
        const subTab = match[2];
        if (step >= 1 && step <= 4) {
            if (step !== state.currentStep) {
                goToStep(step, true);
            }
            // Activate sub-tab on step 3 (operations)
            if (step === 3 && subTab) {
                const $tab = $(`#operation-tabs button[data-bs-target="#op-${subTab}"]`);
                if ($tab.length) {
                    const tab = new bootstrap.Tab($tab[0]);
                    tab.show();
                }
            }
            // Focus navbar session ID input if navigating to step 3 with no session
            if (step === 3 && !state.sessionId) {
                setTimeout(() => $('#navbar-session-id').focus(), 300);
            }
        }
    }
}

'use strict';

/* ==========================================================================
   Drag-Drop, Dark Mode, Webhook Provider, Polling, Feature Search
   ========================================================================== */



// =====================================================================
// Global Drag-and-Drop
// =====================================================================

function initDragDrop() {
    const overlay = document.getElementById('drop-overlay');
    if (!overlay) return;
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) overlay.classList.add('active');
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            overlay.classList.remove('active');
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('active');

        const file = e.dataTransfer.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showToast('Only PDF files are supported', 'warning');
            return;
        }

        ingestFile(file);
    });
}

// =====================================================================
// Reset
// =====================================================================

function resetRequestBody(editorId) {
    if (editorId === 'create-session') {
        setEditorValue('create-session', getDefaultCreateSessionBody());
        applyBrandingCSS();
        applyBrandingLogos();
    }
}

// =====================================================================
// Dark mode
// =====================================================================

function initDarkMode() {
    // Default to dark mode; respect saved preference if set
    let dark = true;
    try {
        const saved = localStorage.getItem('insign-dark-mode');
        if (saved !== null) dark = saved === 'true';
    } catch { /* ignore */ }
    applyDarkMode(dark);
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyDarkMode(!isDark);
    try { localStorage.setItem('insign-dark-mode', String(!isDark)); } catch { /* ignore */ }
}

function applyDarkMode(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

    // Update button icon
    const $btn = $('#btn-dark-mode');
    if ($btn.length) $btn.html(dark ? '<i class="bi bi-sun me-2"></i>Toggle light mode' : '<i class="bi bi-moon me-2"></i>Toggle dark mode');

    // Switch Monaco theme (global - applies to all editor instances)
    if (state.monacoReady && window.monaco) {
        monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
    }
}

// =====================================================================
// Public API (for inline onclick handlers)
// =====================================================================

/** Toggle pin state on a feature description panel */
function toggleDescPin(descId, infoId) {
    const $desc = $('#' + descId);
    const $icon = $('#' + infoId);
    if (!$desc.length) return;
    $desc.toggleClass('pinned');
    if ($icon.length) $icon.toggleClass('pinned');
}

// =====================================================================
// Webhook Provider Management
// =====================================================================

function buildWebhookProviderDropdown() {
    var $menu = $('#wh-dd-menu');
    if (!$menu.length) return;
    var html = '';
    Object.keys(WEBHOOK_PROVIDERS).forEach(function (key) {
        var p = WEBHOOK_PROVIDERS[key];
        var sel = key === state.webhookProvider ? ' wh-dd-item-selected' : '';
        html += '<div class="wh-dd-item' + sel + '" data-wh="' + key + '" onclick="window.app.setWebhookProvider(\'' + key + '\')">'
            + buildWhItemHtml(key, p)
            + '</div>';
    });
    $menu.html(html);

    // Update button and detail panel
    updateWhDetailPanel();

    // Probe all providers once in background
    var customUrl = ($('#cfg-webhook-custom-url').val() || '').trim();
    Object.keys(WEBHOOK_PROVIDERS).forEach(function (key) {
        var p = WEBHOOK_PROVIDERS[key];
        if (p.needsCustomUrl) {
            // For cfworker/custom, probe the user-entered URL instead of the static one
            if (customUrl) probeWebhookProvider(key, customUrl);
        } else if (p.url) {
            probeWebhookProvider(key, p.url);
        }
    });

    // Toggle
    var $toggle = $('#wh-dd-toggle');
    $toggle.off('click.whdd').on('click.whdd', function (e) {
        e.stopPropagation();
        $menu.toggleClass('open');
        $toggle.toggleClass('open');
    });
    $(document).off('click.whdd').on('click.whdd', function (e) {
        if (!$(e.target).closest('#wh-dropdown').length) {
            $menu.removeClass('open');
            $toggle.removeClass('open');
        }
    });
}

function probeWebhookProvider(key, url) {
    var $dots = $('[data-wh-probe="' + key + '"]');
    $dots.attr('class', 'wh-probe-dot wh-probe-pending');
    fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(5000) })
        .then(function () {
            $('[data-wh-probe="' + key + '"]').attr('class', 'wh-probe-dot wh-probe-ok').attr('title', 'Reachable');
        })
        .catch(function () {
            $('[data-wh-probe="' + key + '"]').attr('class', 'wh-probe-dot wh-probe-fail').attr('title', 'Unreachable');
        });
}

/** Build the rich selected-item HTML (same layout as dropdown items) */
function buildWhItemHtml(key, p, extra) {
    var iconHtml = p.favicon
        ? '<img src="' + p.favicon + '" width="16" height="16" alt="" style="image-rendering:auto">'
        : '<i class="bi ' + p.icon + '"></i>';
    var isSelfHosted = (key === 'custom' || key === 'cfworker' || key === 'valtown' || key === 'denodeploy');
    var secBadge = isSelfHosted
        ? '<span class="wh-dd-sec wh-dd-sec-safe"><i class="bi bi-shield-check"></i> your control</span>'
        : '<span class="wh-dd-sec wh-dd-sec-pub"><i class="bi bi-globe2"></i> public 3rd party</span>';
    var linkHtml = p.url ? '<a class="wh-dd-item-link" href="' + p.url + '" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="bi bi-box-arrow-up-right"></i> ' + p.url.replace('https://', '') + '</a>' : '';
    var scriptHtml = p.scriptUrl ? '<a class="wh-dd-item-link" href="' + p.scriptUrl + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" download><i class="bi bi-download"></i> Get script</a>' : '';
    return '<div class="wh-dd-item-icon-wrap">' + iconHtml + '</div>'
        + '<div class="wh-dd-item-body">'
        + '<div class="wh-dd-item-title">' + p.label + ' <span class="wh-dd-tag wh-dd-tag-' + p.tag.toLowerCase() + '">' + p.tag + '</span>'
        + ' <span class="wh-probe-dot" data-wh-probe="' + key + '"></span></div>'
        + '<div class="wh-dd-item-desc">' + p.desc + '</div>'
        + '<div class="wh-dd-item-footer">' + secBadge + linkHtml + scriptHtml + '</div>'
        + '</div>'
        + (extra || '');
}

function updateWhDetailPanel() {
    var key = state.webhookProvider;
    var cur = WEBHOOK_PROVIDERS[key] || WEBHOOK_PROVIDERS.smee;

    // Render the selected item as a rich card in the toggle area
    var chevron = '<i class="bi bi-chevron-down wh-dd-chevron"></i>';
    $('#wh-dd-toggle').html(buildWhItemHtml(key, cur, chevron));

    // Re-sync probe dot from menu (if already probed)
    var $menuDot = $('#wh-dd-menu [data-wh-probe="' + key + '"]');
    if ($menuDot.length && $menuDot.attr('class')) {
        $('#wh-dd-toggle [data-wh-probe="' + key + '"]').attr('class', $menuDot.attr('class'));
    }
}

/** Called when webhook endpoint creation succeeds */
function handleWebhookReady(url) {
    state.webhookUrl = url;
    state._corsIssueWebhook = false;
    reconcileWebhookCorsState();
    saveAppState();
}

/** Called when webhook endpoint creation fails */
function handleWebhookError(message) {
    state.webhookUrl = null;
    state._corsIssueWebhook = !!(message && message.includes('Failed to fetch'));
    reconcileWebhookCorsState();
    saveAppState();
}

/**
 * Single reconciliation function. Called whenever any webhook/CORS setting
 * or probe result changes. Derives the correct end-state from scratch:
 *
 * - CORS proxy switch: always visible (no conditions)
 * - Webhook sidebar:   visible only when relay enabled AND on step 3+
 * - serverSidecallbackURL in JSON: present only when relay enabled AND url available
 * - CORS hint banner:  visible when any recent CORS/connection issue detected
 */
function reconcileWebhookCorsState() {
    const webhooksOn = $('#cfg-webhooks').is(':checked');
    const onStep3Plus = state.currentStep >= 3;
    const url = state.webhookUrl;

    // 1. Webhook sidebar section: visible when enabled AND on step 3+
    $('#section-webhooks').toggleClass('d-none', !(webhooksOn && onStep3Plus));
    if (webhooksOn && onStep3Plus) {
        toggleWebhookSection($('#sidebar-webhooks-toggle').is(':checked'));
    }

    // 2. serverSidecallbackURL in JSON: present only when enabled AND url available
    if (webhooksOn && url) {
        updateSessionJsonWebhookUrl(url);
    } else {
        updateSessionJsonWebhookUrl(null);
    }

    // 3. CORS hint banners: show each independently based on what's failing
    $('#cors-hint-banner-api').toggleClass('d-none', !state._corsIssueApi);
    $('#cors-hint-banner-webhook').toggleClass('d-none', !(state._corsIssueWebhook && webhooksOn));
}

/** Update serverSidecallbackURL in the create-session editor */
function updateSessionJsonWebhookUrl(url) {
    if (!state.editors['create-session']) return;
    const body = getEditorValue('create-session');
    if (typeof body !== 'object') return;
    if (url) {
        body.serverSidecallbackURL = url;
        body.serversideCallbackMethod = 'POST';
        body.serversideCallbackContenttype = 'json';
    } else {
        delete body.serverSidecallbackURL;
        delete body.serversideCallbackMethod;
        delete body.serversideCallbackContenttype;
    }
    setEditorValue('create-session', body);
}

function setWebhookProvider(provider) {
    state.webhookProvider = provider;
    const info = WEBHOOK_PROVIDERS[provider] || WEBHOOK_PROVIDERS['webhook.site'];

    // Update dropdown selection and detail panel
    $('#wh-dd-menu .wh-dd-item').each(function () {
        $(this).toggleClass('wh-dd-item-selected', $(this).data('wh') === provider);
    });
    $('#wh-dd-menu').removeClass('open');
    $('#wh-dd-toggle').removeClass('open');
    updateWhDetailPanel();

    // Show/hide custom URL input
    const $customGroup = $('#webhook-custom-url-group');
    if ($customGroup.length) $customGroup.css('display', info.needsCustomUrl ? '' : 'none');

    if (info.needsCustomUrl && provider !== 'valtown' && provider !== 'cfworker' && provider !== 'denodeploy') {
        // Custom provider: update state and session JSON with user-entered URL
        if (state.webhookViewer) state.webhookViewer.stopPolling();
        const customUrl = ($('#cfg-webhook-custom-url').val() || '').trim();
        state.webhookUrl = customUrl || null;
        updateSessionJsonWebhookUrl(customUrl || null);
    } else {
        // Auto-managed providers (including valtown/cfworker which need channel creation)
        reinitWebhook();
    }

    saveAppState();
    updateSelectedProfile();
}

function onWebhookCustomUrlChange() {
    var customUrl = ($('#cfg-webhook-custom-url').val() || '').trim();
    // Probe the user-entered URL
    if (customUrl) {
        var key = state.webhookProvider;
        probeWebhookProvider(key, customUrl);
    }
    // For relay providers (valtown, cfworker), reinit to create channel at new URL
    if (state.webhookProvider === 'valtown' || state.webhookProvider === 'denodeploy' || state.webhookProvider === 'cfworker') {
        if (customUrl) reinitWebhook();
        return;
    }
    // Update state and session JSON
    if (customUrl) {
        state.webhookUrl = customUrl;
        updateSessionJsonWebhookUrl(customUrl);
    }
    // Re-apply current provider with the new URL
    setWebhookProvider(state.webhookProvider);
}

function reinitWebhook() {
    if (state.webhookViewer) {
        state.webhookViewer.destroy();
    }
    state.webhookViewer = new window.WebhookViewer('#sidebar-webhook-container');
    state.webhookViewer.setProvider(state.webhookProvider);
    var corsProxyUrl = $('#cfg-cors-proxy').is(':checked') ? ($('#cfg-cors-proxy-url').val() || 'http://localhost:9009/?') : null;
    if (corsProxyUrl) state.webhookViewer.setCorsProxy(corsProxyUrl);

    // Pass custom URL to relay providers that need a base URL
    var customUrl = ($('#cfg-webhook-custom-url').val() || '').trim();
    if (state.webhookProvider === 'valtown' && customUrl) {
        state.webhookViewer.setValtownUrl(customUrl);
    } else if (state.webhookProvider === 'denodeploy' && customUrl) {
        state.webhookViewer.setDenoDeployUrl(customUrl);
    } else if (state.webhookProvider === 'cfworker' && customUrl) {
        state.webhookViewer.setCfWorkerUrl(customUrl);
    }

    window.webhookViewer = state.webhookViewer;
    state.webhookViewer.onUrlCreated = handleWebhookReady;
    state.webhookViewer.onError = handleWebhookError;
    state.webhookViewer.createEndpoint().then(url => {
        if (url) state.webhookViewer.startPolling();
    });
}

// Keep old name as alias for any remaining references
function reinitSmeeWebhook() { reinitWebhook(); }

// =====================================================================
// Status Polling (fallback when webhooks disabled)
// =====================================================================

var _pollInterval = null;
var _pollCountdownStart = null;
var _pollCountdownRAF = null;
var _lastPollBody = null; // parsed object for deep diff
var _pollIntervalMs = 15000;

function getPollingIntervalMs() {
    return _pollIntervalMs;
}

function onPollingIntervalChange(val) {
    _pollIntervalMs = parseInt(val, 10) * 1000;
    const label = document.getElementById('polling-interval-label');
    if (label) label.textContent = val + 's';
    // Restart polling with new interval if currently running
    if (_pollInterval) {
        clearInterval(_pollInterval);
        _pollInterval = setInterval(pollNow, _pollIntervalMs);
        _pollCountdownStart = Date.now();
        startCountdownAnimation();
    }
}

function startStatusPolling() {
    stopStatusPolling();
    pollNow();
    _pollInterval = setInterval(pollNow, _pollIntervalMs);
    startCountdownAnimation();
    updatePollingToggleButton(true);
}

function stopStatusPolling() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
    if (_pollCountdownRAF) { cancelAnimationFrame(_pollCountdownRAF); _pollCountdownRAF = null; }
    updatePollingToggleButton(false);
}

function togglePolling() {
    if (_pollInterval) {
        stopStatusPolling();
        const $statusText = $('#polling-status-text');
        if ($statusText.length) $statusText.text('Paused');
    } else {
        startStatusPolling();
    }
}

function updatePollingToggleButton(running) {
    const $btn = $('#btn-polling-toggle');
    if (!$btn.length) return;
    if (running) {
        $btn.html('<i class="bi bi-arrow-repeat polling-spin"></i> Polling')
            .removeClass('btn-polling-paused');
    } else {
        $btn.html('<i class="bi bi-hourglass-split"></i> Paused')
            .addClass('btn-polling-paused');
    }
}

function startCountdownAnimation() {
    _pollCountdownStart = Date.now();
    const slider = document.getElementById('polling-interval-slider');
    if (!slider) return;

    function animate() {
        const elapsed = Date.now() - _pollCountdownStart;
        const thumbPct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        const fillPct = Math.min(thumbPct, (elapsed / _pollIntervalMs) * thumbPct);
        slider.style.setProperty('--poll-progress', fillPct + '%');
        if (elapsed < _pollIntervalMs && _pollInterval) {
            _pollCountdownRAF = requestAnimationFrame(animate);
        }
    }
    animate();
}

const POLLING_ENDPOINT_DESCRIPTIONS = {
    '/get/status': 'Returns full document details, signature fields, roles and their signing status.',
    '/get/checkstatus': 'Quick check returning only the current signing state without document details.',
    '/get/externInfos': 'Returns per-user progress, link status and details for external signing sessions.',
    '/get/audit': 'Returns the audit trail with timestamped events - who signed, opened links, etc.',
};

function onPollingEndpointChange() {
    // Update description text
    const endpoint = (document.getElementById('polling-endpoint-select') || {}).value || '/get/status';
    const $desc = document.getElementById('polling-endpoint-desc');
    if ($desc) $desc.textContent = POLLING_ENDPOINT_DESCRIPTIONS[endpoint] || '';

    // Reset diff tracking when endpoint changes
    _lastPollBody = null;
    const $changes = $('#polling-changes');
    if ($changes.length) {
        $changes.html('<div class="text-center text-muted-sm py-3"><i class="bi bi-hourglass-split"></i> Waiting for status changes...</div>');
    }
    // If polling is active, poll immediately with the new endpoint
    if (_pollInterval) pollNow();
}

async function pollNow() {
    if (!state.sessionId || !state.apiClient) return;

    const $statusText = $('#polling-status-text');
    if ($statusText.length) $statusText.text('Polling...');

    // Reset countdown
    _pollCountdownStart = Date.now();
    startCountdownAnimation();

    try {
        const endpoint = (document.getElementById('polling-endpoint-select') || {}).value || '/get/status';
        const result = await state.apiClient.post(endpoint, { sessionid: state.sessionId });
        if (!result.ok) {
            if ($statusText.length) $statusText.text(`Error ${result.status}: ${result.statusText}`);
            return;
        }
        const body = result.body;

        if ($statusText.length) $statusText.text('Last poll: ' + new Date().toLocaleTimeString());

        // Resolve response schema for this polling endpoint
        let pollSchemaKey = state.schemaLoader
            ? state.schemaLoader.getResponseSchemaKey(endpoint, 'POST')
            : null;
        if (!pollSchemaKey) {
            const cleanEp = endpoint.split('?')[0];
            const matchedOp = Object.values(OPERATIONS).find(op =>
                op.path.split('?')[0] === cleanEp && (op.method || 'POST').toUpperCase() === 'POST'
            );
            if (matchedOp?.responseSchemaKey) pollSchemaKey = matchedOp.responseSchemaKey;
        }

        // First poll: show full status; subsequent polls: show diffs
        if (_lastPollBody === null && typeof body === 'object') {
            addPollFullCard(body, pollSchemaKey);
        } else if (_lastPollBody !== null && typeof body === 'object') {
            const diffs = jsonDiff(_lastPollBody, body);
            if (diffs.length > 0) {
                addPollChangeCard(diffs, pollSchemaKey);
            }
        }
        _lastPollBody = typeof body === 'object' ? JSON.parse(JSON.stringify(body)) : body;
    } catch (err) {
        if ($statusText.length) $statusText.text('Error: ' + (err.message || err));
    }
}

/**
 * Deep-diff two JSON objects. Returns array of { path, oldVal, newVal, type }.
 * type: 'changed' | 'added' | 'removed'
 */
function jsonDiff(oldObj, newObj, prefix) {
    prefix = prefix || '';
    const diffs = [];

    // Diff arrays element-by-element
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
        const maxLen = Math.max(oldObj.length, newObj.length);
        for (let i = 0; i < maxLen; i++) {
            const path = prefix + '[' + i + ']';
            if (i >= oldObj.length) {
                diffs.push({ path, oldVal: undefined, newVal: newObj[i], type: 'added' });
            } else if (i >= newObj.length) {
                diffs.push({ path, oldVal: oldObj[i], newVal: undefined, type: 'removed' });
            } else if (typeof oldObj[i] === 'object' && oldObj[i] !== null && typeof newObj[i] === 'object' && newObj[i] !== null) {
                diffs.push(...jsonDiff(oldObj[i], newObj[i], path));
            } else if (JSON.stringify(oldObj[i]) !== JSON.stringify(newObj[i])) {
                diffs.push({ path, oldVal: oldObj[i], newVal: newObj[i], type: 'changed' });
            }
        }
        return diffs;
    }

    const allKeys = new Set([
        ...(oldObj && typeof oldObj === 'object' ? Object.keys(oldObj) : []),
        ...(newObj && typeof newObj === 'object' ? Object.keys(newObj) : [])
    ]);

    for (const key of allKeys) {
        const path = prefix ? prefix + '.' + key : key;
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];

        if (oldVal === undefined && newVal !== undefined) {
            diffs.push({ path, oldVal: undefined, newVal, type: 'added' });
        } else if (oldVal !== undefined && newVal === undefined) {
            diffs.push({ path, oldVal, newVal: undefined, type: 'removed' });
        } else if (typeof oldVal === 'object' && oldVal !== null && typeof newVal === 'object' && newVal !== null) {
            // Recurse into nested objects AND arrays
            diffs.push(...jsonDiff(oldVal, newVal, path));
        } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            diffs.push({ path, oldVal, newVal, type: 'changed' });
        }
    }
    return diffs;
}

function formatDiffValue(val) {
    if (val === undefined) return '(absent)';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
}

function addPollFullCard(body, schemaKey) {
    const $container = $('#polling-changes');
    if (!$container.length) return;
    $container.find('.text-center').remove();

    const time = new Date().toLocaleTimeString();
    const bodyHtml = (schemaKey && state.schemaLoader && typeof body === 'object')
        ? renderJsonWithTooltips(body, schemaKey)
        : escapeHtml(JSON.stringify(body, null, 2));

    const el = document.getElementById('tpl-poll-full-card').content.cloneNode(true).firstElementChild;
    el.querySelector('.webhook-time').textContent = time;
    el.querySelector('.poll-body-pre').innerHTML = bodyHtml;
    $container.prepend(el);
}

function addPollChangeCard(diffs, schemaKey) {
    const $container = $('#polling-changes');
    if (!$container.length) return;

    // Remove "waiting" placeholder
    $container.find('.text-center').remove();

    const time = new Date().toLocaleTimeString();

    const diffFragment = document.createDocumentFragment();
    for (const d of diffs) {
        const row = document.getElementById('tpl-poll-diff-row').content.cloneNode(true).firstElementChild;

        let bgColor, label, textColor;
        if (d.type === 'added') { bgColor = '#22863a'; label = '+'; textColor = '#aaffaa'; }
        else if (d.type === 'removed') { bgColor = '#b31d28'; label = '\u2212'; textColor = '#ffaaaa'; }
        else { bgColor = '#1b3a4b'; label = '~'; textColor = '#7ec8e3'; }

        row.style.background = bgColor;
        const labelEl = row.querySelector('.diff-label');
        labelEl.textContent = label;
        labelEl.style.color = textColor;

        // Path with optional schema tooltip
        const pathEl = row.querySelector('.diff-path');
        pathEl.style.color = '#79b8ff';
        pathEl.textContent = d.path;
        if (schemaKey && state.schemaLoader) {
            const info = state.schemaLoader.resolvePropertyDescription(schemaKey, d.path);
            if (info && info.description) {
                pathEl.className = 'json-key-hover diff-path';
                pathEl.dataset.desc = d.path + ': ' + info.description;
            }
        }

        // Value display
        const valueEl = row.querySelector('.diff-value');
        if (d.type === 'changed') {
            const oldSpan = document.createElement('span');
            oldSpan.style.cssText = 'color:#ff9999;text-decoration:line-through';
            oldSpan.textContent = formatDiffValue(d.oldVal);
            const arrow = document.createElement('span');
            arrow.style.color = '#888';
            arrow.textContent = ' \u2192 ';
            const newSpan = document.createElement('span');
            newSpan.style.cssText = 'color:#99ff99;font-weight:600';
            newSpan.textContent = formatDiffValue(d.newVal);
            valueEl.append(oldSpan, arrow, newSpan);
        } else if (d.type === 'added') {
            const span = document.createElement('span');
            span.style.cssText = 'color:#99ff99;font-weight:600';
            span.textContent = formatDiffValue(d.newVal);
            valueEl.appendChild(span);
        } else {
            const span = document.createElement('span');
            span.style.cssText = 'color:#ff9999;text-decoration:line-through';
            span.textContent = formatDiffValue(d.oldVal);
            valueEl.appendChild(span);
        }

        diffFragment.appendChild(row);
    }

    const el = document.getElementById('tpl-poll-change-card').content.cloneNode(true).firstElementChild;
    el.querySelector('.webhook-time').textContent = time;
    el.querySelector('[data-slot="change-count"]').textContent = diffs.length + ' change' + (diffs.length !== 1 ? 's' : '');
    el.querySelector('[data-slot="diff-rows"]').appendChild(diffFragment);
    $container.prepend(el);
}

// =====================================================================
// Feature Search / Filter
// =====================================================================

var _featureContainers = '#feature-toggles, #uncovered-properties';

function expandAllGroups() {
    $(_featureContainers).find('.feature-group .collapse').each(function () {
        if (!this.classList.contains('show')) {
            new bootstrap.Collapse(this, { toggle: true });
        }
    });
}

function collapseAllGroups() {
    $(_featureContainers).find('.feature-group .collapse.show').each(function () {
        new bootstrap.Collapse(this, { toggle: true });
    });
}

function filterFeatures(query) {
    const q = query.trim().toLowerCase();
    const clearBtn = document.getElementById('feature-search-clear');
    const countEl = document.getElementById('feature-search-count');
    if (clearBtn) clearBtn.style.display = q ? '' : 'none';

    const $containers = $(_featureContainers);
    const toggles = $containers.find('.feature-toggle').get();
    const groups = $containers.find('.feature-group').get();
    let matchCount = 0;
    let totalCount = toggles.length;

    if (!q) {
        toggles.forEach(t => t.style.display = '');
        groups.forEach(g => {
            g.style.display = '';
        });
        if (countEl) countEl.style.display = 'none';
        return;
    }

    const terms = q.split(/\s+/);

    toggles.forEach(t => {
        const searchData = t.getAttribute('data-search') || '';
        const match = terms.every(term => searchData.includes(term));
        t.style.display = match ? '' : 'none';
        if (match) matchCount++;
    });

    groups.forEach(g => {
        const visible = g.querySelectorAll('.feature-toggle:not([style*="display: none"])');
        if (visible.length > 0) {
            g.style.display = '';
            const collapse = g.querySelector('.collapse');
            if (collapse && !collapse.classList.contains('show')) {
                collapse.classList.add('show');
            }
        } else {
            g.style.display = 'none';
        }
    });

    if (countEl) {
        countEl.style.display = '';
        countEl.textContent = `${matchCount} of ${totalCount} features match`;
    }
}

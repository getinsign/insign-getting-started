'use strict';

/* ==========================================================================
   API Trace Sidebar, Window API & Boot
   ========================================================================== */


// =====================================================================
// API Trace sidebar
// =====================================================================

/** Recalculate main column width based on sidebar visibility */
function updateMainColumnWidth() {
    const $main = $('#main-column');
    const rightVisible = !$('#trace-column').hasClass('d-none');

    $main.removeClass('col-lg-6 col-lg-9 col-md-4 col-md-8');
    if (rightVisible) {
        $main.addClass('col-lg-9 col-md-8');
    }
}

/** Show the right sidebar (first call, or if not manually collapsed) */
function showTraceColumn() {
    if (state.sidebarCollapsed) return; // respect manual collapse
    const $col = $('#trace-column');
    if ($col.hasClass('d-none')) {
        $col.removeClass('d-none');
        $('#expand-right-sidebar').addClass('d-none');
        updateMainColumnWidth();
    }
}

// =====================================================================
// Copy to clipboard helper
// =====================================================================

/** Copy text to clipboard and show brief checkmark feedback on the button */
function copyJsonToClipboard(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = 'bi bi-check2';
            setTimeout(() => { icon.className = 'bi bi-clipboard'; }, 1500);
        }
    });
}

// =====================================================================
// JSON Hover Tooltips - for trace & polling <pre> elements
// =====================================================================

/**
 * Render a JSON object as syntax-highlighted HTML with hoverable keys.
 * Keys that have descriptions in the schema get a .json-key-hover span
 * with data-desc / data-md attributes for tooltip display.
 *
 * @param {*} obj - The parsed JSON value
 * @param {string|null} schemaKey - The schema key to look up descriptions
 * @param {string} [parentPath] - Internal: dot-path for nested resolution
 * @param {number} [indent] - Internal: current indentation level
 * @returns {string} HTML string
 */
function renderJsonWithTooltips(obj, schemaKey, parentPath, indent) {
    indent = indent || 0;
    parentPath = parentPath || '';
    const pad = '  '.repeat(indent);
    const pad1 = '  '.repeat(indent + 1);

    if (obj === null) return '<span class="json-null">null</span>';
    if (typeof obj === 'boolean') return '<span class="json-bool">' + obj + '</span>';
    if (typeof obj === 'number') return '<span class="json-num">' + obj + '</span>';
    if (typeof obj === 'string') {
        var MAX_STR = 120;
        if (obj.length > MAX_STR) {
            var truncated = escapeHtml(obj.substring(0, MAX_STR));
            var full = escapeHtml(obj);
            return '<span class="json-str" title="' + full.replace(/"/g, '&quot;') + '">"' + truncated + '<span class="json-ellipsis">...</span>"</span>';
        }
        return '<span class="json-str">"' + escapeHtml(obj) + '"</span>';
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.map((item, i) => {
            const childPath = parentPath ? parentPath + '[' + i + ']' : '[' + i + ']';
            return pad1 + renderJsonWithTooltips(item, schemaKey, childPath, indent + 1);
        });
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }

    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const entries = keys.map(key => {
            const childPath = parentPath ? parentPath + '.' + key : key;
            const valueHtml = renderJsonWithTooltips(obj[key], schemaKey, childPath, indent + 1);

            // Try to resolve description from schema
            let keyHtml;
            if (schemaKey && state.schemaLoader) {
                const info = state.schemaLoader.resolvePropertyDescription(schemaKey, childPath);
                if (info && (info.description || info.markdownDescription)) {
                    const desc = escapeHtml(info.description || '');
                    const typeBadge = info.type ? ' (' + escapeHtml(info.type) + ')' : '';
                    const enumInfo = info.enum ? ' - enum: ' + info.enum.map(v => escapeHtml(String(v))).join(', ') : '';
                    const tooltipText = escapeHtml(key) + typeBadge + (desc ? ': ' + desc : '') + enumInfo;
                    keyHtml = '<span class="json-key-hover" data-desc="' + tooltipText.replace(/"/g, '&quot;') + '">"' + escapeHtml(key) + '"</span>';
                } else {
                    keyHtml = '"' + escapeHtml(key) + '"';
                }
            } else {
                keyHtml = '"' + escapeHtml(key) + '"';
            }

            return pad1 + keyHtml + ': ' + valueHtml;
        });
        return '{\n' + entries.join(',\n') + '\n' + pad + '}';
    }

    return escapeHtml(String(obj));
}

/** Initialize the JSON hover tooltip on trace/polling containers */
function _initJsonHoverTooltip() {
    const tooltip = document.getElementById('json-hover-tooltip');
    if (!tooltip) return;

    $(document).on('mouseenter', '.json-key-hover', function (e) {
        const desc = this.getAttribute('data-desc');
        if (!desc) return;
        tooltip.textContent = desc;
        tooltip.style.display = 'block';
        _positionFloatTooltip(e, tooltip);
    }).on('mousemove', '.json-key-hover', function (e) {
        if (tooltip.style.display === 'none') return;
        _positionFloatTooltip(e, tooltip);
    }).on('mouseleave', '.json-key-hover', function () {
        tooltip.style.display = 'none';
    });
}

/** Render a single trace entry and prepend it to the list */
function renderTraceEntry(entry) {
    showTraceColumn();

    const $container = $('#trace-entries');
    $('#trace-empty').remove();

    const methodCls = 'trace-method-' + entry.method.toLowerCase();
    const statusCls = entry.ok ? 'trace-status-ok' : 'trace-status-err';
    const entryCls = entry.ok ? 'trace-ok' : 'trace-err';
    const time = new Date(entry.timestamp).toLocaleTimeString();

    // Format headers for display
    const fmtHeaders = (hdrs) => {
        if (!hdrs || !Object.keys(hdrs).length) return '<span style="opacity:0.5">none</span>';
        return Object.entries(hdrs).map(([k, v]) => {
            let display = v;
            // Truncate long auth values
            if (k.toLowerCase() === 'authorization' && display.length > 60) {
                display = display.substring(0, 40) + '...' + display.substring(display.length - 10);
            }
            return `<div><span class="th-name">${escapeHtml(k)}:</span> ${escapeHtml(display)}</div>`;
        }).join('');
    };

    // Look up endpoint description and schema keys from OpenAPI spec
    const pathInfo = state.schemaLoader ? state.schemaLoader.getPathInfo(entry.path, entry.method) : null;
    const reqSchemaKey = pathInfo?.requestSchemaKey || null;
    // Fall back to operations.json responseSchemaKey for endpoints the spec doesn't document
    let respSchemaKey = pathInfo?.responseSchemaKey || null;
    if (!respSchemaKey) {
        const cleanPath = entry.path.split('?')[0];
        const matchedOp = Object.values(OPERATIONS).find(op =>
            op.path.split('?')[0] === cleanPath && (op.method || 'POST').toUpperCase() === entry.method.toUpperCase()
        );
        if (matchedOp?.responseSchemaKey) respSchemaKey = matchedOp.responseSchemaKey;
    }

    // Format body for display - with schema-aware tooltips when available
    const fmtBody = (body, schemaKey) => {
        if (body === null || body === undefined) return '<span style="opacity:0.5">empty</span>';
        if (typeof body === 'object') {
            try {
                if (schemaKey && state.schemaLoader) {
                    return renderJsonWithTooltips(body, schemaKey);
                }
                return escapeHtml(JSON.stringify(body, null, 2));
            } catch { return escapeHtml(String(body)); }
        }
        // Try to parse string as JSON for tooltip rendering
        if (schemaKey && typeof body === 'string') {
            try {
                const parsed = JSON.parse(body);
                if (typeof parsed === 'object' && parsed !== null) {
                    return renderJsonWithTooltips(parsed, schemaKey);
                }
            } catch { /* not JSON, fall through */ }
        }
        return escapeHtml(String(body));
    };
    const descHtml = pathInfo && (pathInfo.summary || pathInfo.description)
        ? `<div class="trace-desc">${escapeHtml(pathInfo.summary || pathInfo.description)}</div>`
        : '';

    // Decode proxy URLs for display: "http://localhost:9009/?https%3A%2F%2F..." -> actual URL + proxy hint
    let displayUrl = entry.url;
    let isProxied = false;
    if (state.apiClient && state.apiClient.useCorsProxy && state.apiClient.corsProxyUrl) {
        const proxyPrefix = state.apiClient.corsProxyUrl;
        if (entry.url.startsWith(proxyPrefix)) {
            const encoded = entry.url.substring(proxyPrefix.length);
            try { displayUrl = decodeURIComponent(encoded); } catch (_) { displayUrl = encoded; }
            isProxied = true;
        }
    }

    const el = document.getElementById('tpl-trace-entry').content.cloneNode(true).firstElementChild;
    el.classList.add(entryCls);
    el.dataset.traceId = entry.id;

    const method = el.querySelector('.trace-method');
    method.textContent = entry.method;
    method.classList.add(methodCls);

    const path = el.querySelector('.trace-path');
    path.textContent = entry.path;
    path.title = entry.path;

    if (isProxied) {
        const badge = el.querySelector('.trace-proxy-badge');
        badge.classList.remove('d-none');
        badge.title = 'Routed through CORS proxy: ' + (state.apiClient ? state.apiClient.corsProxyUrl : '');
    }

    const status = el.querySelector('.trace-status');
    status.textContent = entry.status;
    status.classList.add(statusCls);

    el.querySelector('.trace-duration').textContent = entry.duration + 'ms';

    const descEl = el.querySelector('.trace-desc');
    if (descHtml) {
        descEl.classList.remove('d-none');
        descEl.textContent = pathInfo.summary || pathInfo.description;
    }

    el.querySelector('.trace-time').textContent = time;
    el.querySelector('.trace-url').textContent = displayUrl;
    el.querySelector('[data-slot="req-headers"]').innerHTML = fmtHeaders(entry.requestHeaders);
    el.querySelector('[data-slot="req-body"]').innerHTML = fmtBody(entry.requestBody, reqSchemaKey);
    el.querySelector('[data-slot="resp-headers"]').innerHTML = fmtHeaders(entry.responseHeaders);
    el.querySelector('[data-slot="resp-body"]').innerHTML = fmtBody(entry.responseBody, respSchemaKey);

    // Wire up copy buttons with full (untruncated) JSON data
    const copyBtns = el.querySelectorAll('.btn-copy-json');
    const bodies = [entry.requestBody, entry.responseBody];
    copyBtns.forEach((btn, i) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const data = bodies[i];
            const text = (data === null || data === undefined) ? ''
                : (typeof data === 'object') ? JSON.stringify(data, null, 2)
                : String(data);
            copyJsonToClipboard(btn, text);
        });
    });

    $container.prepend(el);
    const count = state.apiClient ? state.apiClient.getTraceLog().length : 0;
    $('#trace-count').text(count);
    $('#expand-trace-count').text(count).toggleClass('has-count', count > 0);
}

/** Clear all trace entries */
function clearTrace() {
    if (state.apiClient) state.apiClient.clearTraceLog();
    $('#trace-entries').html('<div class="text-center text-muted-sm py-3" id="trace-empty"><i class="bi bi-hourglass-split"></i> No API calls yet</div>');
    $('#trace-count').text('0');
    $('#expand-trace-count').text('').removeClass('has-count');
}

/** Hook the apiClient trace listener (called after apiClient is created) */
function hookTrace() {
    if (state.apiClient) {
        state.apiClient.onTrace(renderTraceEntry);
    }
}

/** Collapse the sidebar and show an expand tab on the edge */
function collapseSidebar() {
    state.sidebarCollapsed = true;
    $('#trace-column').addClass('d-none');
    $('#expand-right-sidebar').removeClass('d-none');
    updateMainColumnWidth();
}

/** Expand the sidebar */
function expandSidebar() {
    state.sidebarCollapsed = false;
    $('#trace-column').removeClass('d-none');
    $('#expand-right-sidebar').addClass('d-none');
    updateMainColumnWidth();
}

/** Toggle a sidebar section collapsed/expanded */
function toggleSection(name) {
    $('#section-' + name).toggleClass('collapsed');
}

/** Update the feature changed count badge on the collapsed header */
function _updateFeatureChangedCount() {
    const el = document.getElementById('feature-changed-count');
    if (!el) return;
    const saved = loadFeatureSettings();
    const count = Object.keys(saved).length;
    if (count > 0) {
        el.textContent = count + ' changed';
        el.style.display = '';
    } else {
        el.style.display = 'none';
    }
}

/** Reset all feature toggles back to default */
function resetAllFeatures() {
    saveFeatureSettings({});
    // Reset all toggle radios to "default"
    $('input[type="radio"][id$="-default"]').prop('checked', true);
    // Reset all text/select inputs
    $('.feature-input').val('');
    $('select[id^="ft-"]').each(function() { this.selectedIndex = 0; });
    // Remove feature keys from JSON body
    if (state.editors['create-session']) {
        const body = getEditorValue('create-session');
        if (typeof body === 'object') {
            delete body.guiProperties;
            delete body.signConfig;
            delete body.deliveryConfig;
            // Remove root-level feature keys
            for (const group of FEATURE_GROUPS) {
                for (const f of group.features) {
                    if (f.path === 'root') delete body[f.key];
                }
            }
            // Remove any uncovered root-level keys that were set
            $('#uncovered-properties input[id^="ft-"], #uncovered-properties select[id^="ft-"]').each(function() {
                const key = this.id.substring(3);
                delete body[key];
            });
            setEditorValue('create-session', body);
        }
    }
    _updateFeatureChangedCount();
}

/** Reset all branding (colors + logos) to defaults */
function resetBrandingAll() {
    removeColorScheme();
    resetLogos();
}

/** Update the branding header summary with color dots and logo icon */
function _updateBrandingHeaderSummary() {
    const el = document.getElementById('branding-header-summary');
    if (!el) return;

    // Check if "Default" color scheme is active (no custom CSS)
    const defaultSchemeActive = document.querySelector('.color-scheme-btn:first-child.active');

    let html = '';

    // Active logo set: show mail header logo (the bigger one)
    const activeCard = document.querySelector('.logo-set-card.active');
    if (activeCard) {
        const mailImg = activeCard.querySelector('.logo-set-mail') || activeCard.querySelector('.logo-set-login');
        if (mailImg && mailImg.src) {
            html += `<img class="branding-header-logo skeleton-pulse" src="${mailImg.src}" alt="" title="Active logo set" onload="this.classList.remove('skeleton-pulse')" onerror="this.classList.remove('skeleton-pulse')">`;
        }
    }

    // Color dots for primary, accent, dark, error (skip if default/no CSS)
    if (!defaultSchemeActive) {
        let dots = '';
        const colorIds = ['primary', 'accent', 'dark', 'error'];
        for (const id of colorIds) {
            const input = document.getElementById('brand-color-' + id);
            if (input && input.value) {
                dots += `<span class="branding-header-dot" style="background:${input.value}" title="${id}: ${input.value}"></span>`;
            }
        }
        if (dots) html += `<div class="branding-header-dots">${dots}</div>`;
    }

    el.innerHTML = html;
}

window.app = {
    createSession,
    createSessionAndOpen,
    openInSign,
    openSessionManager,
    executeOperation,
    executeFreeRequest,
    executeExtern,
    executeDownload,
    downloadDocumentSingle,
    previewDocumentSingle,
    toggleIncludeBiodata,
    uploadDocument,
    discoverFieldsAndRoles,
    setExternOption,
    updateFeature,
    toggleDescPin,
    filterFeatures,
    previewDocument,
    previewBlob,
    previewLastDownload: () => { if (state._lastDownloadBlob) previewBlob(state._lastDownloadBlob, 'Downloaded Document'); },
    copySessionId,
    goToStep,
    selectDocument,
    setFileDelivery,
    deleteDocItem,
    restoreDocItem,
    renameDocItem,
    startRenameDocItem,
    buildDocumentSelector,
    applyManualSessionId,
    applyNavbarSessionId,
    applyNavbarForuser,
    resetRequestBody,
    toggleDarkMode,
    setWebhookProvider,
    onWebhookCustomUrlChange,
    pollNow,
    onPollingEndpointChange,
    onPollingIntervalChange,
    togglePolling,
    toggleWebhookSection,
    togglePollingSection,
    // Authentication
    setAuthMode,
    executeOAuth2Token,
    clearOAuth2Token,
    // Branding
    selectColorScheme,
    removeColorScheme,
    updateBrandColor,
    applyBrandingCSS,
    resetBranding,
    resetBrandingAll,
    resetAllFeatures,
    selectLogoSet,
    resetLogos,
    updateBrandLogo,
    uploadBrandLogo,
    expandAllGroups,
    collapseAllGroups,
    // Trace
    clearTrace,
    // Sidebar
    collapseSidebar,
    expandSidebar,
    toggleSection
};

// =====================================================================
// Boot
// =====================================================================

$(init);

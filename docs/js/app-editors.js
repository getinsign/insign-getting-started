'use strict';

/* ==========================================================================
   Monaco Editor Utilities, Step Navigation, Session Management
   ========================================================================== */

/** Update a navbar subtext display span (truncated to 20 chars) */
function _updateNavSub(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const s = (val || '').trim();
    el.textContent = s.length > 20 ? s.slice(0, 20) + '\u2026' : s;
}


/** Add word-wrap toggle hint (bottom-right) + Alt+Z keybinding to a Monaco editor */
function setupEditorWrapToggle(editor, container) {
    const hint = document.createElement('span');
    hint.className = 'editor-wrap-hint';
    hint.title = 'Toggle word wrap (Alt+Z)';
    container.style.position = 'relative';
    container.appendChild(hint);

    function updateHint() {
        const on = editor.getOption(monaco.editor.EditorOption.wordWrap) !== 'off';
        hint.textContent = on ? 'wrap: on (Alt+Z)' : 'wrap: off (Alt+Z)';
        hint.classList.toggle('wrap-off', !on);
    }
    updateHint();

    function toggleWrap() {
        const on = editor.getOption(monaco.editor.EditorOption.wordWrap) !== 'off';
        editor.updateOptions({ wordWrap: on ? 'off' : 'on' });
        updateHint();
    }

    hint.addEventListener('click', toggleWrap);

    editor.addAction({
        id: 'toggle-word-wrap',
        label: 'Toggle Word Wrap',
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
        run: toggleWrap
    });
}

/** Auto-resize a Monaco editor to fit its content (clamped to container max-height) */
function autoResizeEditor(editor, container, uncapped) {
    const MAX_HEIGHT = uncapped ? Infinity : 600;
    const MIN_HEIGHT = 60;
    const PADDING = 10; // extra pixels to avoid scrollbar appearing

    if (uncapped) $(container).addClass('no-max-height');

    function resize() {
        const contentHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, editor.getContentHeight() + PADDING));
        $(container).css('height', contentHeight + 'px');
        editor.layout();
    }

    editor.onDidContentSizeChange(resize);
    // Initial sizing
    resize();
}

/** Add a copy-to-clipboard button in the top-right corner of an editor container */
function addEditorCopyButton(editor, container) {
    const btn = document.createElement('button');
    btn.className = 'btn-copy-json btn-copy-editor';
    btn.title = 'Copy to clipboard';
    btn.innerHTML = '<i class="bi bi-clipboard"></i>';
    btn.addEventListener('click', () => {
        copyJsonToClipboard(btn, editor.getValue());
    });
    container.style.position = 'relative';
    container.appendChild(btn);
}

/**
 * Force the suggest details panel to always expand when suggestions appear.
 * Monaco persists collapsed/expanded state internally and may override the
 * detailsVisible editor option. This workaround ensures the docs panel is
 * visible on the very first Ctrl+Space without requiring a second press.
 */
/**
 * Add a mouse-following hover tooltip to a Monaco JSON editor.
 * Disables Monaco's built-in hover widget and instead shows the same
 * floating tooltip used by trace/polling panels (#json-hover-tooltip).
 */
function addFloatingHover(editor, schemaKey) {
    if (!schemaKey) return;
    const tooltip = document.getElementById('json-hover-tooltip');
    if (!tooltip) return;

    // Disable Monaco's built-in hover widget
    editor.updateOptions({ hover: { enabled: false } });

    let lastKey = null;

    const editorDom = editor.getDomNode();
    editorDom.addEventListener('mousemove', function (e) {
        const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
        if (!target || !target.position) {
            if (lastKey !== null) { lastKey = null; tooltip.style.display = 'none'; }
            return;
        }

        const model = editor.getModel();
        if (!model) return;

        // Resolve the JSON property path at this position
        const pos = target.position;
        const line = model.getLineContent(pos.lineNumber);

        // Check if cursor is on a JSON key (quoted string before a colon)
        const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
        if (!keyMatch) {
            if (lastKey !== null) { lastKey = null; tooltip.style.display = 'none'; }
            return;
        }

        // Build the full dotted path by walking up from current line
        const propPath = _resolveJsonPath(model, pos.lineNumber);
        if (!propPath || propPath === lastKey) {
            if (propPath) _positionFloatTooltip(e, tooltip);
            return;
        }

        lastKey = propPath;

        // Look up the schema description
        if (!state.schemaLoader) { tooltip.style.display = 'none'; return; }
        const info = state.schemaLoader.resolvePropertyDescription(schemaKey, propPath);
        if (!info || (!info.description && !info.markdownDescription)) {
            tooltip.style.display = 'none';
            return;
        }

        const typeBadge = info.type ? ' (' + info.type + ')' : '';
        const enumInfo = info.enum ? '\nenum: ' + info.enum.join(', ') : '';
        const leafKey = propPath.includes('.') ? propPath.split('.').pop() : propPath;
        tooltip.textContent = leafKey + typeBadge + ': ' + (info.description || '') + enumInfo;
        tooltip.style.display = 'block';
        _positionFloatTooltip(e, tooltip);
    });

    editorDom.addEventListener('mouseleave', function () {
        lastKey = null;
        tooltip.style.display = 'none';
    });
}

/**
 * Resolve the full dotted JSON path for the key at a given line.
 * Walks upward through the model to find parent keys by indentation.
 */
function _resolveJsonPath(model, lineNumber) {
    const segments = [];
    let currentIndent = Infinity;

    for (let i = lineNumber; i >= 1; i--) {
        const line = model.getLineContent(i);
        const match = line.match(/^(\s*)"([^"]+)"\s*:/);
        if (!match) continue;

        const indent = match[1].length;
        if (indent < currentIndent) {
            segments.unshift(match[2]);
            currentIndent = indent;
            if (indent === 0) break;
        }
    }

    return segments.length ? segments.join('.') : null;
}

function forceSuggestDetails(editor) {
    // Force the details/docs panel open whenever the suggest widget appears.
    // Monaco persists collapsed state internally and may ignore detailsVisible.
    // We use the suggest controller's onDidShow event to toggle exactly once
    // per show - avoiding the infinite loop a MutationObserver would cause.
    try {
        var ctrl = editor.getContribution('editor.contrib.suggestController');
        var w = ctrl && (ctrl.widget?.value || ctrl.widget);
        if (w && typeof w.toggleDetails === 'function') {
            w.onDidShow(() => {
                var dom = editor.getDomNode();
                var el = dom && dom.querySelector('.suggest-widget');
                if (el && !el.classList.contains('docs-side')) {
                    try { w.toggleDetails(); } catch {}
                }
            });
        }
    } catch {}
}

function createEditor(id, defaultValue, schemaKey, opts) {
    const container = $('#editor-' + id)[0];
    if (!container) return null;
    const uncapped = opts && opts.uncapped;

    // URI must be unique per editor, but the filename part must match the schema's fileMatch
    const filename = schemaKey ? schemaKey + '.json' : id + '.json';
    const modelUri = monaco.Uri.parse('insign://models/' + id + '/' + filename);

    const model = monaco.editor.createModel(
        JSON.stringify(defaultValue, null, 2),
        'json',
        modelUri
    );

    const editorOpts = {
        model,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs',
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        formatOnPaste: true,
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        fixedOverflowWidgets: true,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, alwaysConsumeMouseWheel: false },
        suggest: {
            showInlineDetails: true,
            detailsVisible: true,
            preview: true,
            showStatusBar: true
        },
        quickSuggestions: {
            other: true,
            strings: true
        }
    };

    // For uncapped editors, disable internal scrolling - the page scrolls instead
    if (uncapped) {
        editorOpts.scrollbar.vertical = 'hidden';
        editorOpts.scrollbar.handleMouseWheel = false;
    }

    const editor = monaco.editor.create(container, editorOpts);

    forceSuggestDetails(editor);
    addFloatingHover(editor, schemaKey);
    addEditorCopyButton(editor, container);
    autoResizeEditor(editor, container, uncapped);
    state.editors[id] = editor;
    return editor;
}

function createReadOnlyEditor(id, content, language, opts) {
    const container = $('#editor-' + id)[0];
    if (!container) return null;
    const uncapped = opts && opts.uncapped;
    const schemaKey = opts && opts.schemaKey;

    // If a schemaKey is provided and language is json, create a model with
    // a URI whose filename matches the schema's fileMatch pattern so Monaco
    // picks up validation, autocomplete & hover descriptions automatically.
    let model = null;
    if (schemaKey && (!language || language === 'json')) {
        const filename = schemaKey + '.json';
        const modelUri = monaco.Uri.parse('insign://models/' + id + '/' + filename);
        model = monaco.editor.createModel(content || '', 'json', modelUri);
    }

    const editorOpts = {
        language: language || 'json',
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs',
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        readOnly: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        fixedOverflowWidgets: true,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, alwaysConsumeMouseWheel: false },
        suggest: {
            showInlineDetails: true,
            detailsVisible: true,
            preview: true,
            showStatusBar: true
        },
        quickSuggestions: {
            other: true,
            strings: true
        }
    };

    if (model) {
        editorOpts.model = model;
    } else {
        editorOpts.value = content;
    }

    if (uncapped) {
        editorOpts.scrollbar.vertical = 'hidden';
        editorOpts.scrollbar.handleMouseWheel = false;
    }

    const editor = monaco.editor.create(container, editorOpts);

    forceSuggestDetails(editor);
    addFloatingHover(editor, schemaKey);
    addEditorCopyButton(editor, container);
    autoResizeEditor(editor, container, uncapped);
    state.editors[id] = editor;
    return editor;
}

function setEditorValue(id, value, language) {
    const editor = state.editors[id];
    if (!editor) return;

    // Prevent bidirectional sync loop when we programmatically set the editor
    if (id === 'create-session') state._editorSyncLock = true;

    if (language) {
        const model = editor.getModel();
        if (model) monaco.editor.setModelLanguage(model, language);
    }

    const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    editor.setValue(content);

    if (id === 'create-session') setTimeout(() => { state._editorSyncLock = false; }, 50);
}

function getEditorValue(id) {
    const editor = state.editors[id];
    if (!editor) return null;
    try {
        return JSON.parse(editor.getValue());
    } catch {
        return editor.getValue();
    }
}

function showResponseEditor(id, response, schemaKey) {
    // Create response editor if not exists
    const editorId = id + '-response';
    const container = $('#editor-' + editorId)[0];
    if (!container) return;

    // Detect language: JSON for objects/arrays, plaintext for other strings
    const isObject = typeof response === 'object' && response !== null;
    let language = 'json';
    if (!isObject && typeof response === 'string') {
        try { JSON.parse(response); } catch { language = 'plaintext'; }
    }

    if (!state.editors[editorId]) {
        createReadOnlyEditor(editorId, '', language, { schemaKey: schemaKey || null });
    } else if (schemaKey) {
        // If the editor already exists but didn't have a schema, re-associate
        // its model with the schema by updating the model URI
        const editor = state.editors[editorId];
        const model = editor.getModel();
        const expectedFilename = schemaKey + '.json';
        if (model && !model.uri.path.endsWith('/' + expectedFilename)) {
            // Dispose old model and create a new one with the correct URI
            const content = isObject ? JSON.stringify(response, null, 2) : response;
            const modelUri = monaco.Uri.parse('insign://models/' + editorId + '/' + expectedFilename);
            const newModel = monaco.editor.createModel(content, 'json', modelUri);
            editor.setModel(newModel);
            model.dispose();
            return; // Content already set via new model
        }
    }

    const content = isObject ? JSON.stringify(response, null, 2) : response;
    setEditorValue(editorId, content, language);
}

// =====================================================================
// Step navigation
// =====================================================================

function goToStep(step, skipHash) {
    state.currentStep = step;

    // Remove early-init CSS override (injected in <head> to prevent flash)
    const earlyCss = document.getElementById('early-step-css');
    if (earlyCss) earlyCss.remove();

    // Update URL hash without triggering hashchange
    if (!skipHash) {
        let newHash = '#step' + step;
        if (step === 3) {
            const $active = $('#operation-tabs button.nav-link.active');
            const target = $active.data('bs-target');
            if (target) newHash += '/' + target.replace('#op-', '');
        }
        if (window.location.hash !== newHash) {
            history.replaceState(null, '', newHash);
        }
    }

    // Update step indicators
    $('.step-indicator .step').each(function () {
        const $el = $(this);
        const s = parseInt($el.data('step'));
        $el.removeClass('active');
        if (s === step) $el.addClass('active');
    });

    // Show/hide main panels (4 steps now)
    $('#step-1-panel').toggleClass('d-none', step !== 1);
    $('#step-2-panel').toggleClass('d-none', step !== 2);
    $('#step-3-panel').toggleClass('d-none', step !== 3);
    $('#step-4-panel').toggleClass('d-none', step !== 4);

    // Shine animation on feature configurator when entering step 2
    if (step === 2) {
        const $box = $('#step-2-panel .feature-configurator-box').first();
        $box.removeClass('shine');
        // Force reflow so re-adding the class restarts the animation
        void $box[0]?.offsetWidth;
        $box.addClass('shine');
    }

    // Show polling section in right sidebar for step 3+
    $('#section-polling').toggleClass('d-none', step < 3);
    // Reconcile webhook sidebar + CORS hint state
    reconcileWebhookCorsState();

    // Once a session exists or step 3 has been visited, the sidebar stays visible
    // (user can still collapse/expand it manually). On first visit to step 3,
    // auto-open the sidebar.
    if (step === 3) {
        state.sidebarActivated = true;
        if (!state.sidebarCollapsed) {
            $('#trace-column').removeClass('d-none');
            $('#expand-right-sidebar').addClass('d-none');
        }
        updateSidebarMode();
    }
    // If sidebar was never activated yet, keep it hidden on other steps
    if (!state.sidebarActivated) {
        $('#trace-column').addClass('d-none');
        $('#expand-right-sidebar').addClass('d-none');
    }

    updateMainColumnWidth();
}

/** Activate sidebar-step2: start whichever sections are enabled */
function updateSidebarMode() {
    const $whToggle = $('#sidebar-webhooks-toggle');
    const $pollToggle = $('#sidebar-polling-toggle');
    if ($whToggle.is(':checked')) toggleWebhookSection(true);
    if ($pollToggle.is(':checked')) togglePollingSection(true);
}

/** Enable/disable the webhook section independently */
function toggleWebhookSection(enabled) {
    const $content = $('#sidebar-webhook-content');
    const $badge = $('#webhook-live-badge');
    if ($content.length) $content.css('display', enabled ? '' : 'none');

    if (enabled) {
        if (state.webhookViewer && !state.webhookViewer.eventSource) {
            state.webhookViewer.startPolling();
        }
        if ($badge.length) $badge.css('display', '');
    } else {
        if (state.webhookViewer) state.webhookViewer.stopPolling();
        if ($badge.length) $badge.css('display', 'none');
    }
    saveAppState();
}

/** Enable/disable the polling section independently */
function togglePollingSection(enabled) {
    const $content = $('#sidebar-polling-content');
    if ($content.length) $content.css('display', enabled ? '' : 'none');

    if (enabled) {
        startStatusPolling();
    } else {
        stopStatusPolling();
    }
    saveAppState();
}

/** Apply a session ID from the manual input field */
function applyManualSessionId() {
    const $input = $('#manual-session-id');
    if (!$input.length) return;
    const id = $input.val().trim();
    if (!id) return;
    setSessionId(id, null);
}

/** Set the active session (from create response or manual input) */
function setSessionId(sessionId, accessURL, fromCreateSession, accessURLProcessManagement) {
    const isNewSession = sessionId && sessionId !== state.sessionId;
    state.sessionId = sessionId;
    state.accessURL = accessURL;
    if (accessURLProcessManagement) state.accessURLProcessManagement = accessURLProcessManagement;

    // Activate sidebar once a session exists
    if (sessionId && !state.sidebarActivated) {
        state.sidebarActivated = true;
        showTraceColumn();
    }
    // Save session ID for callback page lookup
    if (typeof saveCallbackSession === 'function') saveCallbackSession();

    // Update session ID displays
    $('#active-session-id').text(sessionId);
    $('#manual-session-id').val(sessionId);

    // Update session bar (hidden inputs + display spans)
    $('#navbar-session-id').val(sessionId);
    _updateNavSub('navbar-session-id-display', sessionId);
    // Show foruser in the bar
    const foruserVal = ($('#cfg-foruser').val() || '').trim() || state.userId || '';
    $('#navbar-foruser-id').val(foruserVal);
    _updateNavSub('navbar-foruser-id-display', foruserVal);

    // Open in inSign requires a session ID; Session Manager only needs a foruser
    const hasSession = !!sessionId;
    $('#navbar-btn-open').toggleClass('d-none', !hasSession);
    const hasForuser = !!(state.lastForuser || ($('#cfg-foruser').val() || '').trim() || state.userId);
    $('#navbar-btn-session-mgr').toggleClass('d-none', !(hasSession || hasForuser));
    $('#btn-goto-step2, #btn-floating-goto-step2').removeClass('d-none');

    // Reset histories and create new webhook URL for new sessions
    // But skip regeneration when coming from createSession - the URL was already sent
    if (isNewSession) {
        resetSessionHistories();
        if (!fromCreateSession) {
            regenerateWebhookForSession();
        }
    }

    // Update operation editors
    updateOperationEditors();
    updateCodeSnippets();

    // Persist
    saveAppState();
}

/** Clear polling and webhook histories when session changes */
function resetSessionHistories() {
    // Reset polling
    _lastPollBody = null;
    $('#polling-changes').html(
        '<div class="text-center text-muted-sm py-3"><i class="bi bi-hourglass-split"></i> Waiting for status changes...</div>'
    );

    // Reset webhook requests
    if (state.webhookViewer) {
        state.webhookViewer.requests = [];
        state.webhookViewer.renderRequests();
    }
}

/** Create a new webhook endpoint and inject it into the session JSON */
function regenerateWebhookForSession() {
    if (!state.webhookViewer) return;
    if (!$('#cfg-webhooks').is(':checked')) return;

    reinitWebhook();
    showToast('New webhook URL generated for this session.', 'info');
}

/** Show a brief toast notification */
function showToast(message, type) {
    type = type || 'info';
    const colors = { info: 'var(--insign-blue)', success: 'var(--insign-success)', warning: '#e4a11b' };
    const icons = { info: 'bi-info-circle', success: 'bi-check-circle', warning: 'bi-exclamation-triangle' };
    const $toast = $('<div>')
        .css({
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
            background: 'var(--insign-card-bg, #23272b)', color: 'var(--insign-text, #fff)', padding: '10px 16px',
            borderRadius: '8px', fontSize: '0.85rem', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            borderLeft: '4px solid ' + (colors[type] || colors.info),
            opacity: 0, transition: 'opacity 0.3s'
        })
        .html('<i class="bi ' + (icons[type] || icons.info) + ' me-2"></i>' + message)
        .appendTo('body');

    requestAnimationFrame(() => $toast.css('opacity', 1));
    setTimeout(() => $toast.css('opacity', 0), 3500);
    setTimeout(() => $toast.remove(), 4000);
}

/** Apply session ID from navbar input */
function applyNavbarSessionId() {
    const $input = $('#navbar-session-id');
    if (!$input.length) return;
    const id = $input.val().trim();
    if (!id) return;
    setSessionId(id, null);
}

/** Apply foruser from navbar input - syncs back to cfg-foruser, JSON editor, and state */
function applyNavbarForuser() {
    const val = ($('#navbar-foruser-id').val() || '').trim();
    if (!val) return;
    $('#cfg-foruser').val(val);
    state.lastForuser = val;
    state.userId = val;
    // Sync to JSON editor
    if (state.editors['create-session']) {
        const body = getEditorValue('create-session');
        if (typeof body === 'object') {
            body.foruser = val;
            setEditorValue('create-session', body);
        }
    }
    saveAppState();
}

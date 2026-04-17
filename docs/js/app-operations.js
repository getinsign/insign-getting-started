'use strict';

/* ==========================================================================
   Create Session, Operations, External Signing, Download/Upload
   ========================================================================== */


// =====================================================================
// Step 1: Create Session
// =====================================================================

async function createSessionAndOpen() {
    await createSession(true);
}

async function createSession(andOpen) {
    const $btn = $('#btn-create-session');
    const $btnOpen = $('#btn-create-session-open');
    const $floatBtns = $('#floating-actions-step2 .btn-floating');
    $btn.prop('disabled', true);
    $btnOpen.prop('disabled', true);
    $floatBtns.prop('disabled', true);
    $btn.html('<span class="spinner-insign"></span> Sending...');

    const body = getEditorValue('create-session');

    // Handle file delivery: resolve <filedata> placeholder
    let fileDataForUpload = null;
    if (typeof body === 'object' && body.documents) {
        for (const doc of body.documents) {
            if (doc.file === '<filedata>') {
                // Base64 mode: fetch file and embed
                try {
                    $btn.html('<span class="spinner-insign"></span> Loading file...');
                    const fileData = await loadDocumentData();
                    doc.file = fileData.base64;
                    delete doc.fileURL;
                } catch (err) {
                    showCreateSessionError('Failed to load document: ' + err.message);
                    $btn.prop('disabled', false);
                    $btnOpen.prop('disabled', false);
                    $floatBtns.prop('disabled', false);
                    $btn.html('<i class="bi bi-send"></i> Send Request');
                    return;
                }
            }
        }

        // Upload mode: strip file refs, we'll upload after session creation
        if (state.fileDelivery === 'upload') {
            try {
                $btn.html('<span class="spinner-insign"></span> Loading file...');
                const fileData = await loadDocumentData();
                fileDataForUpload = { base64: fileData.base64, blob: fileData.blob, name: getDocumentFilename() };
            } catch (err) {
                showCreateSessionError('Failed to load document: ' + err.message);
                $btn.prop('disabled', false);
                $btnOpen.prop('disabled', false);
                $floatBtns.prop('disabled', false);
                $btn.html('<i class="bi bi-send"></i> Send Request');
                return;
            }
        }
    }

    $btn.html('<span class="spinner-insign"></span> Sending...');
    state.lastForuser = body.foruser || '';
    saveAppState();

    // Resolve <logo:*> placeholders with actual data URLs before sending
    const logoMap = {
        icon:  { key: 'message.start.logo.url.editor.desktop', path: 'guiProperties', placeholder: '<logo:icon>' },
        mail:  { key: 'message.mt.header.image',               path: 'guiProperties', placeholder: '<logo:mail>' },
        login: { key: 'logoExtern',                            path: 'root',          placeholder: '<logo:login>' }
    };
    for (const [slot, cfg] of Object.entries(logoMap)) {
        const dataUrl = state.brandLogoData[slot];
        if (!dataUrl) continue;
        if (cfg.path === 'guiProperties' && body.guiProperties?.[cfg.key] === cfg.placeholder) {
            body.guiProperties[cfg.key] = dataUrl;
        } else if (cfg.path === 'root' && body[cfg.key] === cfg.placeholder) {
            body[cfg.key] = dataUrl;
        }
    }

    const result = await state.apiClient.post('/configure/session', body);

    // Store last request for code generation (show placeholder, not raw base64)
    const bodyForSnippet = JSON.parse(JSON.stringify(body));
    if (typeof bodyForSnippet === 'object' && bodyForSnippet.documents) {
        for (const doc of bodyForSnippet.documents) {
            if (doc.file && doc.file.length > 100) {
                doc.file = '<filedata>';
            }
        }
    }
    // Restore logo placeholders for snippet display
    for (const [slot, cfg] of Object.entries(logoMap)) {
        if (!state.brandLogoData[slot]) continue;
        if (cfg.path === 'guiProperties' && bodyForSnippet.guiProperties?.[cfg.key]?.startsWith('data:')) {
            bodyForSnippet.guiProperties[cfg.key] = cfg.placeholder;
        } else if (cfg.path === 'root' && bodyForSnippet[cfg.key]?.startsWith('data:')) {
            bodyForSnippet[cfg.key] = cfg.placeholder;
        }
    }
    state.lastRequest = { method: 'POST', path: '/configure/session', body: bodyForSnippet };

    // Show response
    const $responsePanel = $('#step1-response');
    $responsePanel.removeClass('d-none');

    const $statusEl = $('#step1-response-status');
    $statusEl.attr('class', 'response-status ' + (result.ok ? 'success' : 'error'));
    $statusEl.html(`
        <strong>${result.status}</strong> ${result.statusText}
        <span class="ms-auto text-muted-sm">${result.duration}ms</span>
    `);

    const createSessionRespSchema = (state.schemaLoader
        ? state.schemaLoader.getResponseSchemaKey('/configure/session', 'POST')
        : null) || 'sessionStatus';
    showResponseEditor('create-session', result.body, createSessionRespSchema);

    if (result.ok && result.body) {
        const respBody = typeof result.body === 'object' ? result.body : {};

        // Upload mode: now upload the file to the session
        if (respBody.sessionid && fileDataForUpload && state.fileDelivery === 'upload') {
            $btn.html('<span class="spinner-insign"></span> Uploading file...');
            const docId = (body.documents && body.documents[0] && body.documents[0].id) || 'contract-1';
            const uploadBlob = fileDataForUpload.blob || new Blob([Uint8Array.from(atob(fileDataForUpload.base64), c => c.charCodeAt(0))], { type: 'application/pdf' });
            const file = new File([uploadBlob], fileDataForUpload.name, { type: 'application/pdf' });
            const uploadResult = await state.apiClient.upload('/configure/uploaddocument', file, {
                sessionid: respBody.sessionid,
                docid: docId,
                filename: fileDataForUpload.name
            });

            if (!uploadResult.ok) {
                showResponseEditor('create-session', {
                    _note: 'Session created, but file upload failed',
                    sessionResponse: result.body,
                    uploadError: { status: uploadResult.status, body: uploadResult.body }
                });
            }
        }

        if (respBody.sessionid) {
            setSessionId(respBody.sessionid, respBody.accessURL, true, respBody.accessURLProcessManagement);

            // "Send & Open" - immediately open inSign in new tab
            if (andOpen && respBody.accessURL) {
                window.open(respBody.accessURL, '_blank');
            }

            const $step2Btns = $('#btn-goto-step2, #btn-floating-goto-step2');
            if ($step2Btns.length && !$step2Btns.first().hasClass('d-none')) {
                $step2Btns.html('<i class="bi bi-arrow-right"></i> Operate &amp; Trace');
            }
        }
    }

    $btn.prop('disabled', false);
    $btnOpen.prop('disabled', false);
    $floatBtns.prop('disabled', false);
    $btn.html('<i class="bi bi-send"></i> Send Request');
}

function showCreateSessionError(message) {
    const $responsePanel = $('#step1-response');
    $responsePanel.removeClass('d-none');
    const $statusEl = $('#step1-response-status');
    $statusEl.attr('class', 'response-status error');
    $statusEl.html(`<strong>Error</strong> ${message}`);
    showResponseEditor('create-session', { error: message });
}

/** Get a SSO JWT for the current foruser via /configure/createSSOForApiuser */
async function getSSOJwt() {
    const foruser = state.lastForuser || ($('#cfg-foruser').val() || '').trim() || state.userId;
    if (!foruser) return '';
    // Endpoint returns text/plain - must set Accept header accordingly
    const result = await state.apiClient.call('POST', '/configure/createSSOForApiuser', {
        body: { id: foruser },
        accept: 'text/plain'
    });
    if (result.ok && result.body) {
        return typeof result.body === 'string' ? result.body : '';
    }
    return '';
}

function postToNewTab(url, params) {
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = '_blank';
    Object.keys(params).forEach(function (key) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = params[key];
        form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

    // Trace the form POST so it appears in the API trace sidebar
    if (state.apiClient) {
        var path;
        try { path = new URL(url).pathname; } catch (_) { path = url; }
        // Redact jwt from traced body
        var tracedParams = Object.assign({}, params);
        if (tracedParams.jwt) tracedParams.jwt = tracedParams.jwt.substring(0, 20) + '...';
        state.apiClient._trace({
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            timestamp: new Date().toISOString(),
            method: 'POST',
            path: path,
            url: url,
            requestHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
            requestBody: tracedParams,
            status: 'N/A',
            statusText: 'Form POST to new tab',
            ok: true,
            responseHeaders: {},
            responseBody: null,
            duration: 0
        });
    }
}

async function openInSign() {
    if (!state.sessionId) return;
    const baseUrl = state.apiClient.baseUrl || $('#cfg-base-url').val();
    try {
        const jwt = await getSSOJwt();
        if (jwt) {
            postToNewTab(baseUrl + '/index', { jwt: jwt, sessionid: state.sessionId });
            return;
        }
    } catch (e) { /* fallback to stored accessURL */ }
    if (state.accessURL) window.open(state.accessURL, '_blank');
}

async function openSessionManager() {
    const baseUrl = state.apiClient.baseUrl || $('#cfg-base-url').val();
    try {
        const jwt = await getSSOJwt();
        if (jwt) {
            postToNewTab(baseUrl + '/start', { jwt: jwt });
            return;
        }
    } catch (e) { /* fallback to stored URL */ }
    if (state.accessURLProcessManagement) window.open(state.accessURLProcessManagement, '_blank');
}

// =====================================================================
// Step 2: Operations
// =====================================================================

async function executeOperation(opKey) {
    const opDef = OPERATIONS[opKey];
    if (!opDef) return;

    const editorId = 'op-' + opKey;
    let body = null;

    if (opDef.getBody) {
        body = getEditorValue(editorId);
    }

    // Show loading
    const $responseDiv = $(`.op-response[data-op="${opKey}"]`);

    let result;
    const callOpts = {};
    if (opDef.accept) callOpts.accept = opDef.accept;

    if (opDef.method === 'GET') {
        result = await state.apiClient.call('GET', opDef.path, callOpts);
    } else if (opDef.queryParams && body && typeof body === 'object') {
        const qs = new URLSearchParams(body).toString();
        const url = opDef.path + (opDef.path.includes('?') ? '&' : '?') + qs;
        result = await state.apiClient.call(opDef.method, url, callOpts);
    } else if (opDef.formParams && body) {
        const obj = typeof body === 'string' ? JSON.parse(body) : body;
        const qs = new URLSearchParams(obj).toString();
        const url = opDef.path + (opDef.path.includes('?') ? '&' : '?') + qs;
        result = await state.apiClient.call(opDef.method, url, callOpts);
    } else {
        result = await state.apiClient.call(opDef.method, opDef.path, { body, ...callOpts });
    }

    // Store last request
    state.lastRequest = { method: opDef.method, path: opDef.path, body };

    // Show response
    if ($responseDiv.length) {
        $responseDiv.removeClass('d-none');
    }

    const $statusEl = $(`.response-status[data-op="${opKey}"]`);
    if ($statusEl.length) {
        $statusEl.attr('class', 'response-status ' + (result.ok ? 'success' : 'error'));
        $statusEl.html(`
            <strong>${result.status}</strong> ${result.statusText}
            <span class="ms-auto text-muted-sm">${result.duration}ms</span>
        `);
    }

    // Show response in Monaco editor
    const $responseEditorContainer = $('#editor-' + editorId + '-response');

    // Look up response schema from OpenAPI spec, fall back to operations.json hint
    const respSchemaKey = (state.schemaLoader
        ? state.schemaLoader.getResponseSchemaKey(opDef.path, opDef.method)
        : null) || opDef.responseSchemaKey || null;

    if ($responseEditorContainer.length) {
        showResponseEditor(editorId, result.body || result.raw, respSchemaKey);
    }

    // If load returned an accessURL, update state so "Open in inSign" works
    if (opKey === 'load' && result.ok && result.body) {
        const resp = typeof result.body === 'object' ? result.body : {};
        if (resp.accessURL) {
            state.accessURL = resp.accessURL;
            $('#navbar-btn-open').removeClass('d-none').attr('title', resp.accessURL);
        }
        if (resp.accessURLProcessManagement) {
            state.accessURLProcessManagement = resp.accessURLProcessManagement;
            $('#navbar-btn-session-mgr').removeClass('d-none');
        }
    }

    // Update code snippets
    updateCodeSnippets();
}

// =====================================================================
// Free Request
// =====================================================================

async function executeFreeRequest() {
    const method = $('#free-method').val() || 'POST';
    const endpoint = $('#free-endpoint').val() || '/';
    const contentType = $('#free-content-type').val() || 'application/json';
    const accept = $('#free-accept').val() || 'application/json';

    let body = null;
    if (method !== 'GET' && state.editors['op-free']) {
        body = getEditorValue('op-free');
    }

    const result = await state.apiClient.call(method, endpoint, {
        body,
        contentType,
        accept
    });

    state.lastRequest = { method, path: endpoint, body };

    const $responseDiv = $(`.op-response[data-op="free"]`);
    if ($responseDiv.length) $responseDiv.removeClass('d-none');

    const $statusEl = $(`.response-status[data-op="free"]`);
    if ($statusEl.length) {
        $statusEl.attr('class', 'response-status ' + (result.ok ? 'success' : 'error'));
        $statusEl.html(`
            <strong>${result.status}</strong> ${result.statusText}
            <span class="ms-auto text-muted-sm">${result.duration}ms</span>
        `);
    }

    const $responseEditorContainer = $('#editor-op-free-response');
    if ($responseEditorContainer.length) {
        showResponseEditor('op-free', result.body);
    }

    updateCodeSnippets();
}

// =====================================================================
// External Signing - Smart Flow
// =====================================================================

/** Discover document fields & roles, then pre-populate the extern body */
async function discoverFieldsAndRoles() {
    if (!state.sessionId) {
        alert('Create a session first (Step 1) or enter a session ID.');
        return;
    }

    const result = await state.apiClient.post('/get/status', { sessionid: state.sessionId });
    if (!result.ok) {
        const $info = $('#extern-fields-info');
        if ($info.length) {
            $info.css('display', '');
            $info.css('background', 'rgba(220,53,69,0.08)');
            $('#extern-fields-summary').html(
                '<span style="color:var(--insign-danger)">Failed to query status: ' + result.status + ' ' + result.statusText + '</span>');
        }
        return;
    }

    // Parse signature fields from /get/status response (signaturFieldsStatusList)
    const body = result.body;
    const roles = new Set();
    const fields = [];
    const sigFields = body.signaturFieldsStatusList || [];

    const roleDetails = {};  // role -> { displayname, email }

    for (const sig of sigFields) {
        const role = sig.role || sig.quickInfoParsedRole || sig.fieldID || '';
        const name = sig.displayname || sig.quickinfo || sig.fieldID || role;
        const required = sig.mandatory !== false;
        const signed = !!sig.signed;
        if (role) {
            roles.add(role);
            // Capture first displayname/email we find per role
            if (!roleDetails[role]) {
                const externRole = sig.externRole || '';
                roleDetails[role] = {
                    displayname: sig.displayname || sig.quickInfoParsedName || '',
                    email: sig.email || (externRole.indexOf('@') !== -1 ? externRole : '')
                };
            }
        }
        fields.push({ role, name, required, signed });
    }

    // Only keep roles that have at least one unsigned field
    const unsignedRoles = new Set();
    for (const f of fields) {
        if (!f.signed && f.role) unsignedRoles.add(f.role);
    }
    state.discoveredRoles = Array.from(unsignedRoles);
    state.discoveredRoleDetails = roleDetails;
    state.discoveredFields = fields;

    // Show summary
    const $info = $('#extern-fields-info');
    if ($info.length) {
        $info.css('display', '');
        $info.css('background', 'rgba(248,169,9,0.08)');
        const $summary = $('#extern-fields-summary');
        if (fields.length === 0) {
            $summary.html('No signature fields found in the document. The document may use SIG-tags (detected at signing time).');
            // Fall back to document catalog info
            const selDoc = getSelectedDocument();
            if (selDoc.useExternRole && selDoc.externRoles) {
                $summary.html($summary.html() + '<br>Document uses <strong>externRole</strong> (email matching): <strong>' + selDoc.externRoles.join(', ') + '</strong>');
                state.discoveredRoles = selDoc.roles;
            } else if (selDoc.roles && selDoc.roles.length > 0) {
                $summary.html($summary.html() + '<br>Document catalog roles: <strong>' + selDoc.roles.join(', ') + '</strong>');
                state.discoveredRoles = selDoc.roles;
            }
        } else {
            const signedCount = fields.filter(f => f.signed).length;
            const reqCount = fields.filter(f => f.required).length;
            const optCount = fields.length - reqCount;
            const fieldBadges = fields.map(f => {
                const cls = f.signed ? 'bg-success' : (f.required ? 'bg-primary' : 'bg-secondary');
                return `<span class="badge ${cls} me-1">${f.name}</span>`;
            }).join('');
            const parts = [`${fields.length} signature field(s)`, `${reqCount} required`, `${optCount} optional`];
            if (signedCount > 0) parts.push(`${signedCount} signed`);
            $summary.html(parts.join(' &bull; ') + '<br>' + fieldBadges);
        }
    }

    // Build extern body from discovered roles
    buildExternBodyFromRoles();
}

/** Read current extern option from the button group */
function getExternOption(key) {
    const $group = $('#extern-opt-' + key);
    const $active = $group.find('.active');
    if ($active.length === 0 || $active.hasClass('mixed')) return null;
    return $active.data('val') === true || $active.data('val') === 'true';
}

/** Set extern option: update buttons and sync to all externUsers in JSON */
function setExternOption(key, value) {
    // Update button group
    const $group = $('#extern-opt-' + key);
    $group.find('button').removeClass('active mixed');
    $group.find(`button[data-val="${value}"]`).addClass('active');

    // Save to localStorage
    saveExternOptions();

    // Sync to JSON editor
    if (!state.editors['op-extern']) return;
    const body = getEditorValue('op-extern');
    if (typeof body !== 'object') return;

    if (key === 'inOrder') {
        // inOrder is a top-level field, not per-user
        body.inOrder = value;
        // When sequential signing is toggled, add/remove orderNumber on each user
        if (Array.isArray(body.externUsers)) {
            if (value) {
                body.externUsers.forEach((u, i) => { u.orderNumber = i + 1; });
            } else {
                body.externUsers.forEach(u => { delete u.orderNumber; });
            }
        }
    } else if (Array.isArray(body.externUsers)) {
        for (const user of body.externUsers) {
            user[key] = value;
        }
        // When SMS is toggled, add/remove the recipientsms phone number
        // Placeholder: Swiss mobile (+41 79 555 00 xx) - fictitious but format-valid.
        // US 555 numbers are widely blacklisted; this passes inSign validation.
        if (key === 'sendSMS') {
            for (const user of body.externUsers) {
                if (value) {
                    if (!user.recipientsms) user.recipientsms = '+417955500' + String(body.externUsers.indexOf(user)).padStart(2, '0');
                } else {
                    delete user.recipientsms;
                }
            }
        }
    }
    setEditorValue('op-extern', body);
}

function saveExternOptions() {
    if (loadProfiles().length === 0) return; // only persist when user has saved profiles
    const opts = {};
    for (const key of ['sendEmails', 'singleSignOnEnabled', 'sendSMS', 'inOrder']) {
        const val = getExternOption(key);
        if (val !== null) opts[key] = val;
    }
    try { localStorage.setItem('insign-extern-options', JSON.stringify(opts)); } catch { /* ignore */ }
}

function restoreExternOptions() {
    try {
        const stored = JSON.parse(localStorage.getItem('insign-extern-options'));
        if (!stored) return;
        for (const key of ['sendEmails', 'singleSignOnEnabled', 'sendSMS', 'inOrder']) {
            if (key in stored) {
                const $group = $('#extern-opt-' + key);
                $group.find('button').removeClass('active mixed');
                $group.find(`button[data-val="${stored[key]}"]`).addClass('active');
            }
        }
    } catch { /* ignore */ }
}

/** Sync extern option buttons from current JSON editor state */
function syncExternOptionsFromJson() {
    if (!state.editors['op-extern']) return;
    const body = getEditorValue('op-extern');
    if (typeof body !== 'object') return;

    // Per-user options
    if (Array.isArray(body.externUsers) && body.externUsers.length > 0) {
        for (const key of ['sendEmails', 'singleSignOnEnabled', 'sendSMS']) {
            const $group = $('#extern-opt-' + key);
            if (!$group.length) continue;

            const values = body.externUsers.map(u => u[key]);
            const allSame = values.every(v => v === values[0]);

            $group.find('button').removeClass('active mixed');
            if (allSame) {
                $group.find(`button[data-val="${values[0]}"]`).addClass('active');
            } else {
                $group.find('button').addClass('mixed');
            }
        }
    }

    // Top-level inOrder option
    const $inOrder = $('#extern-opt-inOrder');
    if ($inOrder.length && body.inOrder !== undefined) {
        $inOrder.find('button').removeClass('active mixed');
        $inOrder.find(`button[data-val="${body.inOrder}"]`).addClass('active');
    }
}

/** Build extern/beginmulti body using discovered or catalog roles */
function buildExternBodyFromRoles() {
    const roles = state.discoveredRoles || [];

    const sendEmails = getExternOption('sendEmails') !== false;
    const sendSMS = getExternOption('sendSMS') === true;
    const singleSignOnEnabled = getExternOption('singleSignOnEnabled') !== false;
    const opts = { sendEmails, sendSMS, singleSignOnEnabled };

    const externUsers = roles.map(role => _randomExternUser(role, opts));

    if (externUsers.length === 0) {
        externUsers.push(
            _randomExternUser('seller', opts),
            _randomExternUser('buyer', opts)
        );
    }

    const inOrder = getExternOption('inOrder') === true;
    // When sequential signing is enabled, each user needs an orderNumber
    if (inOrder) {
        externUsers.forEach((u, i) => { u.orderNumber = i + 1; });
    }
    // When SMS is enabled, each user needs a recipientsms phone number
    // Placeholder: Swiss mobile (+41 79 555 00 xx) - fictitious but format-valid.
    // US 555 numbers are widely blacklisted; this passes inSign validation.
    if (sendSMS) {
        externUsers.forEach((u, i) => { if (!u.recipientsms) u.recipientsms = '+417955500' + String(i).padStart(2, '0'); });
    }
    const body = {
        sessionid: state.sessionId || '<session-id>',
        externUsers,
        inOrder
    };

    if (state.editors['op-extern']) {
        setEditorValue('op-extern', body);
    }
    syncExternOptionsFromJson();
}

/** Execute extern/beginmulti and render signing links */
async function executeExtern() {
    const body = getEditorValue('op-extern');

    const result = await state.apiClient.post('/extern/beginmulti', body);
    state.lastRequest = { method: 'POST', path: '/extern/beginmulti', body };

    const $responseDiv = $('.op-response[data-op="extern"]');
    if ($responseDiv.length) $responseDiv.removeClass('d-none');

    const $statusEl = $('.response-status[data-op="extern"]');
    if ($statusEl.length) {
        $statusEl.attr('class', 'response-status ' + (result.ok ? 'success' : 'error'));
        $statusEl.html(`
            <strong>${result.status}</strong> ${result.statusText}
            <span class="ms-auto text-muted-sm">${result.duration}ms</span>
        `);
    }

    const externRespSchema = (state.schemaLoader
        ? state.schemaLoader.getResponseSchemaKey('/extern/beginmulti', 'POST')
        : null) || 'sessionStatus';
    showResponseEditor('op-extern', result.body, externRespSchema);

    // Render signing links if present
    const $linksDiv = $('#extern-signing-links');
    if ($linksDiv.length && result.ok && result.body) {
        const resp = result.body;
        const users = resp.externUsers || [];
        // Merge request body data (name, phone, flags) with response (links)
        let reqUsers = [];
        try { reqUsers = (typeof body === 'string' ? JSON.parse(body) : body).externUsers || []; } catch (e) { /* ignore */ }

        if (users.length > 0 && users.some(u => u.externAccessLink)) {
            $linksDiv.css('display', '');
            const linksFrag = document.createDocumentFragment();

            // Section title
            const title = document.createElement('div');
            title.className = 'section-title';
            title.textContent = 'Signing Links';
            linksFrag.appendChild(title);

            // Info banner
            const alert = document.createElement('div');
            alert.className = 'alert alert-insign mb-3';
            alert.style.cssText = 'background:rgba(1,101,188,0.06);border:1px solid rgba(1,101,188,0.15);border-radius:8px;padding:8px 12px';
            const alertIcon = document.createElement('i');
            alertIcon.className = 'bi bi-info-circle me-1';
            alertIcon.style.color = 'var(--insign-blue)';
            const alertText = document.createElement('span');
            alertText.className = 'text-muted-sm';
            alertText.innerHTML = 'Each recipient has a unique link. Use <strong>separate browser profiles</strong> or <strong>private/incognito windows</strong> to avoid cookie conflicts between signers.';
            alert.append(alertIcon, ' ', alertText);
            linksFrag.appendChild(alert);

            for (let idx = 0; idx < users.length; idx++) {
                const u = users[idx];
                const link = u.externAccessLink || '';
                const req = reqUsers[idx] || {};
                const name = u.realName || req.realName || '';
                const email = u.recipient || req.recipient || '';
                const phone = u.mobileNumber || req.mobileNumber || '';
                const roles = u.roles || req.roles || [];
                const sendEmails = u.sendEmails != null ? u.sendEmails : req.sendEmails;
                const sendSMS = u.sendSMS != null ? u.sendSMS : req.sendSMS;
                const sso = u.singleSignOnEnabled != null ? u.singleSignOnEnabled : req.singleSignOnEnabled;
                if (!link) continue;

                const card = document.getElementById('tpl-signing-link-card').content.cloneNode(true).firstElementChild;
                card.querySelector('[data-slot="name"]').textContent = name || email;

                // Role badges
                const rolesSlot = card.querySelector('[data-slot="roles"]');
                for (const r of roles) {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-primary ms-1';
                    badge.style.cssText = 'font-size:0.65rem;vertical-align:middle';
                    badge.textContent = r;
                    rolesSlot.appendChild(badge);
                }

                card.querySelector('[data-slot="open-link"]').href = link;
                card.querySelector('[data-slot="copy-btn"]').addEventListener('click', () => navigator.clipboard.writeText(link));

                // Info chips
                const chipDefs = [];
                if (email) chipDefs.push({ icon: 'bi-envelope', text: email });
                if (phone) chipDefs.push({ icon: 'bi-phone', text: phone });
                if (sendEmails === true) chipDefs.push({ icon: 'bi-envelope-check', text: 'Email notify' });
                if (sendSMS === true) chipDefs.push({ icon: 'bi-chat-dots', text: 'SMS notify' });
                if (sso === true) chipDefs.push({ icon: 'bi-shield-check', text: 'SSO' });
                if (sso === false) chipDefs.push({ icon: 'bi-shield-x', text: 'No SSO' });

                if (chipDefs.length) {
                    const chipsEl = card.querySelector('[data-slot="chips"]');
                    chipsEl.classList.remove('d-none');
                    for (const ch of chipDefs) {
                        const span = document.createElement('span');
                        span.style.cssText = 'background:rgba(1,101,188,0.08);padding:2px 8px;border-radius:12px;white-space:nowrap';
                        const icon = document.createElement('i');
                        icon.className = 'bi ' + ch.icon;
                        span.append(icon, ' ' + ch.text);
                        chipsEl.appendChild(span);
                    }
                }

                card.querySelector('[data-slot="link-display"]').textContent = link;
                linksFrag.appendChild(card);
            }

            $linksDiv.empty().append(linksFrag);
        } else {
            $linksDiv.css('display', 'none');
        }
    }

    updateCodeSnippets();
}

function escapeHtml(str) {
    return $('<div>').text(str).html();
}

async function executeDownload() {
    const body = getEditorValue('op-download');
    const result = await state.apiClient.call('POST', '/get/documents/download', { body, blobResponse: true, accept: '*/*' });

    state.lastRequest = { method: 'POST', path: '/get/documents/download', body };

    const $responseDiv = $('.op-response[data-op="download"]');
    if ($responseDiv.length) $responseDiv.removeClass('d-none');

    const $statusEl = $('.response-status[data-op="download"]');
    if ($statusEl.length) {
        $statusEl.attr('class', 'response-status ' + (result.ok ? 'success' : 'error'));
        $statusEl.html(`
            <strong>${result.status}</strong> ${result.statusText}
            <span class="ms-auto text-muted-sm">${result.duration}ms</span>
        `);
    }

    if (result.ok && result.blob) {
        // Trigger download
        const url = URL.createObjectURL(result.blob);
        const $a = $('<a>');
        const isPdf = result.blob.type === 'application/pdf';
        $a.attr('href', url);
        $a.attr('download', isPdf ? 'document.pdf' : 'documents.zip');
        $a[0].click();
        URL.revokeObjectURL(url);

        const sizeStr = result.blob.size < 1024 ? result.blob.size + ' B' :
            (result.blob.size / 1024).toFixed(1) + ' KB';
        showResponseEditor('op-download', `Downloaded ${sizeStr} (${result.blob.type})`);

        // Auto-preview PDFs
        if (isPdf && state.pdfViewer) {
            state._lastDownloadBlob = result.blob;
            previewBlob(result.blob, 'Signed Document');
        }
    } else {
        showResponseEditor('op-download', result.body || result.raw);
    }
}

async function fetchDocumentSingle() {
    const body = getEditorValue('op-document-single');
    const obj = typeof body === 'string' ? JSON.parse(body) : body;
    const qs = new URLSearchParams(obj).toString();
    const url = '/get/document?' + qs;
    const result = await state.apiClient.call('POST', url, { blobResponse: true, accept: '*/*' });

    state.lastRequest = { method: 'POST', path: '/get/document', body };

    const $responseDiv = $('.op-response[data-op="document-single"]');
    if ($responseDiv.length) $responseDiv.removeClass('d-none');

    const $statusEl = $('.response-status[data-op="document-single"]');
    if ($statusEl.length) {
        $statusEl.attr('class', 'response-status ' + (result.ok ? 'success' : 'error'));
        $statusEl.html(`
            <strong>${result.status}</strong> ${result.statusText}
            <span class="ms-auto text-muted-sm">${result.duration}ms</span>
        `);
    }

    if (!result.ok || !result.blob) {
        showResponseEditor('op-document-single', result.body || result.raw);
    } else {
        const sizeStr = result.blob.size < 1024 ? result.blob.size + ' B' :
            (result.blob.size / 1024).toFixed(1) + ' KB';
        showResponseEditor('op-document-single', `Received ${sizeStr} (${result.blob.type})`);
        state._lastDownloadBlob = result.blob;
        state._lastDownloadName = (obj.docid || 'document') + '.pdf';
    }

    updateCodeSnippets();
    return result;
}

async function downloadDocumentSingle() {
    const result = await fetchDocumentSingle();
    if (result.ok && result.blob) {
        const url = URL.createObjectURL(result.blob);
        const $a = $('<a>');
        $a.attr('href', url);
        $a.attr('download', state._lastDownloadName || 'document.pdf');
        $a[0].click();
        URL.revokeObjectURL(url);
    }
}

async function previewDocumentSingle() {
    const result = await fetchDocumentSingle();
    if (result.ok && result.blob && state.pdfViewer) {
        previewBlob(result.blob, 'Document: ' + (state._lastDownloadName || ''));
    }
}

async function uploadDocument() {
    const $fileInput = $('#upload-file');
    const docId = $('#upload-docid').val();

    if (!$fileInput[0].files.length) {
        alert('Please select a PDF file');
        return;
    }

    const result = await state.apiClient.upload('/configure/uploaddocument', $fileInput[0].files[0], {
        sessionid: state.sessionId,
        docid: docId,
        filename: $fileInput[0].files[0].name
    });

    const $responseDiv = $('.op-response[data-op="upload"]');
    if ($responseDiv.length) $responseDiv.removeClass('d-none');

    const $statusEl = $('.response-status[data-op="upload"]');
    if ($statusEl.length) {
        $statusEl.attr('class', 'response-status ' + (result.ok ? 'success' : 'error'));
        $statusEl.html(`<strong>${result.status}</strong> ${result.statusText}`);
    }

    showResponseEditor('op-upload', result.body || result.raw);
}

function updateOperationEditors() {
    for (const [opKey, opDef] of Object.entries(OPERATIONS)) {
        if (opDef.getBody) {
            const editorId = 'op-' + opKey;
            if (state.editors[editorId]) {
                setEditorValue(editorId, opDef.getBody());
            }
        }
    }
    // Update sessionid in the free request editor if present
    if (state.editors['op-free'] && state.sessionId) {
        const body = getEditorValue('op-free');
        if (typeof body === 'object' && ('sessionid' in body)) {
            body.sessionid = state.sessionId;
            setEditorValue('op-free', body);
        }
    }
}

function copySessionId() {
    if (state.sessionId) {
        navigator.clipboard.writeText(state.sessionId);
    }
}

'use strict';

/* ==========================================================================
   Bidirectional Sync & Default Request Bodies
   ========================================================================== */


// =====================================================================
// Bidirectional sync: JSON editor → UI controls
// =====================================================================

var _syncDebounce = null;

function syncEditorToUI() {
    clearTimeout(_syncDebounce);
    _syncDebounce = setTimeout(_doSyncEditorToUI, 300);
}

function _doSyncEditorToUI() {
    if (!state.editors['create-session']) return;
    let body;
    try { body = JSON.parse(state.editors['create-session'].getValue()); } catch { return; }
    if (typeof body !== 'object') return;

    // Sync owner fields to sidebar inputs and navbar
    _syncInputFromJson('cfg-displayname', body.displayname);
    _syncInputFromJson('cfg-foruser', body.foruser);
    _syncInputFromJson('cfg-userfullname', body.userFullName);
    _syncInputFromJson('cfg-userEmail', body.userEmail);
    // Keep navbar foruser in sync with JSON editor
    if (body.foruser !== undefined) {
        const navVal = $('#navbar-foruser-id').val() || '';
        if (navVal !== String(body.foruser)) { $('#navbar-foruser-id').val(body.foruser); _updateNavSub('navbar-foruser-id-display', body.foruser); }
    }

    // Sync feature toggles (both FEATURE_GROUPS and UNCOVERED_FEATURES)
    const saved = loadFeatureSettings();
    let settingsChanged = false;

    const allFeatures = [];
    for (const group of FEATURE_GROUPS) {
        for (const f of group.features) allFeatures.push(f);
    }
    for (const f of UNCOVERED_FEATURES) allFeatures.push(f);

    for (const f of allFeatures) {
        let jsonVal;
        if (f.path === 'guiProperties') {
            jsonVal = body.guiProperties ? body.guiProperties[f.key] : undefined;
        } else if (f.path === 'signConfig') {
            jsonVal = body.signConfig ? body.signConfig[f.key] : undefined;
        } else if (f.path === 'deliveryConfig') {
            jsonVal = body.deliveryConfig ? body.deliveryConfig[f.key] : undefined;
        } else if (f.path === 'doc') {
            jsonVal = (body.documents && body.documents[0]) ? body.documents[0][f.key] : undefined;
        } else {
            jsonVal = body[f.key];
        }

        // Skip fields that are handled as owner inputs
        if (['displayname', 'userFullName'].includes(f.key) && f.path === 'root') continue;

        if (f.type === 'bool') {
            const uiState = jsonVal === true ? 'on' : jsonVal === false ? 'off' : 'default';
            const $radio = $(`#ft-${f.key}-${uiState}`);
            if ($radio.length && !$radio.is(':checked')) $radio.prop('checked', true);
            if (jsonVal === undefined) { if (saved[f.key] !== undefined) { delete saved[f.key]; settingsChanged = true; } }
            else { if (saved[f.key] !== jsonVal) { saved[f.key] = jsonVal; settingsChanged = true; } }
        } else if (f.type === 'select' || f.type === 'text') {
            const $el = $(`#ft-${f.key}`);
            if ($el.length && jsonVal !== undefined && $el.val() !== String(jsonVal)) $el.val(String(jsonVal));
            else if ($el.length && jsonVal === undefined && $el.val() !== '') $el.val('');
            if (jsonVal === undefined) { if (saved[f.key] !== undefined) { delete saved[f.key]; settingsChanged = true; } }
            else { if (saved[f.key] !== jsonVal) { saved[f.key] = jsonVal; settingsChanged = true; } }
        }
    }
    if (settingsChanged) saveFeatureSettings(saved);
    _updateFeatureChangedCount();
    // Persist the full editor content so it survives page reloads
    saveAppState();
}

function _syncInputFromJson(inputId, jsonVal) {
    const $el = $('#' + inputId);
    if (!$el.length) return;
    const strVal = jsonVal !== undefined && jsonVal !== null ? String(jsonVal) : '';
    if ($el.val() !== strVal) $el.val(strVal);
}

// =====================================================================
// Default request bodies
// =====================================================================

/** Get display name for the session based on selected document */
function getSessionDisplayName() {
    const $input = $('#cfg-displayname');
    if ($input.length && $input.val().trim()) return $input.val().trim();
    const selDoc = getSelectedDocument();
    if (state.selectedDoc === 'custom' || (state.selectedDoc && state.selectedDoc.startsWith('upload:'))) return state.customFileData ? state.customFileData.name : 'Your Document';
    return _docLabel(state.selectedDoc, selDoc) || 'Signing Session';
}

/** Read owner fields from sidebar inputs */
function getOwnerFields() {
    return {
        foruser: ($('#cfg-foruser').val() || '').trim() || state.userId,
        userFullName: ($('#cfg-userfullname').val() || '').trim() || 'Demo User',
        userEmail: ($('#cfg-userEmail').val() || '').trim() || ''
    };
}

function getDefaultCreateSessionBody() {
    const selDoc = getSelectedDocument();
    const owner = getOwnerFields();

    const doc = {
        id: 'contract-1',
        displayname: (state.selectedDoc === 'custom' || (state.selectedDoc && state.selectedDoc.startsWith('upload:')))
            ? (state.customFileData ? state.customFileData.name : 'Your Document')
            : (_docLabel(state.selectedDoc, selDoc) || 'Test Document'),
        scanSigTags: selDoc.scanSigTags,
        allowFormEditing: true
    };

    if (state.fileDelivery === 'url') {
        doc.fileURL = getDocumentAbsoluteUrl();
    } else if (state.fileDelivery === 'base64') {
        doc.file = '<filedata>';
    }
    // 'upload' mode: no file reference in create body - uploaded separately

    const body = {
        displayname: getSessionDisplayName(),
        foruser: owner.foruser,
        userFullName: owner.userFullName,
        documents: [doc],
        callbackURL: getCallbackUrl()
    };

    if (owner.userEmail) {
        body.userEmail = owner.userEmail;
    }

    // Include webhook URL if available (prefer live viewer URL over saved state)
    const liveWhUrl = (state.webhookViewer && state.webhookViewer.getUrl()) || state.webhookUrl;
    if (liveWhUrl && $('#cfg-webhooks').is(':checked')) {
        body.serverSidecallbackURL = liveWhUrl;
        body.serversideCallbackMethod = 'POST';
        body.serversideCallbackContenttype = 'json';
        state.webhookUrl = liveWhUrl; // sync state
    }

    return body;
}

/** Generate email from a display name: "Maria Hoffmann" -> "maria.hoffmann@company.invalid" */
function _emailFromName(name) {
    // Strip academic/professional titles before generating email
    const clean = name.replace(/^(Prof\.\s*Dr\.|Prof\.|Dr\.|Ing\.|Dipl\.-\w+\.)\s*/i, '');
    return clean.trim().toLowerCase().replace(/\s+/g, '.') + '@company.invalid';
}

/** Generate a random extern user entry for a given role, using discovered details if available */
function _randomExternUser(role, opts) {
    const details = (state.discoveredRoleDetails && state.discoveredRoleDetails[role]) || {};
    const rnd = generateRandomUser();
    const realName = details.displayname || rnd.userFullName;
    const email = details.email || _emailFromName(realName);
    return {
        recipient: email,
        realName: realName,
        roles: [role],
        sendEmails: opts.sendEmails,
        sendSMS: opts.sendSMS,
        singleSignOnEnabled: opts.singleSignOnEnabled
    };
}

/** Generate an extern user matched by externRole (email) instead of role name */
function _externUserByEmail(email, opts) {
    const rnd = generateRandomUser();
    return {
        recipient: email,
        realName: rnd.userFullName,
        sendEmails: opts.sendEmails,
        sendSMS: opts.sendSMS,
        singleSignOnEnabled: opts.singleSignOnEnabled
    };
}

function getDefaultExternBody() {
    // Use discovered roles if available, else use document catalog, else demo defaults
    const doc = getSelectedDocument();
    const roles = state.discoveredRoles || doc.roles || ['seller', 'buyer'];

    let savedOpts = { sendEmails: false, sendSMS: false, singleSignOnEnabled: true, inOrder: false };
    try {
        const stored = JSON.parse(localStorage.getItem('insign-extern-options'));
        if (stored) savedOpts = { ...savedOpts, ...stored };
    } catch { /* ignore */ }

    let externUsers;
    if (doc.useExternRole && doc.externRoles) {
        // Match signers by email via externRole - no roles array needed
        externUsers = doc.externRoles.map(email => _externUserByEmail(email, savedOpts));
    } else {
        externUsers = roles.map(role => _randomExternUser(role, savedOpts));
    }

    // When sequential signing is enabled, each user needs an orderNumber
    if (savedOpts.inOrder) {
        externUsers.forEach((u, i) => { u.orderNumber = i + 1; });
    }
    // When SMS is enabled, each user needs a recipientsms phone number
    // Placeholder: Swiss mobile (+41 79 555 00 xx) - fictitious but format-valid.
    // US 555 numbers are widely blacklisted; this passes inSign validation.
    if (savedOpts.sendSMS) {
        externUsers.forEach((u, i) => { if (!u.recipientsms) u.recipientsms = '+417955500' + String(i).padStart(2, '0'); });
    }

    return {
        sessionid: state.sessionId || '<session-id>',
        externUsers,
        inOrder: savedOpts.inOrder
    };
}

function getSessionIdBody() {
    return { sessionid: state.sessionId || '<session-id>' };
}

function getUserSessionsBody() {
    return {
        user: state.lastForuser || state.userId || '',
        includeTemplates: false
    };
}

function getSSOBody() {
    const foruser = state.lastForuser || state.userId || '';
    return {
        id: foruser,
        fullName: $('#cfg-userfullname').val() || '',
        email: $('#cfg-userEmail').val() || ''
    };
}

// =====================================================================
// Operation definitions
// =====================================================================

function getDocumentSingleBody() {
    const includeB = document.getElementById('includeBiodata');
    return {
        sessionid: state.sessionId || '<session-id>',
        docid: 'contract-1',
        includeBiodata: includeB ? includeB.checked : true
    };
}

function toggleIncludeBiodata(checked) {
    const editor = state.editors['op-document-single'];
    if (!editor) return;
    try {
        const val = JSON.parse(editor.getValue());
        val.includeBiodata = checked;
        editor.setValue(JSON.stringify(val, null, 2));
    } catch (e) { /* ignore parse errors */ }
}

/** Operations catalog - loaded from JSON at init, hydrated with function refs */
var OPERATIONS = {};


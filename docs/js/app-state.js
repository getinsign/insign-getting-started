'use strict';

/* ==========================================================================
   inSign API Explorer - State & Document Helpers
   ========================================================================== */

// =====================================================================
// State
// =====================================================================

var state = {
    sessionId: null,
    accessURL: null,
    accessURLProcessManagement: null,
    currentStep: 1,
    editors: {},
    apiClient: null,
    webhookViewer: null,
    webhookUrl: null,             // resolved webhook URL (set once endpoint is created)
    userId: null,                 // persistent UUID for foruser (set in init)
    selectedDoc: 'acme',
    fileDelivery: 'base64',       // 'base64' | 'upload' | 'url'
    customFileData: null,         // { name, base64, blob } when user picks own file
    namesList: [],                // loaded from data/names.json - EU names with unicode
    brandLogoData: {},            // { icon, mail, login } data URLs for uploaded logos (resolved at send time)
    discoveredRoles: null,        // ['seller','buyer'] from /get/documents/full
    discoveredRoleDetails: null,  // { role: { displayname, email } } from sig fields
    discoveredFields: null,       // [{role, name, required, signed}]
    pdfViewer: null,              // PdfViewer instance
    lastRequest: null,            // { method, path, body } for code generation
    schemaLoader: new window.OpenApiSchemaLoader(),
    monacoReady: false,
    _editorSyncLock: false,        // prevent infinite loops during bidirectional sync
    webhookProvider: 'smee', // current webhook provider
    authMode: 'basic',      // 'basic' or 'oauth2'
    _corsIssueApi: false,   // last base-URL probe had CORS/network issues
    _corsIssueWebhook: false // last webhook endpoint creation had CORS/network issues
};

/** Generate a stable human-readable user ID; only persist to localStorage when profiles are saved */
/** Strip title prefixes (Dr., Prof., etc.) from a full name */
function _stripTitle(fullName) {
    return fullName.replace(/^(Dr\.|Prof\.|Mag\.|Ing\.)\s+/i, '');
}

/** Transliterate accented/special chars to ASCII for IDs and email local parts */
function _toAscii(str) {
    const map = {
        'ä':'ae','ö':'oe','ü':'ue','ß':'ss','Ä':'Ae','Ö':'Oe','Ü':'Ue',
        'á':'a','à':'a','â':'a','ã':'a','å':'a','ą':'a','ă':'a',
        'é':'e','è':'e','ê':'e','ë':'e','ę':'e','ě':'e',
        'í':'i','ì':'i','î':'i','ï':'i','ı':'i',
        'ó':'o','ò':'o','ô':'o','õ':'o','ő':'o','ø':'o',
        'ú':'u','ù':'u','û':'u','ű':'u','ů':'u',
        'ý':'y','ÿ':'y',
        'ñ':'n','ń':'n','ň':'n',
        'ç':'c','ć':'c','č':'c',
        'ð':'d','đ':'d','ď':'d',
        'ł':'l','ľ':'l',
        'ř':'r','ŕ':'r',
        'š':'s','ś':'s','ş':'s',
        'ť':'t','þ':'th',
        'ž':'z','ź':'z','ż':'z',
        'æ':'ae','œ':'oe',
        'Á':'A','À':'A','Â':'A','Ã':'A','Å':'A','Ą':'A','Ă':'A',
        'É':'E','È':'E','Ê':'E','Ë':'E','Ę':'E','Ě':'E',
        'Í':'I','Ì':'I','Î':'I','Ï':'I',
        'Ó':'O','Ò':'O','Ô':'O','Õ':'O','Ő':'O','Ø':'O',
        'Ú':'U','Ù':'U','Û':'U','Ű':'U','Ů':'U',
        'Ý':'Y',
        'Ñ':'N','Ń':'N','Ň':'N',
        'Ç':'C','Ć':'C','Č':'C',
        'Ð':'D','Đ':'D','Ď':'D',
        'Ł':'L','Ľ':'L',
        'Ř':'R','Ŕ':'R',
        'Š':'S','Ś':'S','Ş':'S',
        'Ť':'T','Þ':'Th',
        'Ž':'Z','Ź':'Z','Ż':'Z',
        'Æ':'Ae','Œ':'Oe',
        'ð':'d','Ð':'D'
    };
    return str.replace(/[^\x00-\x7F]/g, ch => map[ch] || '');
}

/** Generate a random user identity from names.json entry */
function generateUserFromName(fullName) {
    const bare = _stripTitle(fullName);
    const parts = bare.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    const firstAscii = _toAscii(firstName).toLowerCase();
    const lastAscii = _toAscii(lastName).toLowerCase();
    const hex5 = Array.from(crypto.getRandomValues(new Uint8Array(3)),
        b => b.toString(16).padStart(2, '0')).join('').slice(0, 5);
    const foruser = firstAscii + '-' + lastAscii + '-' + hex5;
    const emailFirst = _toAscii(firstName);
    const emailLast = _toAscii(lastName);
    const userEmail = emailFirst + '.' + emailLast + '@company.invalid';
    return { foruser, userFullName: fullName, userEmail };
}

/** Pick a random name from the loaded names list and generate user identity.
 *  Accepts an optional list arg so it can be called before state is initialized. */
function generateRandomUser(namesList) {
    const list = namesList || (state && state.namesList) || [];
    if (!list.length) {
        const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)),
            b => b.toString(16).padStart(2, '0')).join('');
        return { foruser: 'user-' + hex, userFullName: 'Demo User', userEmail: '' };
    }
    const name = list[Math.floor(Math.random() * list.length)];
    return generateUserFromName(name);
}

function getOrCreateUserId() {
    const key = 'insign-explorer-userid';
    let id = null;
    try { id = localStorage.getItem(key); } catch { /* ignore */ }
    if (!id) {
        // Names not loaded yet at init time - use fallback
        const user = generateRandomUser([]);
        id = user.foruser;
        if (loadProfiles().length > 0) {
            try { localStorage.setItem(key, id); } catch { /* ignore */ }
        }
    }
    return id;
}

/** Build the callbackURL pointing back to this page at #step2 */
/** Generate a callback URL with a unique key; stores session ID for the callback page to look up */
function getCallbackUrl() {
    const loc = window.location;
    const base = loc.origin + loc.pathname.replace(/[^/]*$/, '');
    const cbKey = 'cb-' + Math.random().toString(16).slice(2, 10);
    state._callbackKey = cbKey;
    return base + 'signed.html?cbkey=' + cbKey;
}

/** Save session ID to localStorage so the callback page can retrieve it */
function saveCallbackSession() {
    if (state._callbackKey && state.sessionId) {
        try { localStorage.setItem('insign-cb-' + state._callbackKey, state.sessionId); } catch (_) {}
    }
}

/** Webhook provider and document catalogs - loaded from JSON at init */
var WEBHOOK_PROVIDERS = {};
var DOCUMENTS = {};

function getSelectedDocument() {
    if (state.selectedDoc && state.selectedDoc.startsWith('upload:')) {
        // Return a virtual doc entry for uploaded files
        const name = state.customFileData ? state.customFileData.name : 'upload.pdf';
        return { label: name, local: null, pages: '?', roles: [], fileSize: 0 };
    }
    return DOCUMENTS[state.selectedDoc] || DOCUMENTS.acme;
}

/** URL the inSign server can fetch (for URL delivery mode) */
function getDocumentAbsoluteUrl() {
    const doc = getSelectedDocument();
    if (doc.local) {
        const loc = window.location;
        return loc.href.replace(/\/[^/]*$/, '/') + doc.local;
    }
    return '';
}

/** Relative path for browser fetch (base64/upload modes) */
function getDocumentRelativeUrl() {
    const doc = getSelectedDocument();
    if (doc.local) return doc.local;
    return '';
}

/** GitHub raw URL for the selected document (for code snippets) */
function getDocumentGithubRawUrl() {
    const doc = getSelectedDocument();
    if (!doc.local) return getDocumentAbsoluteUrl();
    // user.github.io/repo → raw.githubusercontent.com/user/repo/main/docs/...
    const m = location.hostname.match(/^(.+)\.github\.io$/);
    if (m) {
        const repo = location.pathname.split('/')[1] || '';
        return 'https://raw.githubusercontent.com/' + m[1] + '/' + repo + '/main/docs/' + doc.local;
    }
    // Fallback: absolute URL (works for local dev)
    return getDocumentAbsoluteUrl();
}

function getDocumentFilename() {
    if (state.selectedDoc === 'custom' && state.customFileData) return state.customFileData.name;
    if (state.selectedDoc && state.selectedDoc.startsWith('upload:') && state.customFileData) return state.customFileData.name;
    const doc = getSelectedDocument();
    const path = doc.local || '';
    return path.split('/').pop() || 'document.pdf';
}

/** Fetch a PDF and return as { base64, blob } */
async function fetchDocumentAsBase64(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch document: ' + resp.status);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve({ base64, blob });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/** Load the selected document as base64 (demo, repo, or custom) */
async function loadDocumentData() {
    if (state.selectedDoc === 'custom' || (state.selectedDoc && state.selectedDoc.startsWith('upload:'))) {
        if (!state.customFileData) throw new Error('No custom file selected');
        return { base64: state.customFileData.base64, blob: state.customFileData.blob };
    }
    return fetchDocumentAsBase64(getDocumentRelativeUrl());
}

/** Preview the currently selected document in the PDF viewer */
async function previewDocument() {
    if (!state.pdfViewer) return;
    const doc = getSelectedDocument();
    if ((state.selectedDoc === 'custom' || (state.selectedDoc && state.selectedDoc.startsWith('upload:'))) && state.customFileData) {
        state.pdfViewer.show(state.customFileData.blob, { title: state.customFileData.name, fileSize: state.customFileData.blob.size });
    } else {
        const url = getDocumentRelativeUrl();
        state.pdfViewer.show(url, { title: doc.label });
    }
}

/** Preview a blob (e.g. downloaded document) */
function previewBlob(blob, title) {
    if (!state.pdfViewer) return;
    state.pdfViewer.show(blob, { title: title || 'Downloaded Document', fileSize: blob.size });
}


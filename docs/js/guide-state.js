'use strict';

/* ==========================================================================
   Getting Started Guide - Configuration, State & Utilities
   ========================================================================== */

const SANDBOX = {
    url: 'https://sandbox.test.getinsign.show',
    username: 'controller',
    password: 'pwd.insign.sandbox.4561',
    docUrl: 'https://getinsign.github.io/insign-getting-started/data/sample.pdf'
};

/* ==========================================================================
   SESSION STATE (JS vars only - no localStorage)
   ========================================================================== */

var sessionId = null;
var accessURL = null;
var signerLinks = [];
var docId = null;

/* ==========================================================================
   API CLIENT (reuses docs/js/api-client.js)
   ========================================================================== */

var apiClient = new window.InsignApiClient(SANDBOX.url, SANDBOX.username, SANDBOX.password);
apiClient.useCorsProxy = false;

/* ==========================================================================
   SCHEMA LOADER (reuses docs/js/openapi-schema-loader.js)
   ========================================================================== */

var schemaLoader = new window.OpenApiSchemaLoader();

/* ==========================================================================
   STEP DEFINITIONS
   ========================================================================== */

var STEPS = {
    1: { method: 'POST', path: '/configure/session', bodyType: 'json' },
    2: { method: 'POST', path: '/extern/beginmulti', bodyType: 'json' },
    3: { method: 'POST', path: '/get/status', bodyType: 'json' },
    4: { method: 'POST', path: '/get/document', bodyType: 'query' }
};

function shortUuid() {
    return 'xxxx-xxxx'.replace(/x/g, function () {
        return (Math.random() * 16 | 0).toString(16);
    });
}

var DEMO_NAMES = [
    'Alex Thompson', 'Jordan Rivera', 'Sam Patel', 'Taylor Morgan',
    'Chris Bergmann', 'Robin Nakamura', 'Casey Sullivan', 'Dana Fischer',
    'Morgan Blake', 'Jamie Lindgren', 'Riley Santoro', 'Quinn Albrecht',
    'Avery Caldwell', 'Parker Johansson', 'Skyler Dumont', 'Reese Kowalski'
];
var DEMO_NAME = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
var DEMO_USER_ID = DEMO_NAME.toLowerCase().replace(/\s+/g, '.') + '-' + shortUuid();

var CALLBACK_KEY = 'cb-' + shortUuid();
var CALLBACK_URL = (function () {
    var loc = window.location;
    return loc.origin + loc.pathname.replace(/[^/]*$/, '') + 'signed.html?cbkey=' + CALLBACK_KEY;
})();

var STEP_DEFAULTS = {
    1: JSON.stringify({
        foruser: DEMO_USER_ID,
        userfullname: DEMO_NAME,
        displayname: 'Getting Started Demo',
        callbackURL: CALLBACK_URL,
        documents: [{
            id: 'doc-1',
            displayname: 'Sample Contract',
            fileURL: SANDBOX.docUrl,
            scanSigTags: true
        }]
    }, null, 2),

    2: JSON.stringify({
        sessionid: '',
        externUsers: [],
        inOrder: false
    }, null, 2),

    3: JSON.stringify({
        sessionid: ''
    }, null, 2),

    4: JSON.stringify({
        sessionid: '',
        docid: 'doc-1',
        includeBiodata: true
    }, null, 2)
};

/* ==========================================================================
   UTILITIES
   ========================================================================== */

/** HTML-escape a string (used in banner building) */
function esc(s) { var d = document.createElement('span'); d.textContent = s; return d.innerHTML; }

/** HTML-escape for sidebar (alias) */
function _escSc(s) {
    var d = document.createElement('span');
    d.textContent = s || '';
    return d.innerHTML;
}

// Fallback names for signers when /get/status doesn't provide them
var SIGNER_NAMES = [
    'Maria Hoffmann', 'Thomas Weber', 'Laura Schmidt', 'Stefan Richter',
    'Anna Bergmann', 'Felix Hartmann', 'Sophie Lindner', 'Jan Krause'
];

/** Generate an email from a display name: "Maria Hoffmann" -> "maria.hoffmann@company.invalid" */
function emailFromName(name) {
    // Strip academic/professional titles before generating email
    var clean = name.replace(/^(Prof\.\s*Dr\.|Prof\.|Dr\.|Ing\.|Dipl\.-\w+\.)\s*/i, '');
    return clean.trim().toLowerCase().replace(/\s+/g, '.') + '@company.invalid';
}

/** Check if a string looks like an email address */
function looksLikeEmail(s) {
    return s && s.indexOf('@') !== -1;
}

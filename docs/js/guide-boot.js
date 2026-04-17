'use strict';

/* ==========================================================================
   Getting Started Guide - Boot, Dark Mode, Popups & Cheats
   ========================================================================== */

function toggleDarkMode() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('insign-dark-mode', next === 'dark' ? 'true' : 'false'); } catch (_) {}
    // Update Monaco editor themes
    if (typeof monaco !== 'undefined') {
        monaco.editor.setTheme(next === 'dark' ? 'vs-dark' : 'vs');
    }
}

/* ==========================================================================
   CHEAT BUTTONS - skip API calls for demo/testing
   ========================================================================== */

function cheatCreateSession() {
    var fakeId = 'fake-' + Math.random().toString(36).substring(2, 14);
    sessionId = fakeId;
    accessURL = SANDBOX.url + '/index?sessionid=' + fakeId;
    try {
        localStorage.setItem('insign-cb-' + CALLBACK_KEY, sessionId);
        localStorage.setItem('insign-cb-latest', sessionId);
    } catch (_) {}
    propagateSessionId();
    showSessionSuccessBanner(fakeId, accessURL);
    showSessionSidebar();
    if (isConfettiEnabled()) launchConfetti();
    setTimeout(function () {
        var banner = document.getElementById('step1-success-slot');
        var rect = banner.getBoundingClientRect();
        window.scrollBy({ top: rect.top - 80, behavior: 'smooth' });
    }, 100);
}

function cheatSigned() {
    stopSignatureWatch();
    sigWatchFired = true;
    showSigningCelebration(1);
}

/* ==========================================================================
   EXPLORER HINT (floating right-side card)
   ========================================================================== */

var explorerHintShown = false;

function showExplorerHint() {
    if (explorerHintShown) return;
    if (document.getElementById('explorer-hint')) return;
    explorerHintShown = true;

    var tpl = document.getElementById('tpl-explorer-hint');
    var clone = tpl.content.cloneNode(true);
    document.body.appendChild(clone);

    // Small delay so the DOM insertion completes before triggering the animation
    requestAnimationFrame(function () {
        var el = document.getElementById('explorer-hint');
        if (el) el.classList.add('visible');
    });
}

function dismissExplorerHint() {
    var el = document.getElementById('explorer-hint');
    if (!el) return;
    el.classList.add('dismissing');
    el.addEventListener('animationend', function () {
        el.remove();
    });
}

// Hook into revealStep to trigger the hint when step 3 appears
(function () {
    var origRevealStep = window.revealStep;
    if (typeof origRevealStep !== 'function') return;
    window.revealStep = function (n, scroll) {
        origRevealStep(n, scroll);
        if (n >= 3) {
            // Delay slightly so the step card animates in first
            setTimeout(showExplorerHint, 800);
        }
    };
})();

/* ==========================================================================
   cURL POPUP
   ========================================================================== */

var curlPopupEl = null;
var curlCurrentPlatform = 'unix';
var curlCurrentStep = null;

function buildCurlCommand(step, platform) {
    var stepDef = STEPS[step];
    var editorValue = editors[step] ? editors[step].getValue() : '{}';

    var url = SANDBOX.url + stepDef.path;
    var user = SANDBOX.username;
    var pass = SANDBOX.password;

    // For step 4 (query params), append as query string
    if (stepDef.bodyType === 'query') {
        try {
            var params = JSON.parse(editorValue);
            var qs = Object.keys(params).map(function (k) {
                return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
            }).join('&');
            if (qs) url += '?' + qs;
        } catch (_) {}
    }

    if (platform === 'cmd') {
        // Windows CMD: use double quotes, escape inner double quotes with \"
        var lines = ['curl -X ' + stepDef.method + ' "' + url + '"'];
        lines.push('  -u "' + user + ':' + pass + '"');
        if (stepDef.bodyType === 'json') {
            lines.push('  -H "Content-Type: application/json"');
            // CMD: replace " inside JSON with \"
            var body = editorValue.replace(/\r?\n/g, '').replace(/\s+/g, ' ');
            lines.push('  -d "' + body.replace(/"/g, '\\"') + '"');
        }
        if (step === 4) {
            lines.push('  -o signed-document.pdf');
        }
        return lines.join(' ^\n');
    }

    if (platform === 'ps') {
        // PowerShell: use backtick for line continuation
        var lines = ['curl -X ' + stepDef.method + ' "' + url + '"'];
        lines.push('  -u "' + user + ':' + pass + '"');
        if (stepDef.bodyType === 'json') {
            lines.push('  -H "Content-Type: application/json"');
            var body = editorValue.replace(/\r?\n/g, '').replace(/\s+/g, ' ');
            // PowerShell: escape inner " with \"
            lines.push('  -d "' + body.replace(/"/g, '\\"') + '"');
        }
        if (step === 4) {
            lines.push('  -o signed-document.pdf');
        }
        return lines.join(' `\n');
    }

    // Unix (default): use single quotes for body
    var lines = ['curl -X ' + stepDef.method + " '" + url + "'"];
    lines.push("  -u '" + user + ':' + pass + "'");
    if (stepDef.bodyType === 'json') {
        lines.push("  -H 'Content-Type: application/json'");
        // Pretty-print the body for readability
        try {
            var parsed = JSON.parse(editorValue);
            var pretty = JSON.stringify(parsed, null, 2);
            lines.push("  -d '" + pretty + "'");
        } catch (_) {
            lines.push("  -d '" + editorValue.replace(/'/g, "'\\''") + "'");
        }
    }
    if (step === 4) {
        lines.push('  -o signed-document.pdf');
    }
    return lines.join(' \\\n');
}

function showCurlPopup(step) {
    closeCurlPopup();
    curlCurrentStep = step;
    curlCurrentPlatform = 'unix';

    var tpl = document.getElementById('tpl-curl-popup');
    var clone = tpl.content.cloneNode(true);
    var backdrop = clone.querySelector('.curl-popup-backdrop');

    // Wire platform buttons
    var platformBtns = backdrop.querySelectorAll('.curl-platform-btn');
    platformBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            platformBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            curlCurrentPlatform = btn.getAttribute('data-platform');
            updateCurlCode();
        });
    });

    document.body.appendChild(backdrop);
    curlPopupEl = backdrop;
    updateCurlCode();

    // Close on Escape
    document.addEventListener('keydown', curlEscHandler);
}

function curlEscHandler(e) {
    if (e.key === 'Escape') closeCurlPopup();
}

function closeCurlPopup(e) {
    // If called from backdrop click, only close if clicking backdrop itself
    if (e && e.target !== e.currentTarget) return;
    if (curlPopupEl) {
        curlPopupEl.remove();
        curlPopupEl = null;
    }
    document.removeEventListener('keydown', curlEscHandler);
}

function updateCurlCode() {
    if (!curlPopupEl || curlCurrentStep === null) return;
    var code = curlPopupEl.querySelector('.curl-command-code');
    code.textContent = buildCurlCommand(curlCurrentStep, curlCurrentPlatform);
}

function copyCurlCommand() {
    if (!curlPopupEl) return;
    var code = curlPopupEl.querySelector('.curl-command-code');
    navigator.clipboard.writeText(code.textContent).then(function () {
        var fb = curlPopupEl.querySelector('.curl-copy-feedback');
        fb.classList.add('show');
        setTimeout(function () { fb.classList.remove('show'); }, 1500);
    });
}

/* ==========================================================================
   SANDBOX VERSION CHECK
   ========================================================================== */

function checkSandboxVersion() {
    fetch(SANDBOX.url + '/version', { mode: 'cors' })
        .then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.text();
        })
        .then(function (text) {
            var version = text.trim();
            // Response might be JSON
            try {
                var json = JSON.parse(version);
                version = json.version || json.Version || json.build || JSON.stringify(json);
            } catch (_) {}
            var badge = document.getElementById('sandbox-version-badge');
            badge.textContent = 'sandbox ' + version;
            badge.classList.add('visible');
        })
        .catch(function () {
            var slot = document.getElementById('sandbox-warning-slot');
            var tpl = document.getElementById('tpl-sandbox-warning');
            var clone = tpl.content.cloneNode(true);
            clone.querySelector('[data-slot="url"]').textContent = SANDBOX.url;
            slot.textContent = '';
            slot.appendChild(clone);
        });
}

/* ==========================================================================
   INIT
   ========================================================================== */

/**
 * Derive GitHub repo URL from GitHub Pages hostname and set all
 * elements with class "data-github-link" to the correct href.
 * Supports data-github-path for deep links (e.g. "/blob/main/docs/FILE.md").
 */
function resolveGitHubLinks() {
    var m = location.hostname.match(/^(.+)\.github\.io$/);
    if (!m) return;
    var repo = location.pathname.split('/')[1] || '';
    var base = 'https://github.com/' + m[1] + (repo ? '/' + repo : '');
    var links = document.querySelectorAll('.data-github-link');
    for (var i = 0; i < links.length; i++) {
        var suffix = links[i].getAttribute('data-github-path') || '';
        links[i].href = base + suffix;
    }
}

$(function () {
    window.scrollTo(0, 0);
    initMonaco();
    checkSandboxVersion();
    resolveGitHubLinks();
});

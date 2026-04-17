'use strict';

/* ==========================================================================
   Getting Started Guide - API Calls & Session Management
   ========================================================================== */

async function sendStep(step) {
    var statusEl = document.getElementById('status-step' + step);
    var btn = statusEl.parentElement.querySelector('.btn-insign-primary');
    var btnOrigHtml = btn.innerHTML;

    // Show spinner on button
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span>Sending...';
    statusEl.textContent = '';

    // Step 1 (create session): purge the old session first if one exists
    if (step === 1 && sessionId) {
        try {
            await apiClient.call('POST', '/persistence/purge', { body: { sessionid: sessionId } });
        } catch (_) { /* best-effort purge */ }
        sessionId = null;
        accessURL = null;
        signerLinks = [];
        sigWatchFired = false;
        stopSignatureWatch();
    }

    var editorValue;
    try {
        editorValue = JSON.parse(editors[step].getValue());
    } catch (e) {
        statusEl.textContent = 'Invalid JSON: ' + e.message;
        btn.disabled = false;
        btn.innerHTML = btnOrigHtml;
        return;
    }

    var stepDef = STEPS[step];

    try {
        var result;

        if (stepDef.bodyType === 'query') {
            result = await apiClient.call(stepDef.method, stepDef.path, {
                queryParams: editorValue,
                blobResponse: true
            });
        } else {
            result = await apiClient.call(stepDef.method, stepDef.path, {
                body: editorValue
            });
        }

        // Restore button
        btn.disabled = false;
        btn.innerHTML = btnOrigHtml;

        if (step === 4 && result.ok && result.blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(result.blob);
            a.download = 'signed-document.pdf';
            a.click();
            URL.revokeObjectURL(a.href);
            responseEditors[step].setValue('// PDF downloaded (' + result.blob.size + ' bytes)');
            statusEl.textContent = 'Downloaded (' + result.status + ')';
            return;
        }

        var formatted = result.raw || '';
        if (typeof result.body === 'object' && result.body !== null) {
            formatted = JSON.stringify(result.body, null, 2);
        }

        responseEditors[step].setValue(formatted);
        statusEl.textContent = result.ok
            ? ('OK (' + result.status + ')')
            : ('Error ' + result.status + (result.statusText ? ' - ' + result.statusText : ''));

        var data = (typeof result.body === 'object') ? result.body : null;

        if (step === 1 && result.ok && data && data.sessionid) {
            sessionId = data.sessionid;
            accessURL = data.accessURL || null;
            // Save session ID for callback page lookup
            try {
                localStorage.setItem('insign-cb-' + CALLBACK_KEY, sessionId);
                localStorage.setItem('insign-cb-latest', sessionId);
            } catch (_) {}
            propagateSessionId();
            fetchStatusAndBuildExternUsers().then(function (statusData) {
                if (statusData) enrichBannerWithStatus(statusData);
            });
            // Celebrate and show proceed button
            showSessionSuccessBanner(data.sessionid, accessURL, editorValue);
            showSessionSidebar();
            if (isConfettiEnabled()) {
                launchConfetti();
            }
            // Scroll banner into view with a bit of the content above visible
            setTimeout(function () {
                var banner = document.getElementById('step1-success-slot');
                var rect = banner.getBoundingClientRect();
                window.scrollBy({ top: rect.top - 80, behavior: 'smooth' });
            }, 100);
        }

        if (step === 2 && result.ok && data) {
            var externData = [];
            if (Array.isArray(data.externUsers)) {
                externData = data.externUsers;
                signerLinks = externData
                    .filter(function(u) { return u.url; })
                    .map(function(u) { return u.url; });
            }
            if (signerLinks.length > 0) {
                document.getElementById('btn-open-insign').style.display = '';
                showSignerLinksBanner(externData);
            }
        }

        if (step === 3 && result.ok && data) {
            if (data.documentData && data.documentData[0]) {
                docId = data.documentData[0].docid;
                updateStep4DocId();
            }
        }

    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = btnOrigHtml;
        statusEl.textContent = 'Error: ' + err.message;
        responseEditors[step].setValue('// Network error\n// ' + err.message);
    }
}

/* ==========================================================================
   SESSION DATA MANAGEMENT
   ========================================================================== */

function propagateSessionId() {
    for (var s = 2; s <= 4; s++) {
        try {
            var val = JSON.parse(editors[s].getValue());
            val.sessionid = sessionId;
            editors[s].setValue(JSON.stringify(val, null, 2));
        } catch (_) {}
    }
}

async function fetchStatusAndBuildExternUsers() {
    if (!sessionId) return null;
    try {
        var result = await apiClient.call('POST', '/get/status', {
            body: { sessionid: sessionId }
        });
        if (!result.ok || !result.body) return null;
        var data = result.body;

        // Collect unique roles and any associated info from sig fields
        var roleInfos = [];
        var seenRoles = [];
        var sigFields = data.signaturFieldsStatusList || [];
        for (var f = 0; f < sigFields.length; f++) {
            var field = sigFields[f];
            var role = field.role || field.quickInfoParsedRole || '';
            if (role && seenRoles.indexOf(role) === -1) {
                seenRoles.push(role);
                // externRole may contain an email address
                var externRole = field.externRole || '';
                roleInfos.push({
                    role: role,
                    displayname: field.displayname || field.quickInfoParsedName || '',
                    email: field.email || (looksLikeEmail(externRole) ? externRole : '')
                });
            }
        }

        if (roleInfos.length === 0) return data;

        var externUsers = roleInfos.map(function (info, idx) {
            var fallbackName = SIGNER_NAMES[idx % SIGNER_NAMES.length];
            var realName = info.displayname || fallbackName;
            var email = info.email || emailFromName(realName);

            return {
                recipient: email,
                realName: realName,
                roles: [info.role],
                sendEmails: false,
                singleSignOnEnabled: true
            };
        });

        var step2Json = {
            sessionid: sessionId,
            externUsers: externUsers,
            inOrder: false
        };

        editors[2].setValue(JSON.stringify(step2Json, null, 2));
        return data;
    } catch (_) { return null; }
}

function updateStep4DocId() {
    try {
        var val = JSON.parse(editors[4].getValue());
        val.docid = docId;
        editors[4].setValue(JSON.stringify(val, null, 2));
    } catch (_) {}
}

function openInInsign() {
    if (signerLinks.length > 0) {
        window.open(signerLinks[0], '_blank');
    }
}

/**
 * Load a fresh accessURL via /persistence/loadsession and open as owner.
 * The initial accessURL from /configure/session is single-use,
 * so subsequent opens must call /persistence/loadsession first.
 */
async function openAsOwner(btn) {
    if (!sessionId) return;
    var origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span>Loading...';
    try {
        var result = await apiClient.call('POST', '/persistence/loadsession', {
            body: { sessionid: sessionId }
        });
        if (result.ok && result.body && result.body.accessURL) {
            accessURL = result.body.accessURL;
            window.open(accessURL, '_blank');
            startSignatureWatch();
        } else if (accessURL) {
            // Fallback to stored URL if load fails
            window.open(accessURL, '_blank');
            startSignatureWatch();
        } else {
            btn.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Failed to load session';
            setTimeout(function () { btn.innerHTML = origHtml; btn.disabled = false; }, 2000);
            return;
        }
    } catch (err) {
        if (accessURL) {
            window.open(accessURL, '_blank');
            startSignatureWatch();
        } else {
            btn.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>' + err.message;
            setTimeout(function () { btn.innerHTML = origHtml; btn.disabled = false; }, 2000);
            return;
        }
    }
    btn.disabled = false;
    btn.innerHTML = origHtml;
}

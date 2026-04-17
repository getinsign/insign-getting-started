'use strict';

/* ==========================================================================
   Getting Started Guide - Success Banners & Celebrations
   All dynamic HTML uses <template> clone-modify-insert pattern.
   ========================================================================== */

/**
 * Clone the confetti toggle template and return it as a DocumentFragment.
 * Sets the checkbox state based on the current cookie.
 */
function cloneConfettiToggle() {
    var tpl = document.getElementById('tpl-confetti-toggle');
    var clone = tpl.content.cloneNode(true);
    clone.querySelector('input').checked = isConfettiEnabled();
    return clone;
}

/* ==========================================================================
   SESSION SUCCESS BANNER (Step 1)
   ========================================================================== */

function showSessionSuccessBanner(sid, ownerUrl, requestBody) {
    var slot = document.getElementById('step1-success-slot');
    var tpl = document.getElementById('tpl-session-success-banner');
    var clone = tpl.content.cloneNode(true);

    // Fill details grid
    var grid = clone.querySelector('[data-slot="details-grid"]');
    addDetailRow(grid, 'Session ID', sid);
    if (requestBody) {
        if (requestBody.displayname) addDetailRow(grid, 'Session Name', requestBody.displayname);
        if (requestBody.userfullname) addDetailRow(grid, 'Owner', requestBody.userfullname);
        if (requestBody.foruser) addDetailRow(grid, 'User ID', requestBody.foruser);
    }

    // Fill document cards
    var docSlot = clone.querySelector('[data-slot="doc-cards"]');
    var docs = (requestBody && Array.isArray(requestBody.documents)) ? requestBody.documents : [];
    for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var docTpl = document.getElementById('tpl-doc-card');
        var docClone = docTpl.content.cloneNode(true);
        docClone.querySelector('[data-slot="doc-name"]').textContent = doc.displayname || doc.id || 'Document ' + (i + 1);
        if (doc.id) {
            docClone.querySelector('[data-slot="doc-id"]').textContent = doc.id;
            docClone.querySelector('.sig-fields-slot').setAttribute('data-doc-id', doc.id);
        } else {
            docClone.querySelector('[data-slot="doc-id-row"]').remove();
        }
        docSlot.appendChild(docClone);
    }

    // Wire up buttons with data-action attributes
    var btns = clone.querySelectorAll('[data-action]');
    for (var b = 0; b < btns.length; b++) {
        var action = btns[b].getAttribute('data-action');
        if (action === 'reveal-step2') {
            btns[b].addEventListener('click', function () { revealStep(2); });
        } else if (action === 'cheat-signed') {
            btns[b].addEventListener('click', function () { cheatSigned(); });
        } else if (action === 'test-crown') {
            btns[b].addEventListener('click', function () { animateCrown(); });
        }
    }

    // Add confetti toggle
    clone.querySelector('[data-slot="confetti-toggle"]').appendChild(cloneConfettiToggle());

    slot.innerHTML = '';
    slot.appendChild(clone);

    // Launch the crown animation after scroll + layout settle
    setTimeout(function () { animateCrown(); }, 700);
}

function addDetailRow(grid, label, value) {
    var tpl = document.getElementById('tpl-session-detail-row');
    var clone = tpl.content.cloneNode(true);
    clone.querySelector('[data-slot="label"]').textContent = label;
    clone.querySelector('[data-slot="value"]').textContent = value;
    grid.appendChild(clone);
}

/* ==========================================================================
   CROWN ANIMATION
   ========================================================================== */

var crownAnimating = false;
function animateCrown() {
    var target = document.querySelector('.crown-target');
    if (!target || crownAnimating) return;
    crownAnimating = true;

    target.style.visibility = 'hidden';

    var phantom = document.createElement('div');
    phantom.className = 'crown-phantom';
    phantom.textContent = '\ud83d\udc51';
    var ts = window.getComputedStyle(target);
    phantom.style.fontSize = ts.fontSize;
    phantom.style.fontFamily = ts.fontFamily;
    phantom.style.lineHeight = '1';
    phantom.style.willChange = 'transform, opacity';
    phantom.style.position = 'fixed';
    document.body.appendChild(phantom);

    var pRect = phantom.getBoundingClientRect();
    var pw = pRect.width || 16, ph = pRect.height || 16;

    var startScale = (window.innerWidth * 2) / pw;
    var sx = -(pw * startScale) / 2;
    var sy = window.innerHeight / 2;

    var duration = 1400;
    var startTime = performance.now();

    // Cache target rect — only update every ~100ms instead of every frame
    var tRect = target.getBoundingClientRect();
    var tx = tRect.left + tRect.width / 2;
    var ty = tRect.top + tRect.height / 2;
    var lastRectTime = startTime;

    function tick(now) {
        var rawT = (now - startTime) / duration;
        if (rawT > 1) rawT = 1;
        // ease-out cubic
        var t = 1 - (1 - rawT) * (1 - rawT) * (1 - rawT);

        // Refresh target position every ~100ms (scroll-proof but not every frame)
        if (now - lastRectTime > 100) {
            tRect = target.getBoundingClientRect();
            tx = tRect.left + tRect.width / 2;
            ty = tRect.top + tRect.height / 2;
            lastRectTime = now;
        }

        var cx = sx + (tx - sx) * t;
        var cy = sy + (ty - sy) * t;
        var scale = startScale + (1 - startScale) * t;
        var rot = -15 + 15 * t;
        var opacity = t < 0.25 ? t * 4 : 1;

        // Single composite transform — no filter (brightness was expensive)
        phantom.style.left = (cx - pw / 2) + 'px';
        phantom.style.top = (cy - ph / 2) + 'px';
        phantom.style.opacity = opacity;
        phantom.style.transform = 'scale(' + scale + ') rotate(' + rot + 'deg)';

        if (rawT < 1) {
            requestAnimationFrame(tick);
        } else {
            phantom.remove();
            crownAnimating = false;
            target.style.visibility = '';
            target.classList.add('crown-landed');
            target.addEventListener('animationend', function () {
                target.classList.remove('crown-landed');
            }, { once: true });
        }
    }

    requestAnimationFrame(tick);
}

/* ==========================================================================
   ENRICH BANNER WITH STATUS (signature fields)
   ========================================================================== */

function enrichBannerWithStatus(statusData) {
    var sigFields = statusData.signaturFieldsStatusList || [];
    var docData = statusData.documentData || [];

    // Group signature fields by document
    var fieldsByDoc = {};
    for (var i = 0; i < sigFields.length; i++) {
        var f = sigFields[i];
        var docId = f.docid || (docData[0] ? docData[0].docid : '');
        if (!fieldsByDoc[docId]) fieldsByDoc[docId] = [];
        fieldsByDoc[docId].push(f);
    }

    // Fill in each sig-fields-slot
    var slots = document.querySelectorAll('.sig-fields-slot');
    for (var s = 0; s < slots.length; s++) {
        var slotDocId = slots[s].getAttribute('data-doc-id');
        // Try exact match first, then fall back to first doc's fields
        var fields = fieldsByDoc[slotDocId] || fieldsByDoc[Object.keys(fieldsByDoc)[0]] || [];

        if (fields.length === 0) {
            slots[s].textContent = '';
            var noFields = document.createElement('div');
            noFields.style.cssText = 'font-size:0.73rem;color:var(--insign-text-muted);padding:4px 0';
            noFields.textContent = 'No signature fields detected';
            slots[s].appendChild(noFields);
            continue;
        }

        // Header
        var header = document.createElement('div');
        header.style.cssText = 'font-size:0.72rem;color:var(--insign-text-muted);margin-bottom:4px;font-weight:500';
        var headerIcon = document.createElement('i');
        headerIcon.className = 'bi bi-pen me-1';
        header.appendChild(headerIcon);
        header.appendChild(document.createTextNode(fields.length + ' signature field' + (fields.length > 1 ? 's' : '')));

        var ul = document.createElement('ul');
        ul.className = 'sig-field-list';

        for (var j = 0; j < fields.length; j++) {
            var field = fields[j];
            var role = field.role || field.quickInfoParsedRole || 'unknown';
            var name = field.displayname || field.quickInfoParsedName || '';
            var type = field.type || field.quickInfoParsedType || 'signature';
            var required = field.required !== false;

            var tpl = document.getElementById('tpl-sig-field-item');
            var clone = tpl.content.cloneNode(true);
            clone.querySelector('[data-slot="role"]').textContent = role;
            if (name) {
                clone.querySelector('[data-slot="name"]').textContent = name;
            } else {
                clone.querySelector('[data-slot="name"]').remove();
            }
            clone.querySelector('[data-slot="type"]').textContent = type;
            if (!required) {
                clone.querySelector('[data-slot="required"]').remove();
            }
            ul.appendChild(clone);
        }

        slots[s].textContent = '';
        slots[s].appendChild(header);
        slots[s].appendChild(ul);
    }
}

/* ==========================================================================
   STEP NAVIGATION
   ========================================================================== */

function revealStep(n, scroll) {
    var el = document.getElementById('step' + n);
    if (el) {
        el.style.display = '';
        // Defer editor layout until after the CSS reveal transition finishes
        // to avoid layout thrashing during animation
        setTimeout(function () {
            if (editors[n]) editors[n].layout();
            if (responseEditors[n]) responseEditors[n].layout();
        }, 800);
        if (scroll !== false) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    if (n === 2) {
        revealStep(3, false);
        revealStep(4, false);
    }
}

/* ==========================================================================
   SIGNER LINKS BANNER (Step 2)
   ========================================================================== */

function showSignerLinksBanner(externUsers) {
    var slot = document.getElementById('step2-success-slot');
    var tpl = document.getElementById('tpl-signer-links-banner');
    var clone = tpl.content.cloneNode(true);

    var cardsSlot = clone.querySelector('[data-slot="signer-cards"]');
    for (var i = 0; i < externUsers.length; i++) {
        var u = externUsers[i];
        if (!u.url) continue;
        var name = u.realName || u.recipient || ('Signer ' + (i + 1));
        var role = (u.roles && u.roles.length > 0) ? u.roles.join(', ') : '';

        var cardTpl = document.getElementById('tpl-signer-link-card');
        var cardClone = cardTpl.content.cloneNode(true);
        cardClone.querySelector('[data-slot="name"]').textContent = name;
        if (role) {
            cardClone.querySelector('[data-slot="role"]').textContent = '(' + role + ')';
        } else {
            cardClone.querySelector('[data-slot="role"]').remove();
        }
        cardClone.querySelector('[data-slot="link"]').href = u.url;
        cardsSlot.appendChild(cardClone);
    }

    slot.innerHTML = '';
    slot.appendChild(clone);
}

/* ==========================================================================
   SIGNATURE WATCH - detect signing in the other tab
   ========================================================================== */

var sigWatchInterval = null;
var sigWatchBaseline = 0;
var sigWatchFired = false;

function startSignatureWatch() {
    if (sigWatchInterval || sigWatchFired || !sessionId) return;

    // Get baseline signature count
    fetchSignatureCount(function (count) {
        sigWatchBaseline = count;
        // Poll every 4s
        sigWatchInterval = setInterval(function () { checkForNewSignatures(); }, 4000);
        // Also check when user returns to this tab
        document.addEventListener('visibilitychange', onTabFocus);
    });
}

function stopSignatureWatch() {
    if (sigWatchInterval) { clearInterval(sigWatchInterval); sigWatchInterval = null; }
    document.removeEventListener('visibilitychange', onTabFocus);
}

function onTabFocus() {
    if (!document.hidden) checkForNewSignatures();
}

function fetchSignatureCount(cb) {
    apiClient.call('POST', '/get/status', { body: { sessionid: sessionId } })
        .then(function (result) {
            if (!result.ok || !result.body) { cb(0); return; }
            var total = 0;
            var docs = result.body.documentData || [];
            for (var i = 0; i < docs.length; i++) {
                total += (docs[i].numberOfSignatures || 0);
            }
            cb(total);
        })
        .catch(function () { cb(0); });
}

function checkForNewSignatures() {
    if (sigWatchFired) return;
    fetchSignatureCount(function (count) {
        if (count > sigWatchBaseline) {
            sigWatchFired = true;
            stopSignatureWatch();
            showSigningCelebration(count);
        }
    });
}

/* ==========================================================================
   SIGNING CELEBRATION
   ========================================================================== */

function showSigningCelebration(sigCount) {
    // 3x cannon confetti + balloons
    if (isConfettiEnabled()) launchConfetti(3);

    var slot = document.getElementById('signing-celebration-slot');
    var tpl = document.getElementById('tpl-signing-celebration');
    var clone = tpl.content.cloneNode(true);

    clone.querySelector('[data-slot="sig-count"]').innerHTML =
        '<strong>' + sigCount + ' signature' + (sigCount > 1 ? 's' : '') + '</strong> captured. ' +
        'The document is sealed and ready for download.';

    // Wire check-status button
    clone.querySelector('[data-action="check-status"]').addEventListener('click', function () {
        revealStep(3);
        setTimeout(function () { sendStep(3); }, 900);
    });

    // Add confetti toggle
    clone.querySelector('[data-slot="confetti-toggle"]').appendChild(cloneConfettiToggle());

    slot.innerHTML = '';
    slot.appendChild(clone);
    slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

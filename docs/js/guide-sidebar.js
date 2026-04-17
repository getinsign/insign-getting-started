'use strict';

/* ==========================================================================
   Getting Started Guide - Session Sidebar Status Card
   Uses <template> clone-modify-insert for dynamic content.
   ========================================================================== */

var _scPollTimer = null;

function toggleMobileSidebar() {
    var sidebar = document.getElementById('session-sidebar');
    var body = document.getElementById('sc-body');
    var footer = sidebar.querySelector('.sc-refresh-btn');
    var updated = document.getElementById('sc-updated');
    if (body.style.display === 'none') {
        body.style.display = '';
        if (footer) footer.style.display = '';
        if (updated) updated.style.display = '';
    } else {
        body.style.display = 'none';
        if (footer) footer.style.display = 'none';
        if (updated) updated.style.display = 'none';
    }
}

function showSessionSidebar() {
    var sidebar = document.getElementById('session-sidebar');
    if (sidebar) {
        sidebar.classList.add('visible');
        refreshSessionStatus();
        // Auto-poll every 10s
        if (_scPollTimer) clearInterval(_scPollTimer);
        _scPollTimer = setInterval(refreshSessionStatus, 10000);
    }
}

function refreshSessionStatus() {
    if (!sessionId) return;
    document.getElementById('sc-sid').textContent = sessionId;

    apiClient.call('POST', '/get/status', { body: { sessionid: sessionId } })
        .then(function (result) {
            if (!result.ok || !result.body) return;
            renderSidebarStatus(result.body);
            pruneFullySignedRolesFromStep2(result.body);
        })
        .catch(function () {});
}

/**
 * Remove externUsers from Step 2 JSON whose roles are already fully signed.
 * A role is fully signed when all its signature fields have signed=true.
 */
function pruneFullySignedRolesFromStep2(statusData) {
    if (!editors[2]) return;
    var sigFields = statusData.signaturFieldsStatusList || [];
    if (sigFields.length === 0) return;

    // Build map: role -> { total, signed }
    var roleCounts = {};
    for (var i = 0; i < sigFields.length; i++) {
        var role = sigFields[i].role || sigFields[i].quickInfoParsedRole || '';
        if (!role) continue;
        if (!roleCounts[role]) roleCounts[role] = { total: 0, signed: 0 };
        roleCounts[role].total++;
        if (sigFields[i].signed) roleCounts[role].signed++;
    }

    // Determine which roles are fully signed
    var fullySigned = {};
    for (var r in roleCounts) {
        if (roleCounts[r].signed >= roleCounts[r].total) {
            fullySigned[r] = true;
        }
    }
    if (Object.keys(fullySigned).length === 0) return;

    // Parse Step 2 editor JSON
    var step2Val;
    try { step2Val = JSON.parse(editors[2].getValue()); } catch (_) { return; }
    if (!step2Val || !Array.isArray(step2Val.externUsers)) return;

    var original = step2Val.externUsers.length;
    step2Val.externUsers = step2Val.externUsers.filter(function (user) {
        if (!Array.isArray(user.roles)) return true;
        // Keep the user if they have at least one role that is NOT fully signed
        return user.roles.some(function (role) { return !fullySigned[role]; });
    });

    // Only update editor if something was actually removed
    if (step2Val.externUsers.length < original) {
        editors[2].setValue(JSON.stringify(step2Val, null, 2));
    }
}

/* ==========================================================================
   RENDER SIDEBAR STATUS
   Uses <template id="tpl-sidebar-sig-item"> for signature field rows.
   Info rows use createElement (simple one-off elements).
   ========================================================================== */

function renderSidebarStatus(data) {
    var completed = !!data.sucessfullyCompleted;
    var docData = data.documentData || [];
    var sigFields = data.signaturFieldsStatusList || [];
    var totalSigs = 0;
    for (var i = 0; i < docData.length; i++) {
        totalSigs += (docData[i].numberOfSignatures || 0);
    }
    var signedFields = sigFields.filter(function (f) { return !!f.signed; });
    var totalFields = sigFields.length;
    var hasSigs = totalSigs > 0 || signedFields.length > 0;

    // Header icon
    var iconEl = document.getElementById('sc-icon');
    if (completed) {
        iconEl.className = 'sc-header-icon sc-completed';
        iconEl.innerHTML = '<i class="bi bi-check-lg"></i>';
    } else if (hasSigs) {
        iconEl.className = 'sc-header-icon sc-active';
        iconEl.innerHTML = '<i class="bi bi-pen"></i>';
    } else {
        iconEl.className = 'sc-header-icon sc-pending';
        iconEl.innerHTML = '<i class="bi bi-clock"></i>';
    }

    // Build body content using DOM methods
    var body = document.getElementById('sc-body');
    body.textContent = '';

    // Status badge
    var badgeCls = completed ? 'sc-badge-completed' : (hasSigs ? 'sc-badge-active' : 'sc-badge-pending');
    var badgeLabel = completed ? 'Completed' : (hasSigs ? 'In Progress' : 'Pending');
    appendInfoRow(body, 'Status', function (valSpan) {
        var badge = document.createElement('span');
        badge.className = 'sc-badge ' + badgeCls;
        if (!completed) {
            var pulse = document.createElement('span');
            pulse.className = 'sc-pulse';
            badge.appendChild(pulse);
        }
        badge.appendChild(document.createTextNode(badgeLabel));
        valSpan.appendChild(badge);
    });

    appendInfoRow(body, 'Signatures', function (valSpan) {
        valSpan.textContent = totalSigs;
    });

    appendInfoRow(body, 'Completed', function (valSpan) {
        var icon = document.createElement('i');
        if (completed) {
            icon.className = 'bi bi-check-circle-fill';
            icon.style.color = '#28a745';
        } else {
            icon.className = 'bi bi-dash-circle';
            icon.style.color = 'var(--insign-text-muted)';
        }
        valSpan.appendChild(icon);
    });

    // Documents
    for (var d = 0; d < docData.length; d++) {
        var doc = docData[d];
        appendInfoRow(body, null, function (valSpan) {
            valSpan.textContent = (doc.numberOfSignatures || 0) + ' sig' + ((doc.numberOfSignatures || 0) !== 1 ? 's' : '');
        }, function (labelSpan) {
            var pdfIcon = document.createElement('i');
            pdfIcon.className = 'bi bi-file-earmark-pdf';
            pdfIcon.style.color = '#dc3545';
            labelSpan.appendChild(pdfIcon);
            labelSpan.appendChild(document.createTextNode(' ' + (doc.displayname || doc.docid)));
        });
    }

    // Signature fields
    if (totalFields > 0) {
        var sigList = document.createElement('div');
        sigList.className = 'sc-sig-list';
        for (var s = 0; s < sigFields.length; s++) {
            var f = sigFields[s];
            var isSigned = !!f.signed;
            var role = f.role || f.quickInfoParsedRole || f.fieldID || '';
            var name = f.displayname || f.quickInfoParsedName || '';

            var tpl = document.getElementById('tpl-sidebar-sig-item');
            var clone = tpl.content.cloneNode(true);

            var iconNode = clone.querySelector('[data-slot="icon"]');
            iconNode.className = 'bi ' + (isSigned ? 'bi-check-circle-fill sc-signed' : 'bi-circle sc-unsigned');

            clone.querySelector('[data-slot="role"]').textContent = role;
            if (name) {
                clone.querySelector('[data-slot="name"]').textContent = ' ' + name;
            } else {
                clone.querySelector('[data-slot="name"]').remove();
            }

            var statusNode = clone.querySelector('[data-slot="status"]');
            statusNode.className = 'sc-sig-status ' + (isSigned ? 'sc-is-signed' : 'sc-is-unsigned');
            statusNode.textContent = isSigned ? 'Signed' : 'Pending';

            sigList.appendChild(clone);
        }
        body.appendChild(sigList);

        // Progress bar
        var pct = Math.round((signedFields.length / totalFields) * 100);
        var progress = document.createElement('div');
        progress.className = 'sc-progress';

        var bar = document.createElement('div');
        bar.className = 'sc-progress-bar';
        var fill = document.createElement('div');
        fill.className = 'sc-progress-fill';
        fill.style.width = pct + '%';
        bar.appendChild(fill);
        progress.appendChild(bar);

        var progressText = document.createElement('div');
        progressText.className = 'sc-progress-text';
        progressText.textContent = signedFields.length + '/' + totalFields + ' (' + pct + '%)';
        progress.appendChild(progressText);

        body.appendChild(progress);
    }

    // Updated timestamp
    var upd = document.getElementById('sc-updated');
    if (upd) upd.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

/** Helper: append a styled info row to a container */
function appendInfoRow(container, labelText, valueFn, labelFn) {
    var row = document.createElement('div');
    row.className = 'sc-info-row';

    var label = document.createElement('span');
    label.className = 'sc-info-label';
    if (labelFn) {
        labelFn(label);
    } else {
        label.textContent = labelText;
    }
    row.appendChild(label);

    var value = document.createElement('span');
    value.className = 'sc-info-value';
    valueFn(value);
    row.appendChild(value);

    container.appendChild(row);
}

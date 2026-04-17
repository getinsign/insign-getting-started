'use strict';

/* ==========================================================================
   Feature Configurator & Saved Connection Profiles
   ========================================================================== */

// =====================================================================
// Feature configurator - visual toggles for session properties
// =====================================================================

// Feature groups & descriptions loaded from external JSON
var featureDescriptions = {}; // key -> { globalProperty, description }
var FEATURE_GROUPS = [];
var UNCOVERED_FEATURES = []; // spec-derived features not in FEATURE_GROUPS (populated after schema loads)

async function loadFeatureData() {
    try {
        const resp = await fetch('data/feature-descriptions.json');
        if (resp.ok) {
            const data = await resp.json();
            // Load feature groups
            if (data.featureGroups) {
                FEATURE_GROUPS = data.featureGroups;
            }
            // Load descriptions (from the array or from per-group features)
            const descArr = data.featureDescriptions || [];
            for (const item of descArr) {
                featureDescriptions[item.key] = item;
            }
        }
    } catch (e) {
        console.error('Failed to load feature-descriptions.json:', e);
        var container = document.getElementById('feature-toggles');
        if (container) {
            var alert = document.createElement('div');
            alert.className = 'alert alert-danger d-flex align-items-center gap-2 my-2';
            alert.style.fontSize = '0.82rem';
            alert.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> '
                + 'Could not load feature descriptions (<code>data/feature-descriptions.json</code>): '
                + (e.message || 'unknown error');
            container.appendChild(alert);
        }
    }
}

function getFeatureDesc(key, fallback) {
    const entry = featureDescriptions[key];
    if (entry && entry.description) return entry.description;
    // Fallback to OpenAPI spec description
    var loader = window.state && window.state.schemaLoader;
    if (loader && loader.guiPropertyKeys && loader.guiPropertyKeys[key]) {
        return loader.guiPropertyKeys[key].description;
    }
    return fallback || '';
}

function getGlobalProperty(key) {
    const entry = featureDescriptions[key];
    if (entry && entry.globalProperty) return entry.globalProperty;
    // Fallback to OpenAPI spec
    var loader = window.state && window.state.schemaLoader;
    if (loader && loader.guiPropertyKeys && loader.guiPropertyKeys[key]) {
        return loader.guiPropertyKeys[key].globalProperty;
    }
    return null;
}

const FEATURE_STORE_KEY = 'insign-feature-settings';
var STATE_STORE_KEY = 'insign-explorer-state';

function loadFeatureSettings() {
    try {
        const raw = localStorage.getItem(FEATURE_STORE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveFeatureSettings(settings) {
    if (loadProfiles().length === 0) return; // only persist when user has saved profiles
    try { localStorage.setItem(FEATURE_STORE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

// =====================================================================
// Saved connection profiles
// =====================================================================
const PROFILES_STORE_KEY = 'insign-explorer-profiles';
const SANDBOX_PROFILE = {
    baseUrl: 'https://sandbox.test.getinsign.show',
    username: 'controller',
    password: 'pwd.insign.sandbox.4561',
    fixed: true
};
var _profileProbeAbort = null;

function loadProfiles() {
    try {
        const raw = localStorage.getItem(PROFILES_STORE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveProfiles(profiles) {
    try { localStorage.setItem(PROFILES_STORE_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
}

function isSandboxProfile(p) {
    return p && p.baseUrl === SANDBOX_PROFILE.baseUrl && p.username === SANDBOX_PROFILE.username;
}

/** Probe credentials via /version endpoint, then save if valid (button-triggered) */
function saveConnectionProfile() {
    var baseUrl = ($('#cfg-base-url').val() || '').trim().replace(/\/+$/, '');
    var username = ($('#cfg-username').val() || '').trim();
    var password = ($('#cfg-password').val() || '').trim();
    if (!baseUrl || !username) {
        showToast('Please enter a base URL and username first.', 'warning');
        return;
    }

    var $btn = $('#btn-save-connection');
    var origHtml = $btn.html();
    $btn.prop('disabled', true).html('<i class="bi bi-hourglass-split"></i> Verifying...');

    if (_profileProbeAbort) _profileProbeAbort.abort();
    _profileProbeAbort = new AbortController();

    // Build the fetch URL (through CORS proxy if enabled)
    var versionUrl = baseUrl + '/version';
    var corsProxy = $('#cfg-cors-proxy').is(':checked');
    var fetchUrl = corsProxy ? ($('#cfg-cors-proxy-url').val() || 'http://localhost:9009/?') + encodeURIComponent(versionUrl) : versionUrl;

    // Use basic auth to verify credentials work
    var headers = { 'Authorization': 'Basic ' + btoa(username + ':' + password) };

    fetch(fetchUrl, { method: 'GET', headers: headers, signal: _profileProbeAbort.signal, mode: 'cors', cache: 'no-store' })
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            // Credentials work - save profile with all settings
            var profiles = loadProfiles();
            var idx = profiles.findIndex(function(p) { return p.baseUrl.replace(/\/+$/, '') === baseUrl && p.username === username; });
            var entry = {
                baseUrl: baseUrl,
                username: username,
                password: password,
                corsProxy: corsProxy,
                corsProxyUrl: corsProxy ? ($('#cfg-cors-proxy-url').val() || '') : '',
                webhooksEnabled: $('#cfg-webhooks').is(':checked'),
                webhookProvider: state.webhookProvider || 'smee',
                webhookCustomUrl: $('#cfg-webhook-custom-url').val() || '',
                updatedAt: Date.now()
            };
            if (idx >= 0) {
                profiles[idx] = entry;
            } else {
                profiles.push(entry);
            }
            if (profiles.length > 20) profiles = profiles.slice(-20);
            saveProfiles(profiles);
            renderProfiles();

            // Show localStorage warning
            $('#save-credentials-warning').removeClass('d-none');

            $btn.html('<i class="bi bi-check-lg"></i> Saved!');
            setTimeout(function() { $btn.html(origHtml); updateSaveButtonState(); }, 2000);
            showToast('Connection saved.', 'success');
        })
        .catch(function(err) {
            // Save anyway but warn that verification failed
            var profiles = loadProfiles();
            var idx = profiles.findIndex(function(p) { return p.baseUrl.replace(/\/+$/, '') === baseUrl && p.username === username; });
            var entry = {
                baseUrl: baseUrl,
                username: username,
                password: password,
                corsProxy: corsProxy,
                corsProxyUrl: corsProxy ? ($('#cfg-cors-proxy-url').val() || '') : '',
                webhooksEnabled: $('#cfg-webhooks').is(':checked'),
                webhookProvider: state.webhookProvider || 'smee',
                webhookCustomUrl: $('#cfg-webhook-custom-url').val() || '',
                updatedAt: Date.now()
            };
            if (idx >= 0) {
                profiles[idx] = entry;
            } else {
                profiles.push(entry);
            }
            if (profiles.length > 20) profiles = profiles.slice(-20);
            saveProfiles(profiles);
            renderProfiles();
            $('#save-credentials-warning').removeClass('d-none');

            $btn.html('<i class="bi bi-check-lg"></i> Saved');
            setTimeout(function() { $btn.html(origHtml); updateSaveButtonState(); }, 2000);
            showToast('Connection saved (could not verify: ' + err.message + ').', 'warning');
        });
}

/** Enable save button only when current credentials differ from any saved profile */
function updateSaveButtonState() {
    var $btn = $('#btn-save-connection');
    if (!$btn.length) return;
    var $wrap = $btn.closest('div');
    var baseUrl = ($('#cfg-base-url').val() || '').trim().replace(/\/+$/, '');
    var username = ($('#cfg-username').val() || '').trim();
    var password = ($('#cfg-password').val() || '').trim();
    if (!baseUrl || !username) { $wrap.addClass('d-none'); return; }
    // Check if this exact combo already exists in saved profiles
    var all = getAllProfiles();
    var alreadySaved = all.some(function(p) {
        return p.baseUrl.replace(/\/+$/, '').toLowerCase() === baseUrl.toLowerCase()
            && p.username.toLowerCase() === username.toLowerCase()
            && p.password === password;
    });
    $wrap.toggleClass('d-none', alreadySaved);
    // Warning stays visible as long as any profiles exist - only hidden when all deleted
    $('#save-credentials-warning').toggleClass('d-none', loadProfiles().length === 0);
}

function deleteProfile(index) {
    var profiles = loadProfiles();
    if (isSandboxProfile(profiles[index])) return; // can't delete sandbox
    profiles.splice(index, 1);
    saveProfiles(profiles);
    renderProfiles();
    // If no profiles left, clear all persisted state
    if (profiles.length === 0) {
        clearAllStorage();
    }
    updateSaveButtonState();
}

/** Remove all app data from localStorage (profiles, state, settings, etc.) */
function clearAllStorage() {
    var keys = [
        PROFILES_STORE_KEY, STATE_STORE_KEY, FEATURE_STORE_KEY,
        'insign-extern-options', 'insign-explorer-userid'
    ];
    for (var i = 0; i < keys.length; i++) {
        try { localStorage.removeItem(keys[i]); } catch { /* ignore */ }
    }
    $('#save-credentials-warning').addClass('d-none');
    renderProfiles();
    updateSaveButtonState();
}

var _selectedProfileKey = null; // track active selection explicitly
var _profileSelecting = false; // guard against change handlers clearing key

function selectProfile(p) {
    _profileSelecting = true;
    _selectedProfileKey = p.baseUrl.replace(/\/+$/, '').toLowerCase() + '|' + p.username.toLowerCase();
    $('#cfg-base-url').val(p.baseUrl);
    $('#cfg-username').val(p.username);
    $('#cfg-password').val(p.password);
    // Restore CORS and webhook settings if saved (without triggering change to avoid side effects)
    if (p.corsProxy !== undefined) {
        $('#cfg-cors-proxy').prop('checked', p.corsProxy);
        $('#cors-proxy-url-group').css('display', p.corsProxy ? '' : 'none');
        if (p.corsProxyUrl) $('#cfg-cors-proxy-url').val(p.corsProxyUrl);
    }
    if (p.webhooksEnabled !== undefined) {
        $('#cfg-webhooks').prop('checked', p.webhooksEnabled);
        $('#webhook-provider-group').css('display', p.webhooksEnabled ? '' : 'none');
        $('#webhook-relay-warning').toggleClass('d-none', !p.webhooksEnabled);
    }
    if (p.webhookProvider) {
        state.webhookProvider = p.webhookProvider;
    }
    if (p.webhookCustomUrl) {
        $('#cfg-webhook-custom-url').val(p.webhookCustomUrl);
    }
    // Sync OAuth2 credentials (programmatic .val() doesn't fire change events)
    syncOAuth2Credentials();
    // Trigger base URL change to update API client and CORS visibility
    $('#cfg-base-url').trigger('change');
    _profileSelecting = false;
    renderProfiles();
    updateSaveButtonState();
    saveAppState();
}

/** Update the currently selected profile's CORS/webhook settings in-place */
function updateSelectedProfile() {
    if (!_selectedProfileKey || _profileSelecting) return;
    var profiles = loadProfiles();
    var changed = false;
    for (var i = 0; i < profiles.length; i++) {
        var key = profiles[i].baseUrl.replace(/\/+$/, '').toLowerCase() + '|' + profiles[i].username.toLowerCase();
        if (key === _selectedProfileKey) {
            profiles[i].corsProxy = $('#cfg-cors-proxy').is(':checked');
            profiles[i].corsProxyUrl = $('#cfg-cors-proxy-url').val() || '';
            profiles[i].webhooksEnabled = $('#cfg-webhooks').is(':checked');
            profiles[i].webhookProvider = state.webhookProvider || 'smee';
            profiles[i].webhookCustomUrl = $('#cfg-webhook-custom-url').val() || '';
            changed = true;
            break;
        }
    }
    if (changed) saveProfiles(profiles);
}

function getAllProfiles() {
    // Sandbox is always first and always present
    var saved = loadProfiles();
    // Filter out any duplicate sandbox entries from saved
    var filtered = saved.filter(function(p) { return !isSandboxProfile(p); });
    return [SANDBOX_PROFILE].concat(filtered);
}

function renderProfiles() {
    var $group = $('#saved-profiles-group');
    var all = getAllProfiles();
    // Only show if there are entries beyond sandbox
    if (all.length <= 1) {
        $group.addClass('d-none');
        return;
    }
    $group.removeClass('d-none');

    var currentUrl = ($('#cfg-base-url').val() || '').trim().replace(/\/+$/, '').toLowerCase();
    var currentUser = ($('#cfg-username').val() || '').trim().toLowerCase();

    // Build dropdown entries
    var $container = $('#saved-profiles-list');
    var html = '<div class="saved-profiles-dropdown">'
        + '<button type="button" class="saved-profiles-toggle" id="saved-profiles-btn">';

    // Find active entry for button label
    var activeLabel = 'Select connection...';
    var activeIdx = -1;
    for (var i = 0; i < all.length; i++) {
        var entryUrl = all[i].baseUrl.replace(/\/+$/, '').toLowerCase();
        var entryUser = all[i].username.toLowerCase();
        if ((entryUrl === currentUrl && entryUser === currentUser) ||
            (_selectedProfileKey && (entryUrl + '|' + entryUser) === _selectedProfileKey)) {
            activeIdx = i;
            var label = all[i].baseUrl.replace(/^https?:\/\//, '');
            activeLabel = label + ' <span class="profile-user">@' + all[i].username + '</span>';
            break;
        }
    }
    html += activeLabel + ' <i class="bi bi-chevron-down" style="font-size:0.65rem;margin-left:4px"></i></button>';
    html += '<div class="saved-profiles-menu" id="saved-profiles-menu">';

    for (var j = 0; j < all.length; j++) {
        var p = all[j];
        var isActive = (j === activeIdx);
        var shortUrl = p.baseUrl.replace(/^https?:\/\//, '');
        html += '<div class="saved-profile-entry' + (isActive ? ' active' : '') + '" data-idx="' + j + '">'
            + '<span class="profile-label" title="' + p.baseUrl + '">' + shortUrl
            + '<span class="profile-user">@' + (p.username || '?') + '</span></span>';
        if (!p.fixed) {
            html += '<button type="button" class="profile-delete" data-idx="' + j + '" title="Remove">&times;</button>';
        }
        html += '</div>';
    }
    html += '</div></div>';
    $container.html(html);

    // Toggle dropdown
    $container.find('#saved-profiles-btn').on('click', function(e) {
        e.stopPropagation();
        var $menu = $container.find('#saved-profiles-menu');
        $menu.toggleClass('open');
        // Close on outside click
        if ($menu.hasClass('open')) {
            $(document).one('click', function() { $menu.removeClass('open'); });
        }
    });

    // Select entry
    $container.find('.saved-profile-entry').on('click', function(e) {
        if ($(e.target).hasClass('profile-delete')) return;
        e.stopPropagation();
        $container.find('#saved-profiles-menu').removeClass('open');
        var idx = parseInt($(this).attr('data-idx'));
        selectProfile(all[idx]);
    });

    // Delete entry
    $container.find('.profile-delete').on('click', function(e) {
        e.stopPropagation();
        var idx = parseInt($(this).attr('data-idx'));
        // idx in all[] array, but sandbox is at 0 and not in saved profiles
        // Find index in saved profiles (skip sandbox)
        var savedProfiles = loadProfiles();
        var target = all[idx];
        var savedIdx = savedProfiles.findIndex(function(p) { return p.baseUrl === target.baseUrl && p.username === target.username; });
        if (savedIdx >= 0) deleteProfile(savedIdx);
    });
}

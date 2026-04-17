'use strict';

/* ==========================================================================
   Persistent App State & Feature Toggles UI
   ========================================================================== */


// =====================================================================
// Persistent app state (survives reload / browser restart)
// =====================================================================

function saveAppState() {
    const hasSavedProfiles = loadProfiles().length > 0;
    if (!hasSavedProfiles) {
        // No saved connections - clear all persisted state
        try { localStorage.removeItem(STATE_STORE_KEY); } catch { /* ignore */ }
        return;
    }
    // Persist userId now that user has saved profiles
    try { localStorage.setItem('insign-explorer-userid', state.userId); } catch { /* ignore */ }
    // Read previously saved state so that early saveAppState() calls
    // (before Monaco or DOM fields are fully populated) don't overwrite
    // values with empty strings.
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(STATE_STORE_KEY)); } catch { /* ignore */ }

    // Editor content: use live editor if available, else preserve previous
    let editorContent = null;
    if (state.editors['create-session']) {
        try { editorContent = state.editors['create-session'].getValue(); } catch { /* ignore */ }
    } else if (prev) {
        editorContent = prev.createSessionContent || null;
    }

    // Owner fields: use DOM value if non-empty, else preserve previous
    const foruser = $('#cfg-foruser').val() || (prev && prev.foruser) || '';
    const userfullname = $('#cfg-userfullname').val() || (prev && prev.userfullname) || '';
    const userEmail = $('#cfg-userEmail').val() || (prev && prev.userEmail) || '';
    const displayname = $('#cfg-displayname').val() || (prev && prev.displayname) || '';

    const data = {
        sessionId: state.sessionId,
        createSessionContent: editorContent,
        lastForuser: state.lastForuser || '',
        accessURL: state.accessURL,
        webhookProvider: state.webhookProvider,
        webhookCustomUrl: $('#cfg-webhook-custom-url').val() || '',
        webhookUrl: state.webhookUrl,
        selectedDoc: state.selectedDoc,
        fileDelivery: state.fileDelivery,
        selectedProfileKey: _selectedProfileKey,
        corsProxy: $('#cfg-cors-proxy').is(':checked'),
        corsProxyUrl: $('#cfg-cors-proxy-url').val() || '',
        webhooksEnabled: $('#cfg-webhooks').length ? $('#cfg-webhooks').is(':checked') : false,
        displayname: displayname,
        foruser: foruser,
        userfullname: userfullname,
        userEmail: userEmail,
        pollingEnabled: $('#sidebar-polling-toggle').is(':checked'),
        baseUrl: $('#cfg-base-url').val() || '',
        username: $('#cfg-username').val() || '',
        password: $('#cfg-password').val() || '',
        authMode: state.authMode || 'basic',
        brandSyncDoc: $('#brand-sync-doc').is(':checked'),
        brandColors: {
            primary: $('#brand-color-primary').val() || '',
            accent: $('#brand-color-accent').val() || '',
            dark: $('#brand-color-dark').val() || '',
            error: $('#brand-color-error').val() || ''
        },
        brandColorScheme: document.querySelector('.color-scheme-btn.active')
            ? [...document.querySelectorAll('.color-scheme-btn')].indexOf(document.querySelector('.color-scheme-btn.active'))
            : -1,
        brandLogoSet: document.querySelector('.logo-set-card.active')
            ? [...document.querySelectorAll('.logo-set-card')].indexOf(document.querySelector('.logo-set-card.active'))
            : 0,
        brandLogos: {
            icon: $('#brand-app-icon').val() || '',
            mail: $('#brand-mail-header-image').val() || '',
            login: $('#brand-logo-extern').val() || ''
        }
    };
    if (state.apiClient && state.apiClient.oauth2Token) {
        data.oauth2Token = state.apiClient.oauth2Token;
        data.oauth2ExpiresAt = state.apiClient.oauth2ExpiresAt;
    }
    try { localStorage.setItem(STATE_STORE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadAppState() {
    try {
        const raw = localStorage.getItem(STATE_STORE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function restoreAppState() {
    const saved = loadAppState();
    if (!saved) return;

    // Restore selected profile key and apply the matching profile
    if (saved.selectedProfileKey) {
        _selectedProfileKey = saved.selectedProfileKey;
        // Find the matching profile and apply its connection fields
        var allProfiles = getAllProfiles();
        for (var i = 0; i < allProfiles.length; i++) {
            var pUrl = allProfiles[i].baseUrl.replace(/\/+$/, '').toLowerCase();
            var pUser = allProfiles[i].username.toLowerCase();
            if ((pUrl + '|' + pUser) === _selectedProfileKey) {
                _profileSelecting = true;
                $('#cfg-base-url').val(allProfiles[i].baseUrl);
                $('#cfg-username').val(allProfiles[i].username);
                $('#cfg-password').val(allProfiles[i].password);
                _profileSelecting = false;
                break;
            }
        }
    } else if (saved.baseUrl) {
        // No profile selected - restore raw field values
        $('#cfg-base-url').val(saved.baseUrl);
        if (saved.username) $('#cfg-username').val(saved.username);
        if (saved.password) $('#cfg-password').val(saved.password);
    }

    // Restore CORS proxy
    const $corsToggle = $('#cfg-cors-proxy');
    if ($corsToggle.length && saved.corsProxy) {
        $corsToggle.prop('checked', true);
        $('#cors-proxy-url-group').css('display', '');
        $('#cors-proxy-security-warning').removeClass('d-none');
    }
    if (saved.corsProxyUrl) {
        $('#cfg-cors-proxy-url').val(saved.corsProxyUrl);
    }

    // Restore webhooks toggle
    const $whToggle = $('#cfg-webhooks');
    if ($whToggle.length) {
        $whToggle.prop('checked', saved.webhooksEnabled === true);
        const $providerGroup = $('#webhook-provider-group');
        if ($providerGroup.length) $providerGroup.css('display', $whToggle.is(':checked') ? '' : 'none');
    }

    // Restore webhook provider (fall back to default if saved provider no longer exists)
    if (saved.webhookProvider && WEBHOOK_PROVIDERS[saved.webhookProvider]) {
        state.webhookProvider = saved.webhookProvider;
        var whInfo = WEBHOOK_PROVIDERS[saved.webhookProvider];
        if (whInfo) {
            $('#wh-dd-label').text(whInfo.label);
            $('#wh-dd-badge').text(whInfo.tag);
            $('#wh-dd-toggle .wh-dd-icon').attr('class', 'bi ' + whInfo.icon + ' wh-dd-icon');
            $('#wh-dd-menu .wh-dd-item').each(function () {
                $(this).toggleClass('wh-dd-item-selected', $(this).data('wh') === saved.webhookProvider);
            });
            if (whInfo.needsCustomUrl) {
                $('#webhook-custom-url-group').css('display', '');
            }
        }
    }
    if (saved.webhookCustomUrl) {
        $('#cfg-webhook-custom-url').val(saved.webhookCustomUrl);
    }

    // Restore owner fields
    if (saved.displayname) {
        $('#cfg-displayname').val(saved.displayname);
    }
    if (saved.foruser) {
        $('#cfg-foruser').val(saved.foruser);
        state.userId = saved.foruser;
    }
    if (saved.userfullname) {
        $('#cfg-userfullname').val(saved.userfullname);
    }
    if (saved.userEmail) {
        $('#cfg-userEmail').val(saved.userEmail);
    }

    // Restore file delivery
    if (saved.fileDelivery) {
        state.fileDelivery = saved.fileDelivery;
        var opt = FD_OPTIONS[saved.fileDelivery];
        if (opt) {
            $('#fd-dd-label').text(opt.label);
            $('#fd-dd-toggle .fd-dd-icon').attr('class', 'bi ' + opt.icon + ' fd-dd-icon');
            $('#fd-dd-menu .fd-dd-item').each(function () {
                $(this).toggleClass('fd-dd-item-selected', $(this).data('fd') === saved.fileDelivery);
            });
        }
    }

    // Restore selected document (migrate old 'custom' to 'acme')
    if (saved.selectedDoc && saved.selectedDoc !== 'custom') {
        state.selectedDoc = saved.selectedDoc;
    }

    // Restore polling toggle
    const $pollToggle = $('#sidebar-polling-toggle');
    if ($pollToggle.length && saved.pollingEnabled) {
        $pollToggle.prop('checked', true);
    }

    // Restore foruser and session (last so UI elements are ready)
    if (saved.lastForuser) state.lastForuser = saved.lastForuser;
    if (saved.sessionId) {
        // Defer so editors are initialized first
        setTimeout(() => setSessionId(saved.sessionId, saved.accessURL || null), 100);
    }

    // Restore webhook URL for session JSON
    if (saved.webhookUrl) {
        state.webhookUrl = saved.webhookUrl;
    }

    // Restore auth mode and OAuth2 token
    if (saved.authMode) {
        state.authMode = saved.authMode;
    }
    if (saved.oauth2Token && saved.oauth2ExpiresAt && Date.now() < saved.oauth2ExpiresAt) {
        // Defer until apiClient is created
        state._pendingOAuth2 = { token: saved.oauth2Token, expiresAt: saved.oauth2ExpiresAt };
    }
}

/**
 * Build a single feature toggle element from a feature descriptor.
 * @param {object} f - Feature descriptor { key, label, type, path, desc, options, globalProperty }
 * @param {object} saved - Current saved feature settings
 * @returns {HTMLElement}
 */
function _buildFeatureToggle(f, saved) {
    const savedVal = saved[f.key];
    const richDesc = getFeatureDesc(f.key, f.desc);
    const globalProp = f.globalProperty || getGlobalProperty(f.key);
    const plainDesc = richDesc ? richDesc.replace(/<[^>]*>/g, ' ') : '';
    const searchText = [f.label || '', f.key, globalProp || '', plainDesc].join(' ').toLowerCase();

    let tplId;
    if (f.type === 'bool') tplId = 'tpl-feature-bool';
    else if (f.type === 'select') tplId = 'tpl-feature-select';
    else tplId = 'tpl-feature-text';

    const el = document.getElementById(tplId).content.cloneNode(true).firstElementChild;
    el.dataset.search = searchText;

    // Info button
    const infoBtn = el.querySelector('.feature-info-btn');
    const descId = 'fdesc-' + f.key;
    const infoId = 'finfo-' + f.key;
    infoBtn.id = infoId;
    infoBtn.addEventListener('click', () => window.app.toggleDescPin(descId, infoId));

    // Label
    const labelEl = el.querySelector('.feature-label');
    const keySpan = labelEl.querySelector('.feature-key');
    keySpan.textContent = f.key;
    if (f.label) labelEl.insertBefore(document.createTextNode(f.label + ' '), keySpan);
    if (globalProp) {
        const propSpan = document.createElement('span');
        propSpan.className = 'feature-prop-inline';
        propSpan.textContent = globalProp;
        labelEl.appendChild(propSpan);
    }

    // Description
    const descEl = el.querySelector('.feature-desc');
    descEl.id = descId;
    descEl.innerHTML = richDesc;

    if (f.type === 'bool') {
        const st = savedVal === true ? 'on' : savedVal === false ? 'off' : 'default';
        const radios = el.querySelectorAll('input[type="radio"]');
        const labels = el.querySelectorAll('.tri-state label');
        const values = ['default', 'on', 'off'];
        const featureVals = ['default', true, false];
        for (let i = 0; i < radios.length; i++) {
            radios[i].name = 'ft-' + f.key;
            radios[i].id = 'ft-' + f.key + '-' + values[i];
            if (values[i] === st) radios[i].checked = true;
            labels[i].htmlFor = radios[i].id;
            const fv = featureVals[i], fk = f.key, fp = f.path;
            radios[i].addEventListener('change', () => window.app.updateFeature(fk, fv, fp));
        }
    } else if (f.type === 'select') {
        const curVal = savedVal !== undefined ? savedVal : '';
        const select = el.querySelector('select');
        select.id = 'ft-' + f.key;
        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = 'Default';
        if (curVal === '') defOpt.selected = true;
        select.appendChild(defOpt);
        for (const o of f.options) {
            const opt = document.createElement('option');
            opt.value = o;
            opt.textContent = o;
            if (o === curVal) opt.selected = true;
            select.appendChild(opt);
        }
        const fk = f.key, fp = f.path;
        select.addEventListener('change', function () { window.app.updateFeature(fk, this.value || 'default', fp); });
    } else {
        const curVal = savedVal !== undefined ? savedVal : '';
        const input = el.querySelector('input[type="text"]');
        input.id = 'ft-' + f.key;
        input.name = 'ft-' + f.key;
        input.value = curVal || '';
        const fk = f.key, fp = f.path;
        input.addEventListener('change', function () { window.app.updateFeature(fk, this.value || 'default', fp); });
    }

    return el;
}

async function buildFeatureToggles() {
    const $container = $('#feature-toggles');
    if (!$container.length) return;

    // Load rich descriptions from external JSON (non-blocking, graceful fallback)
    await loadFeatureData();

    const saved = loadFeatureSettings();
    const containerFrag = document.createDocumentFragment();

    for (const group of FEATURE_GROUPS) {
        const gid = group.title.replace(/\W/g, '');
        const grp = document.getElementById('tpl-feature-group').content.cloneNode(true).firstElementChild;
        const header = grp.querySelector('.feature-group-header');
        header.dataset.bsToggle = 'collapse';
        header.dataset.bsTarget = '#fg-' + gid;
        header.querySelector('.bi').classList.add(group.icon);
        header.querySelector('strong').textContent = group.title;
        const body = grp.querySelector('.collapse');
        body.id = 'fg-' + gid;

        for (const f of group.features) {
            body.appendChild(_buildFeatureToggle(f, saved));
        }

        containerFrag.appendChild(grp);
    }
    $container.empty().append(containerFrag);

    // Floating tooltip on hover (follows mouse, ignores pinned)
    _initFeatureFloatTooltip();

    // Apply saved non-default values to the JSON editor
    applyFeatureSettingsToEditor();
}

/**
 * Re-fill empty feature descriptions after the OpenAPI schema has loaded,
 * then build "uncovered properties" sections for spec properties not in feature-descriptions.json.
 */
function refreshFeatureDescriptions() {
    for (const group of FEATURE_GROUPS) {
        for (const f of group.features) {
            const descEl = document.getElementById('fdesc-' + f.key);
            if (!descEl || descEl.innerHTML) continue;
            const richDesc = getFeatureDesc(f.key, f.desc);
            if (!richDesc) continue;
            descEl.innerHTML = richDesc;
            const toggle = descEl.closest('.feature-toggle');
            if (toggle) {
                const plainDesc = richDesc.replace(/<[^>]*>/g, ' ');
                const prev = toggle.dataset.search || '';
                toggle.dataset.search = prev + ' ' + plainDesc.toLowerCase();
            }
        }
    }

    _buildUncoveredProperties();
}

/**
 * Build interactive toggle groups for OpenAPI spec properties not in feature-descriptions.json.
 * Two sections: uncovered guiProperties and uncovered other (root/sub-object) properties.
 */
function _buildUncoveredProperties() {
    const loader = window.state && window.state.schemaLoader;
    if (!loader || !loader.loaded) return;

    const container = document.getElementById('uncovered-properties');
    if (!container || container.children.length) return;

    // Collect all keys already in feature-descriptions.json
    const coveredKeys = new Set();
    for (const group of FEATURE_GROUPS) {
        for (const f of group.features) {
            coveredKeys.add(f.key);
        }
    }

    // Uncovered guiProperty keys (from the OpenAPI description table)
    const guiFeatures = [];
    for (const [key, info] of Object.entries(loader.guiPropertyKeys)) {
        if (!coveredKeys.has(key)) {
            guiFeatures.push({
                key,
                label: '',
                type: 'bool',
                path: 'guiProperties',
                desc: info.description,
                globalProperty: info.globalProperty
            });
        }
    }
    guiFeatures.sort((a, b) => a.key.localeCompare(b.key));

    // Uncovered root-level & sub-object properties (from the session request schema)
    const sessionSchemaKey = loader.getRequestSchemaKey('/configure/session', 'POST') || 'configureSession';
    const sessionEntry = loader.get(sessionSchemaKey);
    const otherFeatures = [];
    if (sessionEntry && sessionEntry.schema) {
        const resolved = loader._resolveRef(sessionEntry.schema) || sessionEntry.schema;
        _collectUncoveredFeatures(loader, resolved, '', coveredKeys, otherFeatures);
    }
    otherFeatures.sort((a, b) => a.key.localeCompare(b.key));

    // Store for bidirectional sync
    UNCOVERED_FEATURES = guiFeatures.concat(otherFeatures);

    const saved = loadFeatureSettings();
    const frag = document.createDocumentFragment();

    if (guiFeatures.length) {
        frag.appendChild(_buildSpecGroup(
            'bi-puzzle', 'Other GUI Properties',
            'guiProperties keys from the OpenAPI spec not listed above',
            guiFeatures, saved
        ));
    }

    if (otherFeatures.length) {
        frag.appendChild(_buildSpecGroup(
            'bi-diagram-3', 'Other Session Properties',
            'Root and sub-object properties from the OpenAPI spec not listed above',
            otherFeatures, saved
        ));
    }

    container.appendChild(frag);

    // Apply any saved values for uncovered keys to the JSON editor
    applyFeatureSettingsToEditor();
}

/**
 * Recursively collect properties from a schema that aren't in coveredKeys.
 * Returns feature descriptors compatible with _buildFeatureToggle.
 */
function _collectUncoveredFeatures(loader, schema, parentPath, coveredKeys, result) {
    if (!schema || !schema.properties) return;

    // Also merge allOf schemas
    const allProps = Object.assign({}, schema.properties);
    if (Array.isArray(schema.allOf)) {
        for (const sub of schema.allOf) {
            const resolved = loader._resolveRef(sub) || sub;
            if (resolved.properties) Object.assign(allProps, resolved.properties);
        }
    }

    for (const [key, prop] of Object.entries(allProps)) {
        if (key === 'guiProperties') continue;

        const resolved = loader._resolveRef(prop) || prop;

        if (resolved.type === 'array') continue;

        // Sub-object with properties: recurse using the key as the path prefix
        if (resolved.properties) {
            _collectUncoveredFeatures(loader, resolved, key, coveredKeys, result);
            continue;
        }

        if (!coveredKeys.has(key)) {
            // Determine feature type from schema type
            let fType = 'bool';
            let options = null;
            if (resolved.enum) {
                fType = 'select';
                options = resolved.enum;
            } else if (resolved.type === 'string') {
                fType = 'text';
            } else if (resolved.type === 'integer' || resolved.type === 'number') {
                fType = 'text';
            }

            result.push({
                key,
                label: '',
                type: fType,
                options,
                path: parentPath || 'root',
                desc: resolved.description || '',
                globalProperty: null
            });
        }
    }
}

/**
 * Build a collapsible group of interactive toggles from spec-derived feature descriptors.
 */
function _buildSpecGroup(icon, title, subtitle, features, saved) {
    const grpTpl = document.getElementById('tpl-feature-group').content.cloneNode(true).firstElementChild;
    const gid = 'uncov-' + title.replace(/\W/g, '');
    const header = grpTpl.querySelector('.feature-group-header');
    header.dataset.bsToggle = 'collapse';
    header.dataset.bsTarget = '#fg-' + gid;
    header.querySelector('.bi').classList.add(icon);
    const strong = header.querySelector('strong');
    strong.textContent = title;
    const badge = document.createElement('span');
    badge.className = 'badge bg-secondary ms-2';
    badge.style.cssText = 'font-size:0.65rem;vertical-align:middle';
    badge.textContent = features.length;
    strong.appendChild(badge);
    const body = grpTpl.querySelector('.collapse');
    body.id = 'fg-' + gid;

    if (subtitle) {
        const sub = document.createElement('div');
        sub.className = 'text-muted-sm mb-1 px-1';
        sub.textContent = subtitle;
        body.appendChild(sub);
    }

    for (const f of features) {
        body.appendChild(_buildFeatureToggle(f, saved));
    }

    return grpTpl;
}

function _initFeatureFloatTooltip() {
    const tooltip = document.getElementById('feature-float-tooltip');
    if (!tooltip) return;

    $('#feature-toggles, #uncovered-properties').on('mouseenter', '.feature-toggle', function(e) {
        const $desc = $(this).children('.feature-desc');
        if (!$desc.length || $desc.hasClass('pinned')) return;
        tooltip.innerHTML = $desc.html();
        tooltip.style.display = 'block';
        _positionFloatTooltip(e, tooltip);
    }).on('mousemove', '.feature-toggle', function(e) {
        if (tooltip.style.display === 'none') return;
        _positionFloatTooltip(e, tooltip);
    }).on('mouseleave', '.feature-toggle', function() {
        tooltip.style.display = 'none';
    });
}

function _positionFloatTooltip(e, tooltip) {
    const x = e.clientX + 20;
    const y = e.clientY + 20;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    // Keep within viewport
    const finalX = (x + tw > vw) ? Math.max(8, e.clientX - tw - 20) : x;
    const finalY = (y + th > vh) ? Math.max(8, e.clientY - th - 10) : y;
    tooltip.style.left = finalX + 'px';
    tooltip.style.top = finalY + 'px';
}

/** Apply all non-default feature settings to the JSON editor */
function applyFeatureSettingsToEditor() {
    const saved = loadFeatureSettings();
    if (!state.editors['create-session'] || Object.keys(saved).length === 0) return;
    const body = getEditorValue('create-session');
    if (typeof body !== 'object') return;

    let changed = false;
    const allFeatures = [];
    for (const group of FEATURE_GROUPS) {
        for (const f of group.features) allFeatures.push(f);
    }
    for (const f of UNCOVERED_FEATURES) allFeatures.push(f);

    for (const f of allFeatures) {
        const val = saved[f.key];
        if (val === undefined) continue;
        changed = true;
        _setJsonValueForPath(body, f.key, f.path, val);
    }
    if (changed) setEditorValue('create-session', body);
}

/** Set a value in the JSON body at the correct path for a feature */
function _setJsonValueForPath(body, key, path, val) {
    if (path === 'guiProperties') {
        if (!body.guiProperties) body.guiProperties = {};
        body.guiProperties[key] = val;
    } else if (path === 'signConfig') {
        if (!body.signConfig) body.signConfig = {};
        body.signConfig[key] = val;
    } else if (path === 'deliveryConfig') {
        if (!body.deliveryConfig) body.deliveryConfig = {};
        body.deliveryConfig[key] = val;
    } else if (path === 'doc') {
        if (body.documents && body.documents[0]) body.documents[0][key] = val;
    } else {
        body[key] = val;
    }
}

/** Update a feature value in the current session JSON editor */
function updateFeature(key, value, path) {
    const saved = loadFeatureSettings();

    // "default" means remove from JSON and from saved settings
    if (value === 'default') {
        delete saved[key];
        saveFeatureSettings(saved);
        // Remove from the JSON body
        if (state.editors['create-session']) {
            const body = getEditorValue('create-session');
            if (typeof body === 'object') {
                if (path === 'guiProperties' && body.guiProperties) {
                    delete body.guiProperties[key];
                    if (Object.keys(body.guiProperties).length === 0) delete body.guiProperties;
                } else if (path === 'signConfig' && body.signConfig) {
                    delete body.signConfig[key];
                    if (Object.keys(body.signConfig).length === 0) delete body.signConfig;
                } else if (path === 'deliveryConfig' && body.deliveryConfig) {
                    delete body.deliveryConfig[key];
                    if (Object.keys(body.deliveryConfig).length === 0) delete body.deliveryConfig;
                } else if (path === 'doc' && body.documents && body.documents[0]) {
                    delete body.documents[0][key];
                } else {
                    delete body[key];
                }
                setEditorValue('create-session', body);
            }
        }
        _updateFeatureChangedCount();
        return;
    }

    // Save to localStorage
    saved[key] = value;
    saveFeatureSettings(saved);

    // Update JSON editor
    if (!state.editors['create-session']) return;
    const body = getEditorValue('create-session');
    if (typeof body !== 'object') return;

    _setJsonValueForPath(body, key, path, value);
    setEditorValue('create-session', body);
    _updateFeatureChangedCount();
}

'use strict';

/* ==========================================================================
   Code Snippets, Document Selector, IndexedDB
   ========================================================================== */


// =====================================================================
// Code Snippets
// =====================================================================

function initCodeTabs() {
    if (!window.CodeGenerator) return;

    const $tabsEl = $('#code-lang-tabs');
    if (!$tabsEl.length) return;

    const languages = window.CodeGenerator.LANGUAGES;
    const defaultLang = 'java_insign';

    for (const [key, lang] of Object.entries(languages)) {
        const $li = $('<li>');
        $li.addClass('nav-item');
        $li.attr('role', 'presentation');

        const $btn = $('<button>');
        $btn.addClass('nav-link' + (key === defaultLang ? ' active' : ''));
        $btn.text(lang.label);
        $btn.data('lang', key);
        $btn.on('click', () => {
            // Update active tab
            $tabsEl.find('.nav-link').removeClass('active');
            $btn.addClass('active');
            // Generate code
            showCodeSnippet(key);
        });

        $li.append($btn);
        $tabsEl.append($li);
    }

    // Show initial snippet for the default tab
    showCodeSnippet(defaultLang);

    // Docs / Additional toggles - regenerate snippet when toggled
    $('#code-docs-toggle').on('change', () => updateCodeSnippets());
    $('#code-samples-toggle').on('change', () => updateCodeSnippets());

    // Copy to clipboard
    $('#code-copy-btn').on('click', function () {
        const code = getEditorValue('code-snippet');
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            const $btn = $(this);
            $btn.html('<i class="bi bi-check2"></i> Copied');
            setTimeout(() => $btn.html('<i class="bi bi-clipboard"></i> Copy'), 1500);
        });
    });
}

function showCodeSnippet(langKey) {
    if (!window.CodeGenerator || !state.apiClient) return;

    // Code snippets always show the create-session flow (templates are a multi-step
    // walkthrough: create → status → download).  Use lastRequest body only if it was
    // a /configure/session call; otherwise fall back to the current editor body.
    let snippetBody;
    if (state.lastRequest && state.lastRequest.path === '/configure/session') {
        snippetBody = state.lastRequest.body;
    } else {
        try { snippetBody = getEditorValue('create-session'); } catch (e) { /* ignore */ }
        snippetBody = snippetBody || getDefaultCreateSessionBody();
    }
    const req = { method: 'POST', path: '/configure/session', body: snippetBody };

    const context = state.apiClient.getCodeContext(req.method, req.path, req.body);

    // Provide document info for <filedata> handling in code snippets
    context.documentUrl = getDocumentGithubRawUrl();
    context.documentFilename = getDocumentFilename();
    context.includeDocs = $('#code-docs-toggle').is(':checked');
    context.includeSamples = $('#code-samples-toggle').is(':checked');

    const code = window.CodeGenerator.generate(langKey, context);
    const lang = window.CodeGenerator.LANGUAGES[langKey];

    setEditorValue('code-snippet', code, lang.monacoLanguage);
}

function updateCodeSnippets() {
    // Refresh current language tab
    const $activeTab = $('#code-lang-tabs .nav-link.active');
    if ($activeTab.length) {
        showCodeSnippet($activeTab.data('lang'));
    }
}

// =====================================================================
// Document selector
// =====================================================================

// --- PDF Thumbnail lazy-loader (uses pdf.js already loaded by PdfViewer) ---
const _thumbCache = {};
async function renderPdfThumbnail(pdfUrl, canvas, maxHeight = 106) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cached = _thumbCache[pdfUrl];
    if (cached) { _drawThumbFromCache(cached, canvas, dpr); return; }

    try {
        // Reuse pdf.js lib from PdfViewer if loaded, otherwise import
        let pdfjsLib = state.pdfViewer?.lib;
        if (!pdfjsLib) {
            pdfjsLib = await import('../vendor/pdfjs-dist/build/pdf.min.mjs');
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'vendor/pdfjs-dist/build/pdf.worker.min.mjs';
        }
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        // Render at dpr * CSS size for sharp HiDPI thumbnails
        const scale = (maxHeight * dpr) / vp.height;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = (viewport.width / dpr) + 'px';
        canvas.style.height = (viewport.height / dpr) + 'px';
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        _thumbCache[pdfUrl] = {
            w: viewport.width, h: viewport.height,
            cssW: viewport.width / dpr, cssH: viewport.height / dpr,
            data: canvas.toDataURL()
        };
    } catch (e) {
        console.warn('PDF thumbnail failed for', pdfUrl, e);
        // Show a placeholder icon on failure
        const cssW = 56, cssH = maxHeight;
        canvas.width = cssW * dpr; canvas.height = cssH * dpr;
        canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = '#bbb'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('PDF', cssW / 2, cssH / 2 + 7);
    }
}
function _drawThumbFromCache(cached, canvas, dpr) {
    const img = new Image();
    img.onload = () => {
        canvas.width = cached.w; canvas.height = cached.h;
        canvas.style.width = (cached.cssW || cached.w / dpr) + 'px';
        canvas.style.height = (cached.cssH || cached.h / dpr) + 'px';
        canvas.getContext('2d').drawImage(img, 0, 0);
    };
    img.src = cached.data;
}

function _formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// --- Doc customization persistence (renames, deletions, uploaded files) ---
const DOC_CUSTOM_KEY = 'insign-explorer-doc-custom';

function _loadDocCustom() {
    try {
        return JSON.parse(localStorage.getItem(DOC_CUSTOM_KEY)) || {};
    } catch { return {}; }
}
function _saveDocCustom(c) {
    try { localStorage.setItem(DOC_CUSTOM_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

/** Get effective label for a doc key (respects renames) */
function _docLabel(key, doc) {
    const c = _loadDocCustom();
    if (c.renames && c.renames[key]) return c.renames[key];
    return doc ? doc.label : key;
}

/** Check if a predefined doc was hidden */
function _docHidden(key) {
    const c = _loadDocCustom();
    return c.hidden && c.hidden[key];
}

/** Get uploaded files list from localStorage */
function _getUploadedFiles() {
    const c = _loadDocCustom();
    return c.uploads || [];
}

function _saveUploadedFile(record) {
    const c = _loadDocCustom();
    if (!c.uploads) c.uploads = [];
    c.uploads.push(record);
    _saveDocCustom(c);
}

function _removeUploadedFile(id) {
    const c = _loadDocCustom();
    c.uploads = (c.uploads || []).filter(f => f.id !== id);
    if (c.renames) delete c.renames['upload:' + id];
    _saveDocCustom(c);
}

function renameDocItem(key, newName) {
    const c = _loadDocCustom();
    if (!c.renames) c.renames = {};
    c.renames[key] = newName;
    _saveDocCustom(c);
    buildDocumentSelector();
}

function deleteDocItem(key) {
    if (key.startsWith('upload:')) {
        const id = key.substring(7);
        _removeUploadedFile(id);
        // Also remove from IndexedDB
        deleteStoredFile(id).catch(() => {});
        if (state.selectedDoc === key) {
            state.selectedDoc = 'acme';
            state.customFileData = null;
        }
    } else {
        // Hide predefined doc
        const c = _loadDocCustom();
        if (!c.hidden) c.hidden = {};
        c.hidden[key] = true;
        _saveDocCustom(c);
        if (state.selectedDoc === key) {
            state.selectedDoc = 'acme';
        }
    }
    buildDocumentSelector();
    saveAppState();
}

function restoreDocItem(key) {
    const c = _loadDocCustom();
    if (c.hidden) delete c.hidden[key];
    if (c.renames) delete c.renames[key];
    _saveDocCustom(c);
    buildDocumentSelector();
}

function startRenameDocItem(key, currentName) {
    // Close menu clicks shouldn't close while editing
    const $item = $(`.doc-dd-item[data-doc="${key}"]`);
    if (!$item.length) return;
    const $title = $item.find('.doc-dd-title');
    const logoHtml = $title.find('img').length ? $title.find('img')[0].outerHTML + ' ' : '';

    $title.html(logoHtml + `<input type="text" class="doc-dd-rename-input" value="${currentName.replace(/"/g, '&quot;')}" data-key="${key}"
        onclick="event.stopPropagation()"
        onkeydown="if(event.key==='Enter'){window.app.renameDocItem('${key}',this.value);event.stopPropagation();}else if(event.key==='Escape'){window.app.buildDocumentSelector();event.stopPropagation();}"
        onblur="window.app.renameDocItem('${key}',this.value)">`);
    const input = $title.find('input')[0];
    if (input) { input.focus(); input.select(); }
}

function _docActions(key, label) {
    const el = document.getElementById('tpl-doc-actions').content.cloneNode(true).firstElementChild;
    const rename = el.querySelector('.doc-dd-action');
    rename.addEventListener('click', e => { e.stopPropagation(); window.app.startRenameDocItem(key, label); });
    const del = el.querySelector('.doc-dd-action-danger');
    del.addEventListener('click', e => { e.stopPropagation(); window.app.deleteDocItem(key); });
    return el;
}

function buildDocumentSelector() {
    const $container = $('#doc-selector');
    if (!$container.length) return;

    const brandKeys = ['acme','greenleaf','nova','blueprint','solis','sentinel','aegis','harbor','apex','prism','mosaic','nexus'];
    const selectedKey = state.selectedDoc;
    const uploads = _getUploadedFiles();

    // --- Update section header with selected doc info ---
    _updateDocSelectorHeader(selectedKey, uploads);

    const frag = document.createDocumentFragment();

    // Helper: create a group label
    function addGroupLabel(icon, text, count) {
        const lbl = document.createElement('div');
        lbl.className = 'doc-dd-group-label';
        if (icon) { const i = document.createElement('i'); i.className = icon + ' me-1'; lbl.appendChild(i); }
        lbl.appendChild(document.createTextNode(text + ' '));
        const cnt = document.createElement('span');
        cnt.className = 'doc-dd-count';
        cnt.textContent = count;
        lbl.appendChild(cnt);
        frag.appendChild(lbl);
    }
    function addDivider() {
        const d = document.createElement('div');
        d.className = 'doc-dd-divider';
        frag.appendChild(d);
    }

    // --- Uploaded files first (own docs) ---
    if (uploads.length > 0) {
        addGroupLabel('bi bi-cloud-arrow-up', 'Your Uploads', uploads.length);
        const grid = document.createElement('div');
        grid.className = 'doc-dd-grid';
        for (const up of uploads) {
            const upKey = 'upload:' + up.id;
            const label = _docLabel(upKey, null) || up.name.replace(/\.pdf$/i, '');
            const sizeStr = up.size ? _formatFileSize(up.size) : '';

            const el = document.getElementById('tpl-doc-upload-item').content.cloneNode(true).firstElementChild;
            if (upKey === selectedKey) el.classList.add('doc-dd-item-selected');
            el.dataset.doc = upKey;
            el.addEventListener('click', () => window.app.selectDocument(upKey));
            el.querySelector('canvas').dataset.uploadId = up.id;
            el.querySelector('.doc-dd-label').textContent = label;
            const sizeSlot = el.querySelector('[data-slot="size"]');
            if (sizeStr) { sizeSlot.textContent = sizeStr; } else { sizeSlot.remove(); }
            el.querySelector('[data-slot="date"]').textContent = new Date(up.storedAt).toLocaleDateString();
            el.appendChild(_docActions(upKey, label));
            grid.appendChild(el);
        }
        frag.appendChild(grid);
        addDivider();
    }

    // --- Branded contracts ---
    const visibleBrand = brandKeys.filter(k => !_docHidden(k));
    addGroupLabel(null, 'Branded Contracts', visibleBrand.length);
    const brandGrid = document.createElement('div');
    brandGrid.className = 'doc-dd-grid';
    for (const key of brandKeys) {
        if (_docHidden(key)) continue;
        const doc = DOCUMENTS[key];
        if (!doc) continue;
        const label = _docLabel(key, doc);
        const sizeStr = _formatFileSize(doc.fileSize);

        const el = document.getElementById('tpl-doc-brand-item').content.cloneNode(true).firstElementChild;
        if (key === selectedKey) el.classList.add('doc-dd-item-selected');
        el.dataset.doc = key;
        el.addEventListener('click', () => window.app.selectDocument(key));
        el.querySelector('canvas').dataset.pdf = doc.local;

        if (doc.logo) {
            const logo = el.querySelector('.doc-dd-logo');
            logo.classList.remove('d-none');
            logo.src = doc.logo;
        }
        el.querySelector('.doc-dd-label').textContent = label;
        el.querySelector('[data-slot="pages"]').textContent = doc.pages + ' pages';

        if (sizeStr) {
            el.querySelector('[data-slot="size-sep"]').classList.remove('d-none');
            const sizeEl = el.querySelector('[data-slot="size"]');
            sizeEl.classList.remove('d-none');
            sizeEl.textContent = sizeStr;
        }

        const rolesContainer = el.querySelector('.doc-dd-roles');
        if (doc.useExternRole && doc.externRoles) {
            // Show externRole label + emails instead of role names
            const extLabel = document.createElement('span');
            extLabel.className = 'doc-dd-role doc-dd-role-extern';
            extLabel.textContent = 'externRole';
            rolesContainer.appendChild(extLabel);
            for (const email of doc.externRoles) {
                const span = document.createElement('span');
                span.className = 'doc-dd-role doc-dd-role-email';
                span.textContent = email;
                rolesContainer.appendChild(span);
            }
        } else {
            for (const r of doc.roles) {
                const span = document.createElement('span');
                span.className = 'doc-dd-role';
                span.textContent = r;
                rolesContainer.appendChild(span);
            }
        }

        el.appendChild(_docActions(key, label));
        brandGrid.appendChild(el);
    }
    frag.appendChild(brandGrid);

    // --- Drag-drop hint ---
    addDivider();
    const hint = document.createElement('div');
    hint.className = 'doc-dd-hint';
    const hintIcon = document.createElement('i');
    hintIcon.className = 'bi bi-cloud-arrow-up';
    hint.appendChild(hintIcon);
    hint.appendChild(document.createTextNode(' Drag & drop a PDF anywhere to add your own'));
    frag.appendChild(hint);

    // --- Restore hidden items (if any) ---
    const c = _loadDocCustom();
    const hiddenKeys = c.hidden ? Object.keys(c.hidden).filter(k => c.hidden[k]) : [];
    if (hiddenKeys.length > 0) {
        addDivider();
        addGroupLabel(null, 'Hidden', hiddenKeys.length);
        const hiddenGrid = document.createElement('div');
        hiddenGrid.className = 'doc-dd-grid';
        for (const key of hiddenKeys) {
            const doc = DOCUMENTS[key];
            if (!doc) continue;
            const el = document.getElementById('tpl-doc-hidden-item').content.cloneNode(true).firstElementChild;
            el.addEventListener('click', e => { e.stopPropagation(); window.app.restoreDocItem(key); });
            el.querySelector('.doc-dd-title').textContent = doc.label;
            hiddenGrid.appendChild(el);
        }
        frag.appendChild(hiddenGrid);
    }

    $container.empty().append(frag);

    // Lazy-load thumbnails
    _lazyLoadVisibleThumbs();
}

/** Update the collapsible section header with the currently selected document */
function _updateDocSelectorHeader(selectedKey, uploads) {
    const $title = $('#doc-selector-title');
    const $subtitle = $('#doc-selector-subtitle');
    const $logo = $('#doc-header-logo');
    const headerCanvas = document.getElementById('doc-header-thumb');
    if (!$title.length) return;

    let docName = 'Test Document';
    let subtitle = 'Select a branded test contract or drag-and-drop your own PDF.';
    let logoHtml = '';
    let thumbSource = null; // URL or 'upload:id'

    if (selectedKey && selectedKey.startsWith('upload:')) {
        const upId = selectedKey.substring(7);
        const up = uploads.find(u => u.id === upId);
        docName = _docLabel(selectedKey, null) || (up ? up.name : 'Uploaded File');
        subtitle = 'Your uploaded PDF. Drag-and-drop another to replace.';
        logoHtml = '<img src="favicon.png" style="width:26px;height:26px;border-radius:3px;vertical-align:middle;margin-right:6px" alt="">';
        thumbSource = 'upload:' + upId;
    } else if (selectedKey && DOCUMENTS[selectedKey]) {
        const doc = DOCUMENTS[selectedKey];
        docName = _docLabel(selectedKey, doc);
        subtitle = doc.desc || `${doc.pages} pages - ${doc.roles.length} roles`;
        if (doc.logo) {
            logoHtml = `<img src="${doc.logo}" style="width:26px;height:26px;border-radius:3px;vertical-align:middle;margin-right:6px" alt="">`;
        }
        if (doc.local) thumbSource = doc.local;
    }

    $title.text(docName);
    if ($logo.length) $logo.html(logoHtml);
    $subtitle.text(subtitle);

    // Render header thumbnail (show skeleton until loaded)
    if (headerCanvas && thumbSource) {
        headerCanvas.dataset.loaded = '';
        headerCanvas.classList.add('skeleton-pulse');
        const clearSkeleton = () => headerCanvas.classList.remove('skeleton-pulse');
        if (thumbSource.startsWith('upload:')) {
            _renderUploadThumb(thumbSource.substring(7), headerCanvas).then(clearSkeleton, clearSkeleton);
        } else {
            renderPdfThumbnail(thumbSource, headerCanvas, 64).then(clearSkeleton, clearSkeleton);
        }
    }
}

/** Lazy-load PDF thumbnails for items currently visible in the list */
function _lazyLoadVisibleThumbs() {
    const container = document.getElementById('doc-selector');
    if (!container) return;

    const root = null; // use viewport for intersection

    // Predefined docs (loaded by URL)
    $('#doc-selector canvas.doc-dd-thumb[data-pdf]').each(function() {
        const canvas = this;
        if (canvas.dataset.loaded) return;
        canvas.dataset.loaded = '1';
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    observer.unobserve(canvas);
                    renderPdfThumbnail(canvas.dataset.pdf, canvas, 106)
                        .then(() => canvas.classList.remove('skeleton-pulse'))
                        .catch(() => canvas.classList.remove('skeleton-pulse'));
                }
            });
        }, { root, threshold: 0.1 });
        observer.observe(canvas);
    });

    // Uploaded files (loaded from IndexedDB)
    $('#doc-selector canvas.doc-dd-thumb[data-upload-id]').each(function() {
        const canvas = this;
        if (canvas.dataset.loaded) return;
        canvas.dataset.loaded = '1';
        const uploadId = canvas.dataset.uploadId;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    observer.unobserve(canvas);
                    _renderUploadThumb(uploadId, canvas)
                        .then(() => canvas.classList.remove('skeleton-pulse'))
                        .catch(() => canvas.classList.remove('skeleton-pulse'));
                }
            });
        }, { root, threshold: 0.1 });
        observer.observe(canvas);
    });
}

/** Render a thumbnail for an uploaded file from IndexedDB */
async function _renderUploadThumb(uploadId, canvas) {
    try {
        const record = await loadStoredFile(uploadId);
        if (!record || !record.base64) return;
        const byteStr = atob(record.base64);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        await renderPdfThumbnail(url, canvas, 106);
        URL.revokeObjectURL(url);
    } catch {
        // Fallback icon
        const ctx = canvas.getContext('2d');
        canvas.width = 56; canvas.height = 106;
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, 56, 106);
        ctx.fillStyle = '#bbb'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('PDF', 28, 60);
    }
}

async function selectDocument(type) {
    state.selectedDoc = type;

    // If selecting an uploaded file, load it from IndexedDB
    if (type.startsWith('upload:')) {
        const id = type.substring(7);
        try {
            const record = await loadStoredFile(id);
            if (record) {
                const byteStr = atob(record.base64);
                const bytes = new Uint8Array(byteStr.length);
                for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'application/pdf' });
                state.customFileData = { name: record.name, base64: record.base64, blob: blob };
            }
        } catch { /* fallback: customFileData may already be set */ }
    }

    // Collapse the panel and rebuild list to reflect new selection
    const panel = document.getElementById('doc-selector-panel');
    if (panel) bootstrap.Collapse.getOrCreateInstance(panel).hide();
    buildDocumentSelector();

    // Update displayname input to match selected document
    const $dnInput = $('#cfg-displayname');
    if ($dnInput.length) {
        if (type.startsWith('upload:')) {
            $dnInput.val(state.customFileData ? state.customFileData.name : '');
        } else {
            const selDoc = getSelectedDocument();
            $dnInput.val(_docLabel(type, selDoc));
        }
    }

    // Update editor first, then apply branding on top
    if (state.editors['create-session']) {
        setEditorValue('create-session', getDefaultCreateSessionBody());
        applyFeatureSettingsToEditor();
    }

    // Switch branding to match document (must come after editor reset)
    const selDoc = getSelectedDocument();
    if (selDoc.brand && $('#brand-sync-doc').is(':checked')) {
        const brandIndex = LOGO_SETS.findIndex(s => s.prefix === selDoc.brand);
        if (brandIndex >= 0) {
            selectColorScheme(brandIndex);
            selectLogoSet(brandIndex);
        }
    } else {
        // Re-apply existing branding even when not syncing to document
        applyBrandingCSS();
        applyBrandingLogos();
    }
    saveAppState();
}

function initFileDeliveryDropdown() {
    var $menu = $('#fd-dd-menu');
    var $toggle = $('#fd-dd-toggle');
    if (!$toggle.length) return;
    $toggle.on('click', function (e) {
        e.stopPropagation();
        $menu.toggleClass('open');
        $toggle.toggleClass('open');
    });
    $(document).on('click.fddd', function (e) {
        if (!$(e.target).closest('#fd-dropdown').length) {
            $menu.removeClass('open');
            $toggle.removeClass('open');
        }
    });
}

var FD_OPTIONS = {
    base64: { label: 'Base64 embed', icon: 'bi-file-earmark-binary' },
    upload: { label: 'Upload after create', icon: 'bi-cloud-arrow-up' },
    url:    { label: 'URL reference', icon: 'bi-link-45deg' }
};

function setFileDelivery(mode) {
    state.fileDelivery = mode;

    // Update dropdown UI
    var opt = FD_OPTIONS[mode] || FD_OPTIONS.base64;
    $('#fd-dd-label').text(opt.label);
    $('#fd-dd-toggle .fd-dd-icon').attr('class', 'bi ' + opt.icon + ' fd-dd-icon');
    $('#fd-dd-menu .fd-dd-item').each(function () {
        $(this).toggleClass('fd-dd-item-selected', $(this).data('fd') === mode);
    });
    $('#fd-dd-menu').removeClass('open');
    $('#fd-dd-toggle').removeClass('open');

    // Update editor
    if (state.editors['create-session']) {
        setEditorValue('create-session', getDefaultCreateSessionBody());
        applyBrandingCSS();
        applyBrandingLogos();
    }
    saveAppState();
}

// =====================================================================
// IndexedDB File Storage
// =====================================================================

const FILE_DB_NAME = 'insign-explorer-files';
const FILE_DB_VERSION = 1;
const FILE_STORE = 'files';

function _openFileDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(FILE_STORE)) {
                db.createObjectStore(FILE_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function storeFile(file, base64) {
    const db = await _openFileDB();
    const id = crypto.randomUUID();
    const record = {
        id: id,
        name: file.name,
        size: file.size,
        base64: base64,
        storedAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, 'readwrite');
        tx.objectStore(FILE_STORE).put(record);
        tx.oncomplete = () => { db.close(); resolve(record); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

async function getStoredFiles() {
    const db = await _openFileDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, 'readonly');
        const req = tx.objectStore(FILE_STORE).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

async function deleteStoredFile(id) {
    const db = await _openFileDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, 'readwrite');
        tx.objectStore(FILE_STORE).delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

async function loadStoredFile(id) {
    const db = await _openFileDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_STORE, 'readonly');
        const req = tx.objectStore(FILE_STORE).get(id);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

/** Ingest a File object: read, store in IndexedDB + localStorage list, select it */
async function ingestFile(file, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];

            // Store binary in IndexedDB
            let record;
            try { record = await storeFile(file, base64); } catch { /* fallback */ }

            const id = record ? record.id : crypto.randomUUID();

            // Store metadata in localStorage uploads list
            _saveUploadedFile({
                id: id,
                name: file.name,
                size: file.size,
                storedAt: new Date().toISOString()
            });

            // Set default label (filename without .pdf)
            const defaultLabel = file.name.replace(/\.pdf$/i, '');
            const c = _loadDocCustom();
            if (!c.renames) c.renames = {};
            c.renames['upload:' + id] = defaultLabel;
            _saveDocCustom(c);

            state.customFileData = { name: file.name, base64: base64, blob: file };

            // Select it
            selectDocument('upload:' + id);

            if (opts.toast !== false) {
                showToast('Added <strong>' + file.name + '</strong> to your documents', 'success');
            }
            resolve();
        };
        reader.readAsDataURL(file);
    });
}

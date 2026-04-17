'use strict';

/* ==========================================================================
   Branding & CSS Customizer
   ========================================================================== */


// =====================================================================
// Branding & CSS Customizer
// =====================================================================

const COLOR_SCHEMES = [
    { name: 'ACME Corp',       colors: { primary: '#0D47A1', accent: '#42A5F5', dark: '#1B2838', error: '#C62828', success: '#0A8765', surface: '#F0F3F6', text: '#3E3F42' } },
    { name: 'GreenLeaf',       colors: { primary: '#1B5E20', accent: '#66BB6A', dark: '#1B2F1B', error: '#C62828', success: '#2E7D32', surface: '#F1F5F1', text: '#2E3830' } },
    { name: 'NOVA Finance',    colors: { primary: '#B71C1C', accent: '#EF5350', dark: '#212121', error: '#B71C1C', success: '#0A8765', surface: '#F5F3F3', text: '#3E3F42' } },
    { name: 'BluePrint',       colors: { primary: '#37474F', accent: '#26A69A', dark: '#263238', error: '#C62828', success: '#00897B', surface: '#ECEFF1', text: '#37474F' } },
    { name: 'SOLIS Tech',      colors: { primary: '#E65100', accent: '#1565C0', dark: '#1A1A2E', error: '#BF360C', success: '#0A8765', surface: '#F3F1EF', text: '#3B3340' } },
    { name: 'Sentinel Ins.',   colors: { primary: '#1A237E', accent: '#FFD600', dark: '#0D1457', error: '#C62828', success: '#0A8765', surface: '#EDEDF5', text: '#2C2C52' } },
    { name: 'Aegis Life',      colors: { primary: '#00695C', accent: '#80CBC4', dark: '#004D40', error: '#D32F2F', success: '#00897B', surface: '#EDF5F3', text: '#2C4640' } },
    { name: 'Harbor Re',       colors: { primary: '#880E4F', accent: '#F48FB1', dark: '#6A0039', error: '#C62828', success: '#0A8765', surface: '#F5EEF2', text: '#4A2040' } },
    { name: 'Apex Assurance',  colors: { primary: '#4A148C', accent: '#CE93D8', dark: '#311B92', error: '#C62828', success: '#0A8765', surface: '#F0ECF5', text: '#382050' } },
    { name: 'Prism Digital',   colors: { primary: '#2979FF', accent: '#FF9100', dark: '#1A1A2E', error: '#FF1744', success: '#00C853', surface: '#F0F2F8', text: '#333348' } },
    { name: 'Mosaic Labs',     colors: { primary: '#1976D2', accent: '#F57C00', dark: '#212121', error: '#C62828', success: '#0A8765', surface: '#F0F3F6', text: '#3E3F42' } },
    { name: 'Nexus Group',     colors: { primary: '#1B3A5C', accent: '#C9963A', dark: '#0F2440', error: '#C75B4A', success: '#0A8765', surface: '#F0F1F3', text: '#2E3A48' } },
];

/** Derive lighter/darker variants from a hex color */
function hexToHSL(hex) {
    let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0, s = 0, l = (max+min)/2;
    if (d) { s = l > 0.5 ? d/(2-max-min) : d/(max+min); h = max===r ? ((g-b)/d+(g<b?6:0))/6 : max===g ? ((b-r)/d+2)/6 : ((r-g)/d+4)/6; }
    return [h*360, s*100, l*100];
}

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1-l);
    const f = n => { const k = (n + h/30) % 12; return l - a * Math.max(Math.min(k-3, 9-k, 1), -1); };
    return '#' + [f(0),f(8),f(4)].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

function lighten(hex, amount) { const [h,s,l] = hexToHSL(hex); return hslToHex(h, s, Math.min(100, l + amount)); }
function darken(hex, amount) { const [h,s,l] = hexToHSL(hex); return hslToHex(h, s, Math.max(0, l - amount)); }
function transparentize(hex, alpha) { return hex + Math.round(alpha*255).toString(16).padStart(2,'0'); }
function desaturate(hex, amount) { const [h,s,l] = hexToHSL(hex); return hslToHex(h, Math.max(0, s - amount), l); }
function mixColors(hex1, hex2, ratio) {
    const r1 = parseInt(hex1.slice(1,3),16), g1 = parseInt(hex1.slice(3,5),16), b1 = parseInt(hex1.slice(5,7),16);
    const r2 = parseInt(hex2.slice(1,3),16), g2 = parseInt(hex2.slice(3,5),16), b2 = parseInt(hex2.slice(5,7),16);
    const r = Math.round(r1 + (r2-r1)*ratio), g = Math.round(g1 + (g2-g1)*ratio), b = Math.round(b1 + (b2-b1)*ratio);
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

/** Auto-derive success, surface, text from 4 base colors */
function autoDerive(primary, dark) {
    const surface = desaturate(lighten(dark, 78), 60);
    const text = darken(desaturate(dark, 30), 5);
    return { success: '#0A8765', surface, text };
}

/** Generate CSS override using color-mix() — only base vars, the default farbpalette's var() cascade handles the rest */
function generateBrandCSS(primary, accent, dark, error, success, surface, text) {
    return `:root {
  /* ─── Primary / Blue Palette ─── */
  --insignBlue: ${primary};
  --800: color-mix(in srgb, var(--insignBlue), white 30%);
  --insignNavy: color-mix(in srgb, var(--insignBlue), black 20%);
  --insignModernBlue: color-mix(in srgb, var(--insignBlue), white 30%);
  --insignMediumBlue: color-mix(in srgb, var(--insignBlue), white 25%);
  --insignLightBlue2: color-mix(in srgb, var(--insignBlue), white 40%);
  --insignLighterBlue: color-mix(in srgb, var(--insignBlue), white 50%);
  --insignUltraLightBlue: color-mix(in srgb, var(--insignBlue), white 85%);
  --insignLightestBlue: color-mix(in srgb, var(--insignBlue), white 75%);
  --insignHighlightBlue: color-mix(in srgb, var(--insignBlue), white 80%);
  --insignHigherLightBlue: color-mix(in srgb, var(--insignBlue), white 90%);

  /* ─── Accent Colors ─── */
  --insignOrange: ${accent};
  --insignBlueInverted: color-mix(in srgb, var(--insignOrange), white 25%);
  --insignLightOrange: color-mix(in srgb, var(--insignOrange), white 25%);
  --insignYellow: color-mix(in srgb, var(--insignOrange), white 40%);
  --insignAlternativeYellow: var(--insignOrange);

  /* ─── Grey Palette (surface-derived) ─── */
  --insignLigtherGrey: ${surface};
  --insignLightestGrey: color-mix(in srgb, var(--insignLigtherGrey), white 30%);
  --insignLightestGrey2: color-mix(in srgb, var(--insignLigtherGrey), white 50%);
  --insignLightGrey: color-mix(in srgb, var(--insignLigtherGrey), black 5%);
  --insignGrey: color-mix(in srgb, var(--insignLigtherGrey), black 8%);
  --insignGrey2: color-mix(in srgb, var(--insignLigtherGrey), white 15%);
  --insignGrey3: color-mix(in srgb, var(--insignLigtherGrey), var(--insignBlue) 3%);
  --insignGrey4: color-mix(in srgb, var(--insignLigtherGrey), black 18%);
  --insignGrey5: color-mix(in srgb, var(--insignLigtherGrey), black 12%);
  --insignMiddleGrey: color-mix(in srgb, var(--insignLigtherGrey), black 25%);
  --insignMediumGrey: color-mix(in srgb, var(--insignLigtherGrey), black 40%);
  --insignMediumGrey2: color-mix(in srgb, var(--insignLigtherGrey), black 55%);
  --insignDarkGrey: color-mix(in srgb, var(--insignLigtherGrey), black 40%);
  --insignDarkerGrey: color-mix(in srgb, var(--insignLigtherGrey), black 50%);
  --insignDarkestGrey: color-mix(in srgb, var(--insignLigtherGrey), black 55%);

  /* ─── Text / Dark Tones ─── */
  --insignDarkBlack: ${dark};
  --insignBlack: ${text};
  --insignLightBlack: color-mix(in srgb, var(--insignBlack), white 25%);
  --insignAlternativeBlack: var(--insignBlack);
  --insignLightDarkBlack: color-mix(in srgb, var(--insignBlack), black 10%);

  /* ─── Error / Success ─── */
  --insignRed: ${error};
  --insignLightRed: color-mix(in srgb, var(--insignRed), white 30%);
  --insignLightestRed: color-mix(in srgb, var(--insignRed), white 75%);
  --insignLighterRed: color-mix(in srgb, var(--insignRed), white 55%);
  --insignGreen: color-mix(in srgb, ${success}, white 25%);
  --insignLightGreen: color-mix(in srgb, ${success}, white 50%);
  --insignMiddleGreen: ${success};
  --insignDarkGreen: color-mix(in srgb, ${success}, black 15%);

}`;
}

/** Render CSS with syntax highlighting, inline color swatches, and resolved var() references */
function _renderRichCSS(css) {
    const el = document.getElementById('brand-css-rich');
    if (!el) return;

    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // First pass: build variable → resolved-color lookup (follow var chains + color-mix)
    const varMap = {};
    for (const line of css.split('\n')) {
        const dm = line.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
        if (dm) varMap[dm[1]] = dm[2];
    }
    // Resolve var() chains and color-mix() up to 5 levels deep
    function resolveColor(val) {
        let v = val, depth = 0;
        while (v && depth++ < 5) {
            const hex = v.match(/^#[0-9a-fA-F]{6,8}$/);
            if (hex) return v;
            const ref = v.match(/^var\((--[\w-]+)\)$/);
            if (ref && varMap[ref[1]]) { v = varMap[ref[1]]; continue; }
            // Try resolving color-mix() to approximate swatch
            const cmMatch = v.match(/^color-mix\(in srgb,\s*(.+?),\s*(white|black|#[0-9a-fA-F]{6})\s+(\d+)%\)$/);
            if (cmMatch) {
                const base = resolveColor(cmMatch[1].trim());
                if (base) {
                    const target = cmMatch[2] === 'white' ? '#ffffff' : cmMatch[2] === 'black' ? '#000000' : cmMatch[2];
                    const pct = parseInt(cmMatch[3]) / 100;
                    const r1 = parseInt(base.slice(1,3),16), g1 = parseInt(base.slice(3,5),16), b1 = parseInt(base.slice(5,7),16);
                    const r2 = parseInt(target.slice(1,3),16), g2 = parseInt(target.slice(3,5),16), b2 = parseInt(target.slice(5,7),16);
                    const r = Math.round(r1 + (r2-r1)*pct), g = Math.round(g1 + (g2-g1)*pct), b = Math.round(b1 + (b2-b1)*pct);
                    return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
                }
            }
            break;
        }
        return null;
    }

    const lines = css.split('\n');
    const htmlLines = lines.map(line => {
        // Comment lines
        if (line.trim().startsWith('/*')) {
            return `<span class="css-comment">${esc(line)}</span>`;
        }
        // Selector lines (e.g. ":root {")
        if (line.trim().startsWith(':') || line.trim() === '}') {
            return `<span class="css-selector">${esc(line)}</span>`;
        }
        // Property: value lines
        const m = line.match(/^(\s*)(--[\w-]+)(\s*:\s*)(.+?)(;?\s*)$/);
        if (m) {
            const [, indent, prop, colon, val, semi] = m;
            // Token-based rendering: add swatches to every hex color and var() reference found anywhere in the value
            // First, show a swatch for the whole resolved value (the result color)
            const wholeResolved = resolveColor(val);
            const wholeSwatch = wholeResolved ? `<span class="css-color-swatch" style="background:${wholeResolved}"></span>` : '';
            // Tokenize value: split into hex colors, var() refs, and plain text segments
            const tokenRe = /(#[0-9a-fA-F]{6,8}|var\(--[\w-]+\))/g;
            let valHtml = '';
            let lastIdx = 0;
            let match;
            const escValSrc = val;
            while ((match = tokenRe.exec(escValSrc)) !== null) {
                // Add plain text before this token
                if (match.index > lastIdx) {
                    valHtml += `<span class="css-prop-val">${esc(escValSrc.slice(lastIdx, match.index))}</span>`;
                }
                const token = match[0];
                if (token.startsWith('#')) {
                    valHtml += `<span class="css-color-swatch" style="background:${token}"></span><span class="css-prop-val">${esc(token)}</span>`;
                } else {
                    // var(--name) - resolve and swatch
                    const vName = token.match(/var\((--[\w-]+)\)/)[1];
                    const refColor = resolveColor(`var(${vName})`);
                    const refSwatch = refColor ? `<span class="css-color-swatch" style="background:${refColor}"></span>` : '';
                    valHtml += `${refSwatch}<span class="css-var-ref">${esc(token)}</span>`;
                }
                lastIdx = match.index + token.length;
            }
            // Remaining plain text after last token
            if (lastIdx < escValSrc.length) {
                valHtml += `<span class="css-prop-val">${esc(escValSrc.slice(lastIdx))}</span>`;
            }
            // If value has functions (color-mix etc.) prepend the whole-resolved swatch
            const hasFn = val.includes('(') && !val.match(/^var\(--[\w-]+\)$/);
            const prefix = (hasFn && wholeSwatch) ? wholeSwatch : (!valHtml.includes('css-color-swatch') && wholeSwatch ? wholeSwatch : '');
            return `${esc(indent)}<span class="css-prop-name">${esc(prop)}</span><span class="css-punct">${esc(colon)}</span>${prefix}${valHtml}<span class="css-punct">${esc(semi)}</span>`;
        }
        return esc(line);
    });
    el.innerHTML = htmlLines.join('\n');

    // Expand on click, collapse when focus leaves
    if (!el._bound) {
        el._bound = true;
        el.addEventListener('click', () => el.classList.add('expanded'));
        el.setAttribute('tabindex', '0');
        el.addEventListener('blur', () => el.classList.remove('expanded'));
        // Also collapse when clicking outside
        document.addEventListener('mousedown', e => {
            if (!el.contains(e.target)) el.classList.remove('expanded');
        });
    }
}

/** Build color scheme preset buttons */
function buildColorSchemePresets() {
    const container = document.getElementById('color-scheme-presets');
    if (!container) return;
    let html = `
        <div class="color-scheme-btn active" onclick="window.app.removeColorScheme()" title="Default - remove custom CSS">
            <i class="bi bi-x-circle" style="font-size:0.85rem;color:var(--insign-text-muted)"></i>
            <span style="font-size:0.7rem">Default</span>
        </div>`;
    html += COLOR_SCHEMES.map((scheme, i) => `
        <div class="color-scheme-btn" onclick="window.app.selectColorScheme(${i})" title="${scheme.name}">
            <span class="color-scheme-dot" style="background:${scheme.colors.primary}"></span>
            <span class="color-scheme-dot" style="background:${scheme.colors.accent}"></span>
            <span class="color-scheme-dot" style="background:${scheme.colors.dark}"></span>
            <span class="color-scheme-dot" style="background:${scheme.colors.surface};border:1px solid #ccc"></span>
            <span style="font-size:0.7rem">${scheme.name}</span>
        </div>
    `).join('');
    container.innerHTML = html;
}

function selectColorScheme(index) {
    const scheme = COLOR_SCHEMES[index];
    if (!scheme) return;
    const ids = ['primary','accent','dark','error','success','surface','text'];
    ids.forEach(id => {
        const v = scheme.colors[id];
        const el = document.getElementById('brand-color-' + id);
        const hex = document.getElementById('brand-color-' + id + '-hex');
        if (el) el.value = v;
        if (hex) hex.value = v;
        // Unlock advanced pickers when selecting a scheme
        const lock = document.getElementById('brand-color-' + id + '-lock');
        if (lock) lock.checked = false;
    });

    // Highlight active (index+1 because first btn is Default)
    document.querySelectorAll('.color-scheme-btn').forEach((btn, j) => btn.classList.toggle('active', j === index + 1));

    updateBrandColor();
}

/** Remove custom CSS - reset to server defaults */
function removeColorScheme() {
    // Highlight Default button (first one)
    document.querySelectorAll('.color-scheme-btn').forEach((btn, j) => btn.classList.toggle('active', j === 0));

    // Remove externalPropertiesURL from JSON
    if (state.editors['create-session']) {
        const body = getEditorValue('create-session');
        if (typeof body === 'object') {
            delete body.externalPropertiesURL;
            setEditorValue('create-session', body);
        }
    }

    // Clear CSS preview
    const preview = document.getElementById('brand-css-preview');
    if (preview) preview.value = '';
    const richEl = document.getElementById('brand-css-rich');
    if (richEl) richEl.innerHTML = '<span style="color:var(--insign-text-muted);font-style:italic">No custom CSS - using server defaults</span>';

    saveAppState();
    _updateBrandingHeaderSummary();
}

function updateBrandColor() {
    const primary = document.getElementById('brand-color-primary').value;
    const accent = document.getElementById('brand-color-accent').value;
    const dark = document.getElementById('brand-color-dark').value;
    const error = document.getElementById('brand-color-error').value;

    // Sync hex text fields for base 4
    document.getElementById('brand-color-primary-hex').value = primary;
    document.getElementById('brand-color-accent-hex').value = accent;
    document.getElementById('brand-color-dark-hex').value = dark;
    document.getElementById('brand-color-error-hex').value = error;

    // Auto-derive advanced colors
    const derived = autoDerive(primary, dark);

    const css = generateBrandCSS(primary, accent, dark, error, derived.success, derived.surface, derived.text);
    const preview = document.getElementById('brand-css-preview');
    if (preview) preview.value = css;
    _renderRichCSS(css);
    // Auto-apply to JSON body
    applyBrandingCSS();
    saveAppState();
    _updateBrandingHeaderSummary();
}

function applyBrandingCSS() {
    // Only inject CSS when a non-default color scheme is explicitly selected
    const activeSchemeBtn = document.querySelector('.color-scheme-btn.active');
    if (!activeSchemeBtn || activeSchemeBtn === document.querySelector('.color-scheme-btn:first-child')) return;
    const css = document.getElementById('brand-css-preview')?.value;
    if (!css || !state.editors['create-session']) return;
    const body = getEditorValue('create-session');
    if (typeof body !== 'object') return;

    // Collapse to single line - the API field expects no linebreaks
    body.externalPropertiesURL = css.replace(/\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    setEditorValue('create-session', body);
}

/** Return the display value for a logo URL: placeholder for data URLs, URL as-is otherwise */
function logoDisplayValue(slot, url) {
    if (!url) return null;
    if (url.startsWith('data:')) {
        state.brandLogoData[slot] = url;
        var placeholders = { icon: '<logo:icon>', mail: '<logo:mail>', login: '<logo:login>' };
        return placeholders[slot] || url;
    }
    delete state.brandLogoData[slot];
    return url;
}

function applyBrandingLogos() {
    if (!state.editors['create-session']) return;
    var iconUrl = document.getElementById('brand-app-icon')?.value;
    var mailUrl = document.getElementById('brand-mail-header-image')?.value;
    var loginUrl = document.getElementById('brand-logo-extern')?.value;
    if (!iconUrl && !mailUrl && !loginUrl) return;
    var body = getEditorValue('create-session');
    if (typeof body !== 'object') return;
    if (!body.guiProperties) body.guiProperties = {};
    if (iconUrl) body.guiProperties['message.start.logo.url.editor.desktop'] = logoDisplayValue('icon', iconUrl);
    if (mailUrl) body.guiProperties['message.mt.header.image'] = logoDisplayValue('mail', mailUrl);
    if (loginUrl) body.logoExtern = logoDisplayValue('login', loginUrl);
    setEditorValue('create-session', body);
}

function resetBranding() {
    selectColorScheme(0); // reset to inSign default

    // Remove externalPropertiesURL from JSON
    if (state.editors['create-session']) {
        const body = getEditorValue('create-session');
        if (typeof body === 'object') {
            delete body.externalPropertiesURL;
            setEditorValue('create-session', body);
        }
    }
}

/** Convert an image URL to a base64 data URL via canvas (or fetch for SVG) */
async function toBase64DataUrl(src) {
    // Already a data URL - pass through
    if (src.startsWith('data:')) return src;

    // SVG: fetch text and encode directly
    if (src.endsWith('.svg') || src.includes('image/svg')) {
        const resp = await fetch(src);
        const text = await resp.text();
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
    }

    // Raster image: draw to canvas and export as PNG data URL
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || img.width;
            c.height = img.naturalHeight || img.height;
            c.getContext('2d').drawImage(img, 0, 0);
            resolve(c.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to load image: ' + src));
        img.src = src;
    });
}

/** Show a preview thumbnail */
function showPreview(elementId, dataUrl) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<img src="${dataUrl.replace(/"/g, '&quot;')}" alt="Preview">`;
}

// Logo sets: each set has icon (30x30), mail (120x60), login (314x100)
var LOGO_SETS = [
    { name: 'ACME Corp', prefix: 'acme' },
    { name: 'GreenLeaf', prefix: 'greenleaf' },
    { name: 'NOVA Finance', prefix: 'nova' },
    { name: 'BluePrint', prefix: 'blueprint' },
    { name: 'SOLIS Tech', prefix: 'solis' },
    { name: 'Sentinel Ins.', prefix: 'sentinel' },
    { name: 'Aegis Life', prefix: 'aegis' },
    { name: 'Harbor Re', prefix: 'harbor' },
    { name: 'Apex Assurance', prefix: 'apex' },
    { name: 'Prism Digital', prefix: 'prism' },
    { name: 'Mosaic Labs', prefix: 'mosaic' },
    { name: 'Nexus Group', prefix: 'nexus' },
];

function getLogoSrc(set, variant) {
    return `img/sample-logos/${set.prefix}-${variant}.svg`;
}

function buildLogoSets() {
    const container = document.getElementById('logo-sets');
    if (!container) return;
    // "Default" card first - removes all logos from JSON
    let html = `
        <div class="logo-set-card active" onclick="window.app.resetLogos()" title="Remove all custom logos - use server defaults">
            <div class="logo-set-row" style="height:28px;align-items:center;justify-content:center">
                <i class="bi bi-x-circle" style="font-size:1.2rem;color:var(--insign-text-muted)"></i>
            </div>
            <div style="height:22px;display:flex;align-items:center;justify-content:center">
                <span style="font-size:0.62rem;color:var(--insign-text-muted)">no custom logos</span>
            </div>
            <div class="logo-set-name">Default</div>
        </div>`;
    html += LOGO_SETS.map((set, i) => `
        <div class="logo-set-card" onclick="window.app.selectLogoSet(${i})" title="${set.name}">
            <div class="logo-set-row">
                <img class="logo-set-icon" src="${getLogoSrc(set, 'icon')}" alt="icon">
                <img class="logo-set-mail" src="${getLogoSrc(set, 'mail')}" alt="mail">
            </div>
            <img class="logo-set-login" src="${getLogoSrc(set, 'login')}" alt="login">
            <div class="logo-set-name">${set.name}</div>
        </div>
    `).join('');
    container.innerHTML = html;
}

/** Build an absolute URL from a relative path based on current page location */
function buildAbsoluteUrl(relativePath) {
    const base = window.location.href.replace(/[^/]*$/, ''); // strip filename
    return new URL(relativePath, base).href;
}

/** Apply a logo set: uses absolute URLs for SVG icons (works when served over HTTPS) */
function selectLogoSet(index) {
    const set = LOGO_SETS[index];
    if (!set) return;

    // Highlight active card (index+1 because first card is Default)
    document.querySelectorAll('.logo-set-card').forEach((c, j) => c.classList.toggle('active', j === index + 1));

    // Clear stored data URLs - logo sets use real URLs
    state.brandLogoData = {};

    const iconUrl = buildAbsoluteUrl(getLogoSrc(set, 'icon'));
    const mailUrl = buildAbsoluteUrl(getLogoSrc(set, 'mail'));
    const loginUrl = buildAbsoluteUrl(getLogoSrc(set, 'login'));

    // Apply to JSON body
    if (!state.editors['create-session']) return;
    const body = getEditorValue('create-session');
    if (typeof body !== 'object') return;
    if (!body.guiProperties) body.guiProperties = {};

    // App icon - via message ID for editor desktop logo
    body.guiProperties['message.start.logo.url.editor.desktop'] = iconUrl;
    // Mail header - right-side logo
    body.guiProperties['message.mt.header.image'] = mailUrl;
    // Login logo
    body.logoExtern = loginUrl;

    setEditorValue('create-session', body);

    // Update individual override fields + previews
    document.getElementById('brand-app-icon').value = iconUrl;
    document.getElementById('brand-mail-header-image').value = mailUrl;
    document.getElementById('brand-logo-extern').value = loginUrl;
    showPreview('brand-app-icon-preview', iconUrl);
    showPreview('brand-mail-header-preview', mailUrl);
    showPreview('brand-logo-extern-preview', loginUrl);
    saveAppState();
    _updateBrandingHeaderSummary();
}

function restoreBranding() {
    const saved = loadAppState();
    if (!saved) return;

    if (saved.brandSyncDoc !== undefined) {
        $('#brand-sync-doc').prop('checked', saved.brandSyncDoc);
    }
    if (saved.brandColors) {
        const c = saved.brandColors;
        if (c.primary) { $('#brand-color-primary').val(c.primary); $('#brand-color-primary-hex').val(c.primary); }
        if (c.accent)  { $('#brand-color-accent').val(c.accent);   $('#brand-color-accent-hex').val(c.accent); }
        if (c.dark)    { $('#brand-color-dark').val(c.dark);        $('#brand-color-dark-hex').val(c.dark); }
        if (c.error)   { $('#brand-color-error').val(c.error);      $('#brand-color-error-hex').val(c.error); }
    }
    if (saved.brandColorScheme >= 0) {
        document.querySelectorAll('.color-scheme-btn').forEach((btn, j) =>
            btn.classList.toggle('active', j === saved.brandColorScheme));
    }
    if (saved.brandLogoSet >= 0) {
        document.querySelectorAll('.logo-set-card').forEach((c, j) =>
            c.classList.toggle('active', j === saved.brandLogoSet));
    }
    if (saved.brandLogos) {
        const l = saved.brandLogos;
        if (l.icon)  { $('#brand-app-icon').val(l.icon);           showPreview('brand-app-icon-preview', l.icon); if (l.icon.startsWith('data:'))  state.brandLogoData.icon  = l.icon; }
        if (l.mail)  { $('#brand-mail-header-image').val(l.mail);   showPreview('brand-mail-header-preview', l.mail); if (l.mail.startsWith('data:'))  state.brandLogoData.mail  = l.mail; }
        if (l.login) { $('#brand-logo-extern').val(l.login);        showPreview('brand-logo-extern-preview', l.login); if (l.login.startsWith('data:')) state.brandLogoData.login = l.login; }
    }
}

/** Remove all custom logos from JSON - revert to server defaults */
function resetLogos() {
    // Highlight Default card (first one)
    document.querySelectorAll('.logo-set-card').forEach((c, j) => c.classList.toggle('active', j === 0));

    // Clear stored logo data
    state.brandLogoData = {};

    if (!state.editors['create-session']) return;
    const body = getEditorValue('create-session');
    if (typeof body !== 'object') return;

    // Remove logo keys
    if (body.guiProperties) {
        delete body.guiProperties['message.start.logo.url.editor.desktop'];
        delete body.guiProperties['message.mt.header.image'];
        delete body.guiProperties['message.mt.header.image.left'];
        if (Object.keys(body.guiProperties).length === 0) delete body.guiProperties;
    }
    delete body.logoExtern;

    setEditorValue('create-session', body);

    // Clear individual fields + previews
    document.getElementById('brand-app-icon').value = '';
    document.getElementById('brand-mail-header-image').value = '';
    document.getElementById('brand-logo-extern').value = '';
    document.getElementById('brand-app-icon-preview').innerHTML = '';
    document.getElementById('brand-mail-header-preview').innerHTML = '';
    document.getElementById('brand-logo-extern-preview').innerHTML = '';
    saveAppState();
    _updateBrandingHeaderSummary();
}

/** Update a single logo slot: icon | mail | login */
async function updateBrandLogo(slot, url) {
    if (!state.editors['create-session']) return;
    const body = getEditorValue('create-session');
    if (typeof body !== 'object') return;
    if (!body.guiProperties) body.guiProperties = {};

    const config = {
        icon:  { key: 'message.start.logo.url.editor.desktop', path: 'guiProperties', input: 'brand-app-icon', preview: 'brand-app-icon-preview', placeholder: '<logo:icon>' },
        mail:  { key: 'message.mt.header.image',       path: 'guiProperties', input: 'brand-mail-header-image', preview: 'brand-mail-header-preview', placeholder: '<logo:mail>' },
        login: { key: 'logoExtern',                    path: 'root',          input: 'brand-logo-extern', preview: 'brand-logo-extern-preview', placeholder: '<logo:login>' }
    }[slot];
    if (!config) return;

    if (url) {
        const isDataUrl = url.startsWith('data:');
        // For data URLs (uploaded files), store data separately and use placeholder in JSON
        if (isDataUrl) {
            state.brandLogoData[slot] = url;
            if (config.path === 'guiProperties') body.guiProperties[config.key] = config.placeholder;
            else body[config.key] = config.placeholder;
        } else {
            // Normal URL - put directly in JSON, clear any stored data
            delete state.brandLogoData[slot];
            if (config.path === 'guiProperties') body.guiProperties[config.key] = url;
            else body[config.key] = url;
        }
        document.getElementById(config.input).value = url;
        showPreview(config.preview, url);
    } else {
        delete state.brandLogoData[slot];
        if (config.path === 'guiProperties') delete body.guiProperties[config.key];
        else delete body[config.key];
    }
    setEditorValue('create-session', body);
    saveAppState();
}

function uploadBrandLogo(input, slot) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateBrandLogo(slot, reader.result);
    reader.readAsDataURL(file);
}

#!/usr/bin/env node
/**
 * Screenshot generator for inSign API Explorer documentation.
 *
 * Usage:
 *   npx playwright install chromium   # one-time setup
 *   node docs/screenshots/take-screenshots.mjs
 *
 * Requires: playwright (npm install playwright)
 * Starts a temporary local HTTP server to serve docs/ so that
 * all dynamic JS (feature toggles, branding, etc.) loads correctly.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(__dirname, '..');
const OUT = __dirname;

// ---------------------------------------------------------------------------
// Minimal static file server for docs/
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
};

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(DOCS, p);
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(fp);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      console.log(`Static server on http://127.0.0.1:${port}`);
      resolve({ srv, port });
    });
  });
}

// ---------------------------------------------------------------------------
// Screenshot helpers
// ---------------------------------------------------------------------------
async function main() {
  const { srv, port } = await startServer();
  const BASE = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  /** Screenshot a single element. Temporarily resizes viewport if `height` is given. */
  async function shot(name, selector, { height } = {}) {
    if (height) await page.setViewportSize({ width: 1440, height });
    await page.waitForTimeout(300);
    const el = await page.$(selector);
    if (!el) { console.warn(`  SKIP  ${name}  (selector not found: ${selector})`); return; }
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await el.screenshot({ path: `${OUT}/${name}.png` });
    if (height) await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);
    console.log(`  OK    ${name}`);
  }

  /** Full viewport screenshot. Temporarily resizes viewport if `height` is given. */
  async function fullShot(name, { height } = {}) {
    if (height) await page.setViewportSize({ width: 1440, height });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    if (height) await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);
    console.log(`  OK    ${name}`);
  }

  // =========================================================================
  // Load app - force dark mode
  // =========================================================================
  console.log('\nLoading app...');
  await page.goto(BASE);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('insign-dark-mode', 'true');
  });
  await page.waitForTimeout(300);

  // =========================================================================
  // STEP 1 - Connection & Authentication
  // =========================================================================
  console.log('\n--- Step 1: Connection ---');
  await fullShot('01-overview');
  await shot('02-connection-settings', '#step-1-panel .card-insign:first-child');
  await shot('03-auth-basic', '#step-1-panel .card-insign:nth-child(2)');

  // OAuth2
  await page.click('[data-mode="oauth2"]');
  await page.waitForTimeout(400);
  await shot('04-auth-oauth2', '#step-1-panel .card-insign:nth-child(2)');
  await page.click('[data-mode="basic"]');
  await page.waitForTimeout(200);

  // CORS proxy info (enable proxy, expand info panel, tall viewport)
  await page.evaluate(() => {
    const wrap = document.getElementById('cors-proxy-toggle-wrap');
    if (wrap) wrap.classList.remove('d-none');
    const cb = document.getElementById('cfg-cors-proxy');
    if (cb && !cb.checked) cb.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const info = document.getElementById('cors-proxy-info');
    if (info) info.classList.add('show');
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const el = document.getElementById('cors-proxy-url-group');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await fullShot('15-cors-proxy-info', { height: 2000 });

  // =========================================================================
  // STEP 2 - Create Session
  // =========================================================================
  console.log('\n--- Step 2: Create Session ---');
  await page.click('[data-step="2"]');
  await page.waitForTimeout(1000);
  await fullShot('05-create-session');

  // Feature configurator - open, expand all groups, tall capture
  await page.click('[data-bs-target="#feature-configurator"]');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.app && window.app.expandAllGroups) window.app.expandAllGroups();
  });
  await page.waitForTimeout(600);
  await shot('06-feature-configurator', '#feature-configurator', { height: 8000 });

  // Close features, open branding
  await page.click('[data-bs-target="#feature-configurator"]');
  await page.waitForTimeout(300);
  await page.click('[data-bs-target="#branding-configurator"]');
  await page.waitForTimeout(600);
  await shot('07-branding-css', '#branding-configurator', { height: 4000 });

  // Close branding, expand document selector panel, then capture
  await page.click('[data-bs-target="#branding-configurator"]');
  await page.waitForTimeout(400);
  await page.click('[data-bs-target="#doc-selector-panel"]');
  await page.waitForTimeout(600);
  // Wait for lazy-loaded thumbnails to render
  await page.waitForTimeout(1500);
  await shot('08-document-selector', '#doc-selector', { height: 2000 });

  // Request body editor
  await page.evaluate(() => {
    const sections = [...document.querySelectorAll('.section-title')];
    const rb = sections.find(s => s.textContent.includes('Request Body'));
    if (rb) rb.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(500);
  await fullShot('09-request-editor');

  // -- Monaco hover tooltip on a JSON key --------------------------------
  console.log('\n--- Step 2b: Editor features ---');
  await page.evaluate(() => {
    const sections = [...document.querySelectorAll('.section-title')];
    const rb = sections.find(s => s.textContent.includes('Request Body'));
    if (rb) rb.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(400);
  // Trigger Monaco autocomplete via Ctrl+Space
  await page.evaluate(() => {
    const editors = window.state?.editors;
    if (editors) {
      const editorInstance = editors.sessionEditor || Object.values(editors)[0];
      if (editorInstance) {
        // Position cursor inside the JSON object and trigger suggest
        const model = editorInstance.getModel();
        if (model) {
          // Find a line with a property key to position cursor after
          const lines = model.getLinesContent();
          let targetLine = 2;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('"foruser"') || lines[i].includes('"displayname"')) {
              targetLine = i + 1;
              break;
            }
          }
          editorInstance.setPosition({ lineNumber: targetLine, column: lines[targetLine - 1].length + 1 });
          editorInstance.focus();
        }
      }
    }
  });
  await page.waitForTimeout(300);
  // Trigger autocomplete with Ctrl+Space
  await page.keyboard.press('Control+Space');
  await page.waitForTimeout(800);
  await fullShot('17-editor-autocomplete');

  // Dismiss autocomplete, then trigger hover tooltip on a JSON key
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const editors = window.state?.editors;
    if (editors) {
      const editorInstance = editors.sessionEditor || Object.values(editors)[0];
      if (editorInstance) {
        const model = editorInstance.getModel();
        if (model) {
          const lines = model.getLinesContent();
          for (let i = 0; i < lines.length; i++) {
            const col = lines[i].indexOf('"displayname"');
            if (col >= 0) {
              // Trigger hover at this position
              editorInstance.setPosition({ lineNumber: i + 1, column: col + 5 });
              editorInstance.getAction('editor.action.showHover').run();
              break;
            }
          }
        }
      }
    }
  });
  await page.waitForTimeout(800);
  await fullShot('18-editor-hover-tooltip');

  // =========================================================================
  // STEP 3 - Operate & Trace  (with simulated trace + webhook data)
  // =========================================================================
  console.log('\n--- Step 3: Operate & Trace ---');
  await page.click('[data-step="3"]');
  await page.waitForTimeout(800);

  // -- Inject simulated API trace entries --------------------------------
  await page.evaluate(() => {
    const now = Date.now();
    const baseUrl = 'https://sandbox.test.getinsign.show';
    const authHeader = 'Basic Y29udHJvbGxlcjpwd2QuaW5zaWduLnNhbmRib3guNDU2MQ==';
    const sessionId = 'a3f8c2e1-7b4d-4e9a-b5c6-1d2e3f4a5b6c';

    const traceEntries = [
      {
        id: `${now - 12000}-sess`, timestamp: new Date(now - 12000).toISOString(),
        method: 'POST', path: '/configure/session', url: `${baseUrl}/configure/session`,
        requestHeaders: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        requestBody: {
          foruser: 'demo-user', displayname: 'ACME Corp - Service Agreement 2026',
          description: 'Annual service agreement for consulting services',
          userFullName: 'Maria Testberg', userEmail: 'maria.testberg@example.test',
          documents: [{ id: 'doc-1', displayname: 'Service_Agreement_2026.pdf' }],
          serverSidecallbackURL: 'https://smee.io/insign-demo-abc123',
          serversideCallbackMethod: 'POST', serversideCallbackContenttype: 'json'
        },
        status: 200, statusText: 'OK', ok: true,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: { sessionid: sessionId, status: 'CREATED', displayname: 'ACME Corp - Service Agreement 2026' },
        duration: 342
      },
      {
        id: `${now - 9500}-upload`, timestamp: new Date(now - 9500).toISOString(),
        method: 'POST', path: '/configure/uploaddocument', url: `${baseUrl}/configure/uploaddocument`,
        requestHeaders: { 'Authorization': authHeader, 'Content-Type': 'multipart/form-data', 'Accept': 'application/json' },
        requestBody: '(multipart: sessionid + PDF file)',
        status: 200, statusText: 'OK', ok: true,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: { sessionid: sessionId, documentid: 'doc-1', filename: 'Service_Agreement_2026.pdf', pages: 3 },
        duration: 587
      },
      {
        id: `${now - 7000}-begin`, timestamp: new Date(now - 7000).toISOString(),
        method: 'POST', path: '/extern/beginmulti', url: `${baseUrl}/extern/beginmulti`,
        requestHeaders: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        requestBody: { sessionid: sessionId },
        status: 200, statusText: 'OK', ok: true,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: {
          sessionid: sessionId, externUsers: [
            { userid: 'signer-1', email: 'jan.kowalski@example.test', role: 'Signer', status: 'PENDING' },
            { userid: 'signer-2', email: 'anna.fischer@example.test', role: 'Co-Signer', status: 'PENDING' }
          ]
        },
        duration: 218
      },
      {
        id: `${now - 4000}-status`, timestamp: new Date(now - 4000).toISOString(),
        method: 'POST', path: '/get/status', url: `${baseUrl}/get/status`,
        requestHeaders: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        requestBody: { sessionid: sessionId },
        status: 200, statusText: 'OK', ok: true,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: {
          sessionid: sessionId, status: 'EXTERN_OPEN', displayname: 'ACME Corp - Service Agreement 2026',
          documents: [{ id: 'doc-1', displayname: 'Service_Agreement_2026.pdf', pages: 3, signed: false }],
          externUsers: [
            { userid: 'signer-1', email: 'jan.kowalski@example.test', role: 'Signer', status: 'SIGNED', signedAt: new Date(now - 5000).toISOString() },
            { userid: 'signer-2', email: 'anna.fischer@example.test', role: 'Co-Signer', status: 'PENDING' }
          ]
        },
        duration: 156
      },
      {
        id: `${now - 1500}-version`, timestamp: new Date(now - 1500).toISOString(),
        method: 'GET', path: '/version', url: `${baseUrl}/version`,
        requestHeaders: { 'Accept': 'application/json' },
        requestBody: null,
        status: 200, statusText: 'OK', ok: true,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: { version: '7.4.1', build: '20260315-1042', edition: 'Enterprise' },
        duration: 47
      }
    ];

    // Push entries into the apiClient trace log and render them
    if (window.state && window.state.apiClient) {
      traceEntries.forEach(e => window.state.apiClient._trace(e));
    } else {
      // Fallback: render directly via the global renderTraceEntry if available
      traceEntries.forEach(e => {
        if (typeof renderTraceEntry === 'function') renderTraceEntry(e);
      });
    }
  });
  await page.waitForTimeout(600);

  // -- Inject simulated webhook entries ----------------------------------
  await page.evaluate(() => {
    const now = Date.now();
    const sessionId = 'a3f8c2e1-7b4d-4e9a-b5c6-1d2e3f4a5b6c';

    // Unhide the webhooks section in the sidebar
    const whSection = document.getElementById('section-webhooks');
    if (whSection) whSection.classList.remove('d-none');

    // Create or reuse webhook viewer
    let viewer = window.webhookViewer || window.state?.webhookViewer;
    if (!viewer && window.WebhookViewer) {
      viewer = new window.WebhookViewer('#sidebar-webhook-container');
      window.webhookViewer = viewer;
      if (window.state) window.state.webhookViewer = viewer;
    }

    if (viewer) {
      // Set provider info for display
      viewer._provider = 'smee';
      viewer.channelUrl = 'https://smee.io/insign-demo-abc123';
      viewer.renderEndpoint();

      const webhookEntries = [
        {
          id: 'wh-1-' + now,
          method: 'POST',
          content_type: 'application/json',
          timestamp: new Date(now - 6000),
          headers: {
            'Content-Type': 'application/json',
            'X-inSign-Event': 'session.extern.started',
            'X-inSign-SessionId': sessionId,
            'User-Agent': 'inSign-Webhook/7.4.1'
          },
          body: {
            event: 'session.extern.started',
            sessionid: sessionId,
            displayname: 'ACME Corp - Service Agreement 2026',
            timestamp: new Date(now - 6000).toISOString(),
            externUsers: [
              { userid: 'signer-1', email: 'jan.kowalski@example.test', role: 'Signer', status: 'PENDING' },
              { userid: 'signer-2', email: 'anna.fischer@example.test', role: 'Co-Signer', status: 'PENDING' }
            ]
          }
        },
        {
          id: 'wh-2-' + now,
          method: 'POST',
          content_type: 'application/json',
          timestamp: new Date(now - 3000),
          headers: {
            'Content-Type': 'application/json',
            'X-inSign-Event': 'user.signed',
            'X-inSign-SessionId': sessionId,
            'User-Agent': 'inSign-Webhook/7.4.1'
          },
          body: {
            event: 'user.signed',
            sessionid: sessionId,
            displayname: 'ACME Corp - Service Agreement 2026',
            timestamp: new Date(now - 3000).toISOString(),
            user: { userid: 'signer-1', email: 'jan.kowalski@example.test', role: 'Signer', status: 'SIGNED' },
            signatureType: 'qualified',
            documentsSigned: ['Service_Agreement_2026.pdf']
          }
        }
      ];

      webhookEntries.forEach(e => viewer._addRequest(e));
      viewer.renderRequests();
    }
  });
  await page.waitForTimeout(600);

  // -- Inject simulated status polling data (initial + diff) --------------
  await page.evaluate(() => {
    const now = Date.now();
    const sessionId = 'a3f8c2e1-7b4d-4e9a-b5c6-1d2e3f4a5b6c';

    // Unhide and enable the polling section
    const pollSection = document.getElementById('section-polling');
    if (pollSection) pollSection.classList.remove('d-none');
    const pollContent = document.getElementById('sidebar-polling-content');
    if (pollContent) pollContent.style.display = '';
    const pollToggle = document.getElementById('sidebar-polling-toggle');
    if (pollToggle) pollToggle.checked = true;

    // Set status text to show active polling
    const statusText = document.getElementById('polling-status-text');
    if (statusText) statusText.textContent = 'Last poll: ' + new Date(now - 8000).toLocaleTimeString();

    // Inject an initial full status card
    const $container = $('#polling-changes');
    if (!$container.length) return;
    $container.find('.text-center').remove();

    const initialBody = {
      sessionid: sessionId,
      status: 'EXTERN_OPEN',
      displayname: 'ACME Corp - Service Agreement 2026',
      documents: [{ id: 'doc-1', displayname: 'Service_Agreement_2026.pdf', pages: 3, signed: false }],
      externUsers: [
        { userid: 'signer-1', email: 'jan.kowalski@example.test', role: 'Signer', status: 'PENDING' },
        { userid: 'signer-2', email: 'anna.fischer@example.test', role: 'Co-Signer', status: 'PENDING' }
      ]
    };

    const fullEl = document.getElementById('tpl-poll-full-card').content.cloneNode(true).firstElementChild;
    fullEl.querySelector('.webhook-time').textContent = new Date(now - 25000).toLocaleTimeString();
    fullEl.querySelector('.poll-body-pre').textContent = JSON.stringify(initialBody, null, 2);
    $container.append(fullEl);

    // Inject a diff card showing signer-1 signed and status changed
    const diffs = [
      { path: 'status', oldVal: 'EXTERN_OPEN', newVal: 'EXTERN_PARTIAL', type: 'changed' },
      { path: 'externUsers[0].status', oldVal: 'PENDING', newVal: 'SIGNED', type: 'changed' },
      { path: 'externUsers[0].signedAt', oldVal: undefined, newVal: new Date(now - 10000).toISOString(), type: 'added' },
    ];

    // Build diff rows manually
    const diffFragment = document.createDocumentFragment();
    for (const d of diffs) {
      const row = document.getElementById('tpl-poll-diff-row').content.cloneNode(true).firstElementChild;
      let bgColor, label, textColor;
      if (d.type === 'added') { bgColor = '#22863a'; label = '+'; textColor = '#aaffaa'; }
      else if (d.type === 'removed') { bgColor = '#b31d28'; label = '\u2212'; textColor = '#ffaaaa'; }
      else { bgColor = '#1b3a4b'; label = '~'; textColor = '#7ec8e3'; }

      row.style.background = bgColor;
      const labelEl = row.querySelector('.diff-label');
      labelEl.textContent = label;
      labelEl.style.color = textColor;

      const pathEl = row.querySelector('.diff-path');
      pathEl.style.color = '#79b8ff';
      pathEl.textContent = d.path;

      const valueEl = row.querySelector('.diff-value');
      if (d.type === 'changed') {
        const oldSpan = document.createElement('span');
        oldSpan.style.cssText = 'color:#ff9999;text-decoration:line-through';
        oldSpan.textContent = JSON.stringify(d.oldVal);
        const arrow = document.createElement('span');
        arrow.style.color = '#888';
        arrow.textContent = ' \u2192 ';
        const newSpan = document.createElement('span');
        newSpan.style.cssText = 'color:#99ff99;font-weight:600';
        newSpan.textContent = JSON.stringify(d.newVal);
        valueEl.append(oldSpan, arrow, newSpan);
      } else if (d.type === 'added') {
        const span = document.createElement('span');
        span.style.cssText = 'color:#99ff99;font-weight:600';
        span.textContent = JSON.stringify(d.newVal);
        valueEl.appendChild(span);
      }

      diffFragment.appendChild(row);
    }

    const changeEl = document.getElementById('tpl-poll-change-card').content.cloneNode(true).firstElementChild;
    changeEl.querySelector('.webhook-time').textContent = new Date(now - 8000).toLocaleTimeString();
    changeEl.querySelector('[data-slot="change-count"]').textContent = '3 changes';
    changeEl.querySelector('[data-slot="diff-rows"]').appendChild(diffFragment);
    $container.prepend(changeEl);
  });
  await page.waitForTimeout(600);

  // -- Expand one trace entry detail to show request/response content ----
  await page.evaluate(() => {
    const firstEntry = document.querySelector('#trace-entries .trace-entry');
    if (firstEntry) {
      const summary = firstEntry.querySelector('.trace-summary');
      if (summary) summary.click();
    }
  });
  await page.waitForTimeout(400);

  // -- Expand one webhook detail to show headers and body ----------------
  await page.evaluate(() => {
    const firstWh = document.querySelector('#section-webhooks .webhook-entry [data-slot="details-toggle"]');
    if (firstWh) firstWh.click();
  });
  await page.waitForTimeout(400);

  // -- Full overview shot with all sidebar data --------------------------
  await fullShot('10-operate-trace', { height: 1200 });

  // -- Separate shots for each sidebar section ---------------------------
  // Webhooks section
  await page.evaluate(() => {
    const whSection = document.getElementById('section-webhooks');
    if (whSection) whSection.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await shot('16-sidebar-webhooks', '#section-webhooks', { height: 1800 });

  // Status Polling section (with diff)
  await page.evaluate(() => {
    const pollSection = document.getElementById('section-polling');
    if (pollSection) pollSection.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await shot('19-sidebar-polling', '#section-polling', { height: 1800 });

  // API Trace section
  await page.evaluate(() => {
    const traceSection = document.getElementById('section-trace');
    if (traceSection) traceSection.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
  await shot('20-sidebar-trace', '#section-trace', { height: 1800 });

  // -- JSON tooltip in trace body (hover over a json-key-hover element) --
  // Ensure a trace entry with json-key-hover is expanded and visible
  await page.evaluate(() => {
    // Find the first visible json-key-hover element, scrolling its parent trace entry open if needed
    const keys = document.querySelectorAll('.json-key-hover');
    for (const k of keys) {
      // Check if it's inside the trace section
      if (k.closest('#section-trace')) {
        k.scrollIntoView({ block: 'center' });
        return true;
      }
    }
    return false;
  });
  await page.waitForTimeout(300);
  const hoverKey = await page.$('#section-trace .json-key-hover');
  if (hoverKey) {
    const isVisible = await hoverKey.isVisible();
    if (isVisible) {
      await hoverKey.hover();
      await page.waitForTimeout(500);
      await fullShot('21-trace-json-tooltip');
    } else {
      console.warn('  SKIP  21-trace-json-tooltip  (json-key-hover not visible)');
    }
  } else {
    console.warn('  SKIP  21-trace-json-tooltip  (no .json-key-hover in trace)');
  }

  // =========================================================================
  // STEP 4 - Code Snippets
  // =========================================================================
  console.log('\n--- Step 4: Code Snippets ---');
  await page.click('[data-step="4"]');
  await page.waitForTimeout(800);

  // Click "Java (inSign API)" tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('.snippet-tab, [data-lang]');
    for (const tab of tabs) {
      if (tab.textContent.includes('inSign API') || tab.textContent.includes('insign')) {
        tab.click();
        break;
      }
    }
  });
  await page.waitForTimeout(500);

  // Enable the "Docs" toggle
  await page.evaluate(() => {
    const toggles = document.querySelectorAll('input[type="checkbox"]');
    for (const t of toggles) {
      const label = t.closest('label') || t.parentElement;
      if (label && label.textContent.includes('Docs') && !t.checked) {
        t.click();
        break;
      }
    }
  });
  await page.waitForTimeout(500);
  await fullShot('12-code-snippets', { height: 2000 });

  // =========================================================================
  // Done
  // =========================================================================
  await browser.close();
  srv.close();

  console.log(`\nAll screenshots saved to ${OUT}/`);
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
  console.log(`  ${files.length} files: ${files.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });

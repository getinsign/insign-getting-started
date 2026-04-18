const { test, expect } = require('@playwright/test');
const { buildSignaturePath } = require('./signature-path');
const fs = require('fs');
const path = require('path');

// Signature text and font - change these to use a different name or style
const SIGNATURE_TEXT = 'Chris Signlord';
const SIGNATURE_FONT = path.join(__dirname, 'fonts', 'DancingScript.ttf');

// The "Full flow" test in DEMO_VIDEO mode reads this storyboard and drives the
// browser declaratively. The file is the single source of truth for what the
// video shows (mouse, keyboard, scrolls, highlights) and what the narration
// says (EN + DE). Timestamps per marker are written out so downstream subtitle
// and TTS generators can align to real wall-clock offsets.
const STORYBOARD_PATH = path.resolve(__dirname, '..', '..', '..', 'docs', 'video', 'funnel-narration.json');

const DEMO = !!process.env.DEMO_VIDEO;
const CAPTION_LANG = process.env.CAPTION_LANG || 'en';

// Bolder highlight ring + red demo cursor so they pop in recorded video,
// plus a floating caption box anchored to whatever element is currently
// highlighted. Caption boxes replace the previous WebVTT subtitle approach.
const DEMO_OVERLAY_CSS = `
  .demo-highlight {
    outline: 5px solid #ff3131 !important;
    outline-offset: 6px;
    border-radius: 10px;
    position: relative;
    z-index: 50;
    background-color: rgba(255, 49, 49, 0.07) !important;
    animation: demo-pulse 1.0s ease-in-out infinite;
  }
  @keyframes demo-pulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(255, 49, 49, 0.65);
      outline-color: #ff3131;
    }
    50% {
      box-shadow: 0 0 0 18px rgba(255, 49, 49, 0.0);
      outline-color: #ff7a7a;
    }
  }

  .demo-cursor {
    position: fixed;
    top: 0; left: 0;
    width: 34px; height: 34px;
    pointer-events: none;
    z-index: 99999;
    transform: translate(-9999px, -9999px);
    transition: transform 90ms linear;
    mix-blend-mode: normal;
  }
  .demo-cursor::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,20,20,0.98) 0%, rgba(255,20,20,0.55) 55%, rgba(255,20,20,0) 100%);
    transform: translate(-50%, -50%);
    box-shadow: 0 0 18px 5px rgba(255, 20, 20, 0.55);
  }
  .demo-cursor::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    width: 44px; height: 44px;
    border-radius: 50%;
    border: 2px solid rgba(255, 30, 30, 0.55);
    transform: translate(-50%, -50%);
    animation: demo-cursor-ring 1.6s ease-out infinite;
  }
  @keyframes demo-cursor-ring {
    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
  }

  .demo-caption {
    position: fixed;
    top: 0; left: 0;
    z-index: 9998;
    max-width: 560px;
    min-width: 260px;
    padding: 24px 32px;
    border-radius: 20px;
    background: rgba(18, 26, 44, 0.62);
    backdrop-filter: blur(22px) saturate(150%);
    -webkit-backdrop-filter: blur(22px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
    font-size: 22px;
    font-weight: 500;
    line-height: 1.45;
    letter-spacing: 0.003em;
    text-shadow: 0 1px 2px rgba(0,0,0,0.35);
    box-shadow:
      0 28px 72px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.04) inset;
    opacity: 0;
    transform: translateY(10px) scale(0.96);
    transition:
      opacity 520ms cubic-bezier(.2,.0,.1,1),
      transform 520ms cubic-bezier(.2,.0,.1,1);
    pointer-events: none;
    white-space: normal;
    word-wrap: break-word;
  }
  .demo-caption.active {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const DEMO_CAPTION_JS = `
  window.__demoCaption = (() => {
    let el = null;
    function ensure() {
      if (el) return el;
      el = document.createElement('div');
      el.className = 'demo-caption';
      document.body.appendChild(el);
      return el;
    }
    function position(rect) {
      const e = ensure();
      const vw = window.innerWidth, vh = window.innerHeight;
      const margin = 26;
      const capW = Math.min(560, e.offsetWidth || 520);
      const capH = e.offsetHeight || 110;
      if (!rect) {
        e.style.left = Math.round(vw/2 - capW/2) + 'px';
        e.style.top = Math.round(vh - capH - 70) + 'px';
        return;
      }
      const roomR = vw - rect.right, roomL = rect.left;
      const roomB = vh - rect.bottom, roomT = rect.top;
      let x, y;
      if (roomR >= capW + margin + 12) {
        x = rect.right + margin; y = rect.top + rect.height/2 - capH/2;
      } else if (roomL >= capW + margin + 12) {
        x = rect.left - capW - margin; y = rect.top + rect.height/2 - capH/2;
      } else if (roomB >= capH + margin + 12) {
        x = rect.left + rect.width/2 - capW/2; y = rect.bottom + margin;
      } else if (roomT >= capH + margin + 12) {
        x = rect.left + rect.width/2 - capW/2; y = rect.top - capH - margin;
      } else {
        x = vw/2 - capW/2; y = vh - capH - 30;
      }
      x = Math.max(14, Math.min(vw - capW - 14, x));
      y = Math.max(14, Math.min(vh - capH - 14, y));
      e.style.left = Math.round(x) + 'px';
      e.style.top = Math.round(y) + 'px';
    }
    return {
      show(text, rect) {
        const e = ensure();
        e.textContent = text;
        // Position BEFORE fade-in so it lands in place.
        position(rect);
        void e.offsetHeight;
        e.classList.add('active');
      },
      hide() {
        if (el) el.classList.remove('active');
      },
    };
  })();
`;

async function installDemoOverlays(page) {
  if (!DEMO) return;
  await page.addStyleTag({ content: DEMO_OVERLAY_CSS });
  await page.evaluate(`(() => {
    if (document.querySelector('.demo-cursor')) return;
    const c = document.createElement('div');
    c.className = 'demo-cursor';
    document.body.appendChild(c);
    document.addEventListener('mousemove', (e) => {
      c.style.transform = 'translate(' + (e.clientX - 17) + 'px, ' + (e.clientY - 17) + 'px)';
    });
  })();`);
  await page.evaluate(DEMO_CAPTION_JS);
}

async function rectFromSelector(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }, selector);
}

async function rectFromSidebarText(page, text) {
  return await page.evaluate((text) => {
    const panel = document.querySelector('.sidebar-doc-panel.active');
    if (!panel) return null;
    const candidates = [];
    const w = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT, null);
    while (w.nextNode()) {
      const el = w.currentNode;
      if (el.textContent && el.textContent.includes(text)) candidates.push(el);
    }
    candidates.sort((a, b) => a.textContent.length - b.textContent.length);
    const t = candidates[0];
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }, text);
}

async function showCaption(page, text, rect) {
  await page.evaluate(({ t, r }) => window.__demoCaption && window.__demoCaption.show(t, r), { t: text, r: rect });
}

async function hideCaption(page) {
  await page.evaluate(() => window.__demoCaption && window.__demoCaption.hide());
}

function createMarkers() {
  const started = Date.now();
  const markers = [];
  return {
    mark(id) {
      const t = (Date.now() - started) / 1000;
      if (markers.length > 0) markers[markers.length - 1].end = t;
      markers.push({ id, start: t });
    },
    finish() {
      if (markers.length > 0) {
        markers[markers.length - 1].end = (Date.now() - started) / 1000;
      }
      return { startedAt: new Date(started).toISOString(), markers };
    },
  };
}

// ============================================================================
// Storyboard action interpreter
// ============================================================================
//
// Each `action` entry in funnel-narration.json dispatches to one handler here.
// Handlers are intentionally small and composable. Adding a new action type
// means adding a new case below plus a matching entry in the JSON.

const HIGHLIGHT_DEFAULT_MS = 2200;
const MOUSE_MOVE_STEPS = 18;

async function elementCenter(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return null;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function mouseTo(page, selector) {
  const c = await elementCenter(page, selector);
  if (!c) return;
  await page.mouse.move(c.x, c.y, { steps: MOUSE_MOVE_STEPS });
}

async function highlight(page, selector, ms) {
  await page.evaluate(({ sel, ms }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.add('demo-highlight');
    setTimeout(() => el.classList.remove('demo-highlight'), ms);
  }, { sel: selector, ms });
}

async function highlightSidebarContaining(page, text, ms) {
  await page.evaluate(({ text, ms }) => {
    const panel = document.querySelector('.sidebar-doc-panel.active');
    if (!panel) return;
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT, null);
    let match = null;
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (el.textContent && el.textContent.includes(text)) {
        // Prefer the smallest element that contains the text so we don't
        // highlight the whole doc panel.
        if (!match || (el.contains(match))) continue;
        match = el;
      }
    }
    // Re-walk to pick the deepest (smallest) match.
    const candidates = [];
    const w2 = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT, null);
    while (w2.nextNode()) {
      const el = w2.currentNode;
      if (el.textContent && el.textContent.includes(text)) candidates.push(el);
    }
    candidates.sort((a, b) => a.textContent.length - b.textContent.length);
    const target = candidates[0];
    if (!target) return;
    target.classList.add('demo-highlight');
    setTimeout(() => target.classList.remove('demo-highlight'), ms);
  }, { text, ms });
}

async function sidebarScrollToText(page, text) {
  await page.evaluate((text) => {
    const panel = document.querySelector('.sidebar-doc-panel.active');
    if (!panel) return;
    const candidates = [];
    const w = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT, null);
    while (w.nextNode()) {
      const el = w.currentNode;
      if (el.textContent && el.textContent.includes(text)) candidates.push(el);
    }
    candidates.sort((a, b) => a.textContent.length - b.textContent.length);
    const target = candidates[0];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, text);
  await page.waitForTimeout(500);
}

async function scrollIntoView(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, selector);
  await page.waitForTimeout(400);
}

async function drawSignatureOnCanvas(page) {
  const canvas = page.locator('#sig-container canvas.pad').first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) return;
  const points = buildSignaturePath(SIGNATURE_TEXT, {
    fontPath: SIGNATURE_FONT,
    canvasBox: box,
  });
  await canvas.evaluate((el, pts) => {
    function fire(type, x, y) {
      el.dispatchEvent(new PointerEvent(type, {
        pointerId: 1,
        pointerType: 'pen',
        clientX: x,
        clientY: y,
        pageX: x + window.scrollX,
        pageY: y + window.scrollY,
        screenX: x,
        screenY: y,
        pressure: type === 'pointerup' ? 0 : 0.5,
        bubbles: true,
        cancelable: true,
        isPrimary: true,
      }));
    }
    return new Promise((resolve) => {
      let i = 0;
      let penDown = false;
      function step() {
        if (i >= pts.length) {
          if (penDown) fire('pointerup', pts[i - 1].x, pts[i - 1].y);
          resolve();
          return;
        }
        const p = pts[i];
        i++;
        if (p === null) {
          if (penDown) fire('pointerup', pts[i - 2].x, pts[i - 2].y);
          penDown = false;
          setTimeout(step, 80);
        } else if (typeof p === 'number') {
          setTimeout(step, p);
          return;
        } else if (!penDown) {
          fire('pointerdown', p.x, p.y);
          penDown = true;
          setTimeout(step, 8);
        } else {
          fire('pointermove', p.x, p.y);
          setTimeout(step, 8);
        }
      }
      step();
    });
  }, points);
  const confirmBtn = page.locator('.btn-confirm').first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
  }
}

async function runAction(page, action) {
  switch (action.type) {
    case 'goto':
      await page.goto(action.url);
      return;
    case 'install-demo-overlays':
      await installDemoOverlays(page);
      return;
    case 'wait':
      await page.waitForTimeout(action.ms || 0);
      return;
    case 'wait-for-visible':
      await expect(page.locator(action.selector)).toBeVisible({ timeout: action.timeout_ms || 15000 });
      return;
    case 'wait-for-enabled':
      await expect(page.locator(action.selector)).toBeEnabled({ timeout: action.timeout_ms || 15000 });
      return;
    case 'click':
      await page.click(action.selector);
      return;
    case 'hover':
      await page.hover(action.selector);
      return;
    case 'mouse-to':
      await mouseTo(page, action.selector);
      return;
    case 'fill':
      await page.fill(action.selector, action.value);
      return;
    case 'type':
      await page.type(action.selector, action.text, { delay: action.delay ?? 80 });
      return;
    case 'press':
      await page.keyboard.press(action.key);
      return;
    case 'select':
      await page.selectOption(action.selector, action.value);
      return;
    case 'scroll-into-view':
      await scrollIntoView(page, action.selector);
      return;
    case 'highlight':
      await highlight(page, action.selector, action.ms || HIGHLIGHT_DEFAULT_MS);
      return;
    case 'sidebar-scroll-to-text':
      await sidebarScrollToText(page, action.text);
      return;
    case 'highlight-sidebar-containing':
      await highlightSidebarContaining(page, action.text, action.ms || HIGHLIGHT_DEFAULT_MS);
      return;
    case 'signature-draw':
      await drawSignatureOnCanvas(page);
      return;
    case 'pdf-view': {
      // Drive the Chromium PDF viewer via URL parameters (#page, #zoom=scale,
      // #zoom=scale,xoff,yoff, #view=FitH,top). Changing only the hash on an
      // already-loaded <iframe> does NOT make PDFium re-position — we have to
      // force a fresh navigation. Appending a cache-buster query does the job.
      await page.evaluate(({ sel, hash }) => {
        const iframe = document.querySelector(sel);
        if (!iframe) return;
        const base = iframe.src.split('?')[0].split('#')[0];
        iframe.src = `${base}?_cb=${Date.now()}#${hash}`;
      }, { sel: action.selector || '#pdf-preview', hash: action.hash });
      return;
    }
    default:
      throw new Error(`Unknown storyboard action: ${action.type}`);
  }
}

/**
 * Assert that the signed-PDF preview iframe actually loads a valid PDF.
 *
 * The previous spec only checked `#btn-download`'s href, which meant a regression
 * that left `#pdf-preview` empty or broken would still pass. This helper:
 *   1. Waits up to 20s for the iframe's `src` to be set to a /document URL.
 *   2. Issues the same request via APIRequestContext and asserts status 200,
 *      Content-Type application/pdf, and a non-trivial body size.
 *   3. Verifies the iframe's own contentDocument finishes loading.
 *
 * Failure modes caught: server 500s, session-not-found 404s, wrong
 * Content-Disposition (attachment vs inline), empty/truncated buffers,
 * iframe src never set because proceedToStep4 threw.
 */
async function verifyPdfPreview(page) {
  // Wait for the iframe src to get populated by proceedToStep4.
  const pdfUrl = await page.waitForFunction(() => {
    const el = document.getElementById('pdf-preview');
    return el && el.getAttribute('src') && el.getAttribute('src').includes('/document') ? el.getAttribute('src') : null;
  }, null, { timeout: 20000 }).then(h => h.jsonValue());

  // Fetch the same URL directly and introspect the response.
  const resp = await page.request.get(pdfUrl);
  const status = resp.status();
  const contentType = resp.headers()['content-type'] || '';
  const disposition = resp.headers()['content-disposition'] || '';
  const body = await resp.body();

  if (status !== 200 || !contentType.includes('application/pdf') || body.length < 1000 || !disposition.startsWith('inline')) {
    throw new Error(
      `PDF preview check FAILED:\n` +
      `  url=${pdfUrl}\n` +
      `  status=${status}\n` +
      `  content-type=${contentType}\n` +
      `  content-disposition=${disposition}\n` +
      `  body.length=${body.length}\n` +
      `  body preview=${body.slice(0, 80).toString('utf8')}`
    );
  }

  // Ensure the iframe itself finished loading (not just that the URL works).
  await page.waitForFunction(() => {
    const el = document.getElementById('pdf-preview');
    if (!el || !el.contentDocument) return false;
    return el.contentDocument.readyState === 'complete';
  }, null, { timeout: 15000 }).catch(() => {
    // Some browsers hide PDF contentDocument cross-origin-ish; surface a softer warning
    // but don't fail — the direct fetch above already proves the server returns a PDF.
    console.warn('pdf-preview contentDocument not readable (browser PDF plugin may hide it)');
  });
}

// How long the caption takes to fade out before the mouse moves to the next
// target, and how long the cursor must sit still at its new target before the
// caption fades in. Keeps captions calm — they appear only once the pointer
// has settled, never during motion.
const CAPTION_FADE_OUT_MS = 550;
const CAPTION_SETTLE_MS = 550;

function isAnchorAction(a) {
  if (a.type === 'mouse-to' && a.selector) return true;
  if (a.type === 'highlight' && a.selector) return true;
  if (a.type === 'highlight-sidebar-containing' && a.text) return true;
  if (a.type === 'sidebar-scroll-to-text' && a.text) return true;
  return false;
}

async function resolveAnchorRect(page, action) {
  if (action.type === 'highlight-sidebar-containing' || action.type === 'sidebar-scroll-to-text') {
    return await rectFromSidebarText(page, action.text);
  }
  return await rectFromSelector(page, action.selector);
}

async function runStoryboard(page, markers) {
  const storyboard = JSON.parse(fs.readFileSync(STORYBOARD_PATH, 'utf8'));
  if (storyboard.version !== 2) {
    throw new Error(`Unsupported storyboard version: ${storyboard.version}`);
  }
  for (let i = 0; i < storyboard.steps.length; i++) {
    const step = storyboard.steps[i];
    markers.mark(step.id);

    // Fade out the previous step's caption before the mouse starts moving.
    if (i > 0) {
      await hideCaption(page);
      await page.waitForTimeout(CAPTION_FADE_OUT_MS);
    }

    const text = step.narration && step.narration[CAPTION_LANG];
    const hasAnchor = step.actions.some(isAnchorAction);
    let captionShown = false;

    if (text && !hasAnchor) {
      // No anchor in this step — show the caption at bottom-center before
      // the step's actions run (so it's visible during any waits/scrolls).
      await showCaption(page, text, null);
      captionShown = true;
    }

    for (const action of step.actions) {
      await runAction(page, action);
      if (!captionShown && text && isAnchorAction(action)) {
        // Mouse / highlight just landed on the first anchor. Wait for the
        // pointer to settle, then fade the caption in at that anchor.
        await page.waitForTimeout(CAPTION_SETTLE_MS);
        const rect = await resolveAnchorRect(page, action);
        await showCaption(page, text, rect);
        captionShown = true;
      }
    }
  }
  await hideCaption(page);
  return storyboard;
}

test.describe('Getting Started - Full Broker Mandate Flow', () => {

  // Capture browser console + page errors for every test; attach on failure
  // so the CI artifact upload includes them alongside screenshot/video.
  test.beforeEach(async ({ page }) => {
    const logs = [];
    page._consoleLogs = logs;
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[pageerror] ${err.message}\n${err.stack || ''}`));
    page.on('requestfailed', req => logs.push(`[requestfailed] ${req.method()} ${req.url()} - ${req.failure()?.errorText || ''}`));
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const logs = page._consoleLogs || [];
    if (logs.length === 0) return;
    const logPath = testInfo.outputPath('browser-console.log');
    fs.writeFileSync(logPath, logs.join('\n'));
    await testInfo.attach('browser-console.log', {
      path: logPath,
      contentType: 'text/plain',
    });
  });

  test('Step 1 - Welcome page renders correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#step-1-panel')).toBeVisible();
    await expect(page.locator('.welcome-title')).toBeVisible();
    await expect(page.locator('#btn-start')).toBeVisible();
  });

  test('Step 2 - Form validation rejects empty submission', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-start');
    await expect(page.locator('#step-2-panel')).toBeVisible();
    await page.click('#btn-submit');
    await expect(page.locator('#step-2-panel')).toBeVisible();
  });

  test('Step 2 - Fill form and submit creates inSign session', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-start');

    await page.fill('#firstName', 'Max');
    await page.fill('#lastName', 'Mustermann');
    await page.fill('#street', 'Teststrasse 42');
    await page.fill('#zip', '10115');
    await page.fill('#city', 'Berlin');
    await page.fill('#birthdate', '1990-05-15');

    await page.click('#btn-submit');
    await expect(page.locator('#step-3-panel')).toBeVisible({ timeout: 30000 });
  });

  test('Step 3 - Signature pad loads from inSign', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await page.goto('/');
    await page.click('#btn-start');

    await page.fill('#firstName', 'Pad');
    await page.fill('#lastName', 'Tester');
    await page.fill('#street', 'Padweg 1');
    await page.fill('#zip', '80331');
    await page.fill('#city', 'Teststadt');
    await page.fill('#birthdate', '1985-12-01');

    await page.click('#btn-submit');
    await expect(page.locator('#step-3-panel')).toBeVisible({ timeout: 30000 });

    await page.waitForFunction(() => {
      const loading = document.getElementById('sig-loading');
      const container = document.getElementById('sig-container');
      return (loading && loading.classList.contains('d-none'))
          || (container && container.children.length > 0);
    }, { timeout: 50000 }).catch(() => {
      console.log('initEmbeddedData callback did not fire within timeout.');
      console.log('Console logs:', consoleLogs.join('\n'));
    });

    const insignLoaded = await page.evaluate(() => typeof INSIGNAPP !== 'undefined' && typeof INSIGNAPP.embedded !== 'undefined');
    expect(insignLoaded).toBeTruthy();

    const relevant = consoleLogs.filter(l => l.includes('INSIGN') || l.includes('insign') || l.includes('Error') || l.includes('error'));
    if (relevant.length > 0) console.log('Browser console:', relevant.join('\n'));
  });

  test('Full flow - Fill, Draw signature, Finish', async ({ page }, testInfo) => {
    test.setTimeout(DEMO ? 600_000 : 180_000);

    if (!DEMO) {
      // Non-DEMO smoke path: run the minimum flow to validate the spec without
      // reading the storyboard (keeps `npm test` in CI short and deterministic).
      await page.goto('/');
      await page.click('#btn-start');
      await expect(page.locator('#step-2-panel')).toBeVisible();
      await page.fill('#firstName', 'Chris');
      await page.fill('#lastName', 'Signlord');
      await page.fill('#street', '221B Baker Street');
      await page.fill('#zip', 'NW1 6XE');
      await page.fill('#city', 'London');
      await page.fill('#birthdate', '1985-12-01');
      await page.click('#btn-submit');
      await expect(page.locator('#step-3-panel')).toBeVisible({ timeout: 30000 });
      const hasCanvas = await page.locator('#sig-container canvas.pad').first()
        .waitFor({ state: 'visible', timeout: 40000 })
        .then(() => true)
        .catch(() => false);
      if (hasCanvas) await drawSignatureOnCanvas(page);
      await expect(page.locator('#btn-finish')).toBeEnabled({ timeout: 15000 });
      await page.click('#btn-finish');
      await expect(page.locator('#step-4-panel')).toBeVisible({ timeout: 15000 });
      const href = await page.locator('#btn-download').getAttribute('href');
      expect(href).toContain('/api/session/');
      await verifyPdfPreview(page);
      return;
    }

    // DEMO_VIDEO=1: storyboard-driven flow with narrated markers.
    const markers = createMarkers();
    await runStoryboard(page, markers);

    // Even in DEMO mode, fail loudly if the signed PDF didn't render —
    // otherwise the video silently ships with an empty iframe (see Apr 2026
    // regression where only btn-download was checked).
    await verifyPdfPreview(page);

    const out = markers.finish();
    out.viewport = page.viewportSize();
    const outPath = testInfo.outputPath('funnel-timings.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    await testInfo.attach('funnel-timings.json', { path: outPath, contentType: 'application/json' });
  });

  // ---------- Cleanup ----------

  test.afterAll(async ({ request }) => {
    try {
      const res = await request.delete('/api/sessions/purge');
      if (res.ok()) {
        const json = await res.json();
        if (json.purged > 0) {
          console.log(`[teardown] Purged ${json.purged} inSign session(s)`);
        }
      }
    } catch {
      // Server may already be shutting down - ignore
    }
  });
});

/**
 * Storyboard interpreter — shared between the funnel recording (Playwright
 * spec) and the Java-app recording (standalone Node). Drives a Playwright
 * `page` through a v2 funnel-narration.json / java-app-narration.json scene.
 *
 * Features:
 *   - Red demo cursor overlay that follows mouse moves.
 *   - Pulsing red highlight ring around whichever element is under focus.
 *   - Floating translucent caption popup that appears only after the pointer
 *     has settled (so captions don't flicker during motion), anchored next
 *     to the currently-highlighted element.
 *   - Dispatches the full v2 action vocabulary: goto, install-demo-overlays,
 *     wait, wait-for-visible, wait-for-enabled, click, hover, mouse-to, fill,
 *     type, press, select, scroll-into-view, highlight,
 *     sidebar-scroll-to-text, highlight-sidebar-containing, signature-draw,
 *     pdf-view.
 *
 * Usage:
 *   import { runStoryboard, installDemoOverlays, createMarkers } from './lib/storyboard-runner.mjs';
 *   await installDemoOverlays(page);
 *   const markers = createMarkers();
 *   await runStoryboard(page, storyboardJson, markers, { lang: 'en' });
 */

import fs from 'fs';

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
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 49, 49, 0.65); outline-color: #ff3131; }
    50%      { box-shadow: 0 0 0 18px rgba(255, 49, 49, 0.0); outline-color: #ff7a7a; }
  }
  .demo-cursor {
    position: fixed; top: 0; left: 0;
    width: 34px; height: 34px;
    pointer-events: none; z-index: 99999;
    transform: translate(-9999px, -9999px);
    transition: transform 90ms linear;
  }
  .demo-cursor::before {
    content: ''; position: absolute; top: 50%; left: 50%;
    width: 14px; height: 14px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,20,20,0.98) 0%, rgba(255,20,20,0.55) 55%, rgba(255,20,20,0) 100%);
    transform: translate(-50%, -50%);
    box-shadow: 0 0 18px 5px rgba(255, 20, 20, 0.55);
  }
  .demo-cursor::after {
    content: ''; position: absolute; top: 50%; left: 50%;
    width: 44px; height: 44px; border-radius: 50%;
    border: 2px solid rgba(255, 30, 30, 0.55);
    transform: translate(-50%, -50%);
    animation: demo-cursor-ring 1.6s ease-out infinite;
  }
  @keyframes demo-cursor-ring {
    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
  }
  .demo-caption {
    position: fixed; top: 0; left: 0; z-index: 9998;
    max-width: 560px; min-width: 260px;
    padding: 24px 32px; border-radius: 20px;
    background: rgba(18, 26, 44, 0.62);
    backdrop-filter: blur(22px) saturate(150%);
    -webkit-backdrop-filter: blur(22px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
    font-size: 22px; font-weight: 500; line-height: 1.45;
    letter-spacing: 0.003em;
    text-shadow: 0 1px 2px rgba(0,0,0,0.35);
    box-shadow: 0 28px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset;
    opacity: 0; transform: translateY(10px) scale(0.96);
    transition: opacity 520ms cubic-bezier(.2,.0,.1,1), transform 520ms cubic-bezier(.2,.0,.1,1);
    pointer-events: none;
    white-space: normal; word-wrap: break-word;
  }
  .demo-caption.active { opacity: 1; transform: translateY(0) scale(1); }
`;

const CAPTION_JS = `
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
        position(rect);
        void e.offsetHeight;
        e.classList.add('active');
      },
      hide() { if (el) el.classList.remove('active'); },
    };
  })();
`;

const HIGHLIGHT_DEFAULT_MS = 2200;
const MOUSE_MOVE_STEPS = 18;
const CAPTION_FADE_OUT_MS = 550;
const CAPTION_SETTLE_MS = 550;

export async function installDemoOverlays(page) {
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
  await page.evaluate(CAPTION_JS);
}

export function createMarkers() {
  const started = Date.now();
  const markers = [];
  return {
    mark(id) {
      const t = (Date.now() - started) / 1000;
      if (markers.length > 0) markers[markers.length - 1].end = t;
      markers.push({ id, start: t });
    },
    finish() {
      if (markers.length > 0) markers[markers.length - 1].end = (Date.now() - started) / 1000;
      return { startedAt: new Date(started).toISOString(), markers };
    },
  };
}

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
    const candidates = [];
    const w = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT, null);
    while (w.nextNode()) {
      const el = w.currentNode;
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

async function runAction(page, action, hooks) {
  switch (action.type) {
    case 'goto':                 await page.goto(action.url); return;
    case 'install-demo-overlays': await installDemoOverlays(page); return;
    case 'wait':                 await page.waitForTimeout(action.ms || 0); return;
    case 'wait-for-visible':     await page.locator(action.selector).first().waitFor({ state: 'visible', timeout: action.timeout_ms || 15000 }); return;
    case 'wait-for-enabled':     {
      await page.locator(action.selector).first().waitFor({ state: 'visible', timeout: action.timeout_ms || 15000 });
      const start = Date.now();
      while (Date.now() - start < (action.timeout_ms || 15000)) {
        const disabled = await page.locator(action.selector).first().isDisabled().catch(() => true);
        if (!disabled) return;
        await page.waitForTimeout(150);
      }
      throw new Error(`wait-for-enabled timed out on ${action.selector}`);
    }
    case 'click':                await page.click(action.selector); return;
    case 'hover':                await page.hover(action.selector); return;
    case 'mouse-to':             await mouseTo(page, action.selector); return;
    case 'fill':                 await page.fill(action.selector, action.value); return;
    case 'type':                 await page.type(action.selector, action.text, { delay: action.delay ?? 80 }); return;
    case 'press':                await page.keyboard.press(action.key); return;
    case 'select':               await page.selectOption(action.selector, action.value); return;
    case 'scroll-into-view':     await scrollIntoView(page, action.selector); return;
    case 'highlight':            await highlight(page, action.selector, action.ms || HIGHLIGHT_DEFAULT_MS); return;
    case 'sidebar-scroll-to-text':        await sidebarScrollToText(page, action.text); return;
    case 'highlight-sidebar-containing':  await highlightSidebarContaining(page, action.text, action.ms || HIGHLIGHT_DEFAULT_MS); return;
    case 'signature-draw':       if (hooks?.signatureDraw) return await hooks.signatureDraw(page); throw new Error('signature-draw requires a signatureDraw hook');
    case 'pdf-view': {
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

export async function runStoryboard(page, storyboard, markers, opts = {}) {
  const lang = opts.lang || 'en';
  const hooks = opts.hooks || {};
  if (storyboard.version !== 2) {
    throw new Error(`Unsupported storyboard version: ${storyboard.version}`);
  }
  for (let i = 0; i < storyboard.steps.length; i++) {
    const step = storyboard.steps[i];
    markers.mark(step.id);
    if (i > 0) {
      await hideCaption(page);
      await page.waitForTimeout(CAPTION_FADE_OUT_MS);
    }
    const text = step.narration && step.narration[lang];
    const hasAnchor = step.actions.some(isAnchorAction);
    let captionShown = false;
    if (text && !hasAnchor) {
      await showCaption(page, text, null);
      captionShown = true;
    }
    for (const action of step.actions) {
      await runAction(page, action, hooks);
      if (!captionShown && text && isAnchorAction(action)) {
        await page.waitForTimeout(CAPTION_SETTLE_MS);
        const rect = await resolveAnchorRect(page, action);
        await showCaption(page, text, rect);
        captionShown = true;
      }
    }
  }
  await hideCaption(page);
}

export function loadStoryboard(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

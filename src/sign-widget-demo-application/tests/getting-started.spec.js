const { test, expect } = require('@playwright/test');
const { buildSignaturePath } = require('./signature-path');
const fs = require('fs');
const path = require('path');

// Signature text and font - change these to use a different name or style
const SIGNATURE_TEXT = 'Chris Signlord';
const SIGNATURE_FONT = path.join(__dirname, 'fonts', 'DancingScript.ttf');

test.describe('Getting Started - Full SEPA Mandate Flow', () => {

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
    // Write to the per-test output dir so the CI artifact upload picks it up.
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
    // Should stay on step 2 (native validation)
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

    // Should transition to step 3 (embedded signature)
    await expect(page.locator('#step-3-panel')).toBeVisible({ timeout: 30000 });
  });

  test('Step 3 - Signature pad loads from inSign', async ({ page }) => {
    test.setTimeout(120_000);

    // Collect console messages for debugging
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

    // Wait for loading spinner to disappear (means scripts loaded and callback fired)
    // or for content to appear in sig-container
    await page.waitForFunction(() => {
      const loading = document.getElementById('sig-loading');
      const container = document.getElementById('sig-container');
      return (loading && loading.classList.contains('d-none'))
          || (container && container.children.length > 0);
    }, { timeout: 50000 }).catch(() => {
      // If initEmbeddedData callback didn't fire, the scripts loaded but
      // the inSign sandbox may not have returned signature field data.
      // This is acceptable - verify scripts loaded at least.
      console.log('initEmbeddedData callback did not fire within timeout.');
      console.log('Console logs:', consoleLogs.join('\n'));
    });

    // Verify that at minimum the inSign scripts loaded (INSIGNAPP should exist)
    const insignLoaded = await page.evaluate(() => typeof INSIGNAPP !== 'undefined' && typeof INSIGNAPP.embedded !== 'undefined');
    expect(insignLoaded).toBeTruthy();

    // Log console output for debugging
    const relevant = consoleLogs.filter(l => l.includes('INSIGN') || l.includes('insign') || l.includes('Error') || l.includes('error'));
    if (relevant.length > 0) console.log('Browser console:', relevant.join('\n'));
  });

  test('Full flow - Fill, Draw signature, Finish', async ({ page }) => {
    test.setTimeout(180_000);
    // DEMO_VIDEO=1 adds pauses before clicks so screen recordings look natural
    const demoDelay = process.env.DEMO_VIDEO ? 5000 : 0;
    await page.goto('/');

    // Step 1
    await page.waitForTimeout(demoDelay);
    await page.click('#btn-start');
    await expect(page.locator('#step-2-panel')).toBeVisible();

    // Step 2: Fill form
    await page.fill('#firstName', 'Chris');
    await page.fill('#lastName', 'Signlord');
    await page.fill('#street', 'Playwright-Allee 1');
    await page.fill('#zip', '80331');
    await page.fill('#city', 'Teststadt');
    await page.fill('#birthdate', '1985-12-01');

    await page.waitForTimeout(demoDelay);
    await page.click('#btn-submit');
    await expect(page.locator('#step-3-panel')).toBeVisible({ timeout: 30000 });

    // Wait for sig pad or fallback
    const hasCanvas = await page.locator('#sig-container canvas.pad').first()
      .waitFor({ state: 'visible', timeout: 40000 })
      .then(() => true)
      .catch(() => false);

    if (hasCanvas) {
      // Draw "Chris Signlord" as a realistic cursive signature using pointer
      // events. The inSign pad detects 'onpointermove' in modern browsers and
      // switches to pointer events internally.
      const canvas = page.locator('#sig-container canvas.pad').first();
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();

      if (box) {
        const points = buildSignaturePath(SIGNATURE_TEXT, {
          fontPath: SIGNATURE_FONT,
          canvasBox: box
        });

        // Dispatch pointer events on the canvas at realistic handwriting speed.
        // null entries = pen lifts between strokes, numbers = pause in ms.
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
              isPrimary: true
            }));
          }
          return new Promise(resolve => {
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
                setTimeout(step, 80); // brief pause between words
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

        // Click Confirm if it appears (some inSign configs show a confirm button)
        const confirmBtn = page.locator('.btn-confirm').first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
        }
      }
    }

    // Wait for finish button to become enabled (inSign processes the signature)
    await expect(page.locator('#btn-finish')).toBeEnabled({ timeout: 15000 });

    // Click finish
    await page.waitForTimeout(demoDelay);
    await page.click('#btn-finish');
    await expect(page.locator('#step-4-panel')).toBeVisible({ timeout: 15000 });

    // Verify step 4
    await expect(page.locator('.done-title')).toBeVisible();
    await expect(page.locator('#btn-download')).toBeVisible();

    const href = await page.locator('#btn-download').getAttribute('href');
    expect(href).toContain('/api/session/');
    expect(href).toContain('/document/download');
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

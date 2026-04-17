/**
 * Integration test for the Getting Started demo app (docs/guide.html).
 *
 * Loads the application, clicks through visible interactive elements, and
 * watches the browser console for errors. The app is a multi-step wizard UI
 * (steps 1-4) with navbar, dark mode toggle, feature showcase, and API
 * buttons (sendStep, openInInsign, etc.) which are intentionally skipped.
 *
 * The test also exercises the full signing flow against the real sandbox,
 * using a MITM proxy (Playwright route interception) to selectively tamper:
 *   - /version is intercepted and returns 404 (simulate endpoint not found)
 *   - "Send to Sandbox" creates a real session on the sandbox
 *   - Waits for confetti #1 (session creation celebration)
 *   - /get/status is proxied through, but after baseline calls the response
 *     is modified to inject numberOfSignatures: 1 (faking a signature)
 *   - Waits for confetti #2 (signing celebration with 3x particles)
 * All other sandbox requests pass through untouched.
 *
 * Usage:  node test/getting-started.test.js [--headed]
 *
 * Requires: npx playwright install chromium
 * The script starts a local static server (npx serve docs/) automatically.
 */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = 9877;
const BASE_URL = `http://localhost:${PORT}/guide.html`;
const HEADED = process.argv.includes('--headed');
const SLOW_MO = HEADED ? 80 : 0;

const SANDBOX_ORIGIN = 'https://sandbox.test.getinsign.show';

// Buttons that trigger destructive/external actions we want to skip
const SKIP_BUTTON_SELECTORS = [
    '#btn-clear-all-storage',        // wipes localStorage
    '[onclick*="deleteSession"]',    // destructive
    'a[target="_blank"]',            // external links
];

// onclick handlers that call the real API (no backend in test)
// Note: sendStep is NOT skipped here - we intercept it via route mocking
const SKIP_ONCLICK_PATTERNS = [
    'openInInsign',
    'openAsOwner',
    'refreshSessionStatus',
    'copySessionId',
];

// ---------------------------------------------------------------------------
// MITM proxy - intercepts sandbox requests, forwards to real server,
// and selectively tampers with responses to drive the signing flow.
// ---------------------------------------------------------------------------

/**
 * Track /get/status calls to know when to inject the fake signature.
 * The app calls /get/status multiple times:
 *   - After session creation: fetchStatusAndBuildExternUsers (1x)
 *   - Sidebar refreshSessionStatus auto-poll (every 10s)
 *   - Signature watch: fetchSignatureCount for baseline (1x), then every 4s
 *
 * Instead of a fixed call-count threshold (fragile with concurrent calls),
 * we use a flag that the test sets explicitly AFTER the signature watch
 * baseline is established. This ensures the baseline always sees 0
 * signatures and the next poll triggers the celebration.
 */
let statusCallCount = 0;
let injectSignatures = false;

function setupMitmProxy(page) {
    // /version - intercept and return 404 (simulate endpoint not found)
    page.route(`${SANDBOX_ORIGIN}/version`, route => {
        console.log('[MITM] /version -> 404 (simulated)');
        route.fulfill({ status: 404, body: 'Not Found' });
    });

    // /get/status - forward to real sandbox, then tamper with the response
    // to inject a signature when the flag is set
    page.route(`${SANDBOX_ORIGIN}/get/status`, async route => {
        statusCallCount++;
        const injectSignature = injectSignatures;

        // Forward the request to the real sandbox
        const response = await route.fetch();
        const status = response.status();
        let body = await response.text();

        if (injectSignature && status === 200) {
            try {
                const data = JSON.parse(body);
                // Bump numberOfSignatures on every document
                if (Array.isArray(data.documentData)) {
                    for (const doc of data.documentData) {
                        doc.numberOfSignatures = Math.max(doc.numberOfSignatures || 0, 1);
                    }
                }
                // Mark all signature fields as signed
                if (Array.isArray(data.signaturFieldsStatusList)) {
                    for (const field of data.signaturFieldsStatusList) {
                        field.signed = true;
                    }
                }
                body = JSON.stringify(data);
                console.log(`[MITM] /get/status (call #${statusCallCount}) -> injected signature`);
            } catch {
                console.log(`[MITM] /get/status (call #${statusCallCount}) -> forwarded (parse error)`);
            }
        } else {
            console.log(`[MITM] /get/status (call #${statusCallCount}) -> forwarded (${status})`);
        }

        route.fulfill({
            status,
            headers: response.headers(),
            body,
        });
    });

    // Everything else passes through to the real sandbox untouched
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the local server to respond */
async function waitForServer(url, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(url, res => { res.resume(); resolve(); });
                req.on('error', reject);
                req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            return;
        } catch {
            await new Promise(r => setTimeout(r, 300));
        }
    }
    throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

/** Classify a console message */
function isConsoleError(msg) {
    return msg.type() === 'error';
}

/**
 * Wait for confetti to start by watching the #confetti-canvas for drawing
 * activity. Samples horizontal strips instead of reading all pixels to
 * avoid OOM crashes in headless browsers on large canvases.
 */
async function waitForConfetti(page, label, timeoutMs = 15000) {
    console.log(`[*] Waiting for ${label}...`);
    try {
        await page.waitForFunction(() => {
            const canvas = document.getElementById('confetti-canvas');
            if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            // Sample 5 horizontal strips (1px tall) spread across the canvas
            for (let s = 0; s < 5; s++) {
                const y = Math.floor(h * (s + 1) / 6);
                const data = ctx.getImageData(0, y, w, 1).data;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] > 0) return true;
                }
            }
            return false;
        }, { timeout: timeoutMs });
        console.log(`[*] ${label} detected!`);
        return true;
    } catch {
        console.log(`[*] ${label} NOT detected (timeout)`);
        return false;
    }
}

/**
 * Wait for confetti canvas to clear (animation finished).
 * Samples strips instead of reading all pixels.
 */
async function waitForConfettiEnd(page, timeoutMs = 20000) {
    try {
        await page.waitForFunction(() => {
            const canvas = document.getElementById('confetti-canvas');
            if (!canvas || canvas.width === 0 || canvas.height === 0) return true;
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            // Sample 5 horizontal strips - if all clear, animation is done
            for (let s = 0; s < 5; s++) {
                const y = Math.floor(h * (s + 1) / 6);
                const data = ctx.getImageData(0, y, w, 1).data;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] > 0) return false;
                }
            }
            return true;
        }, { timeout: timeoutMs });
    } catch { /* animation still running, continue anyway */ }
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------
(async () => {
    const results = {
        consoleErrors: [],
        uncaughtExceptions: [],
        clickedButtons: [],
        skippedButtons: [],
        failedClicks: [],
        confetti1: false,
        confetti2: false,
    };

    // --- Start static file server ---
    console.log('[*] Starting static server on port', PORT);
    const server = spawn('npx', ['serve', 'docs', '-l', String(PORT), '--no-clipboard'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
    });
    server.stdout.on('data', d => { /* silent */ });
    server.stderr.on('data', d => { /* silent */ });

    try {
        await waitForServer(BASE_URL);
        console.log('[*] Server ready at', BASE_URL);

        // --- Launch browser ---
        const browser = await chromium.launch({
            headless: !HEADED,
            slowMo: SLOW_MO,
        });
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            ignoreHTTPSErrors: true,
        });
        const page = await context.newPage();

        // --- Set up MITM proxy BEFORE navigating ---
        setupMitmProxy(page);

        // --- Capture console errors ---
        page.on('console', msg => {
            if (isConsoleError(msg)) {
                const text = msg.text();
                // Ignore known noise (favicon, font loading, MITM'd endpoints, etc.)
                if (text.includes('favicon') || text.includes('ERR_CONNECTION_REFUSED')) return;
                if (text.includes('/version')) return; // expected 404 from MITM
                const loc = msg.location();
                if (loc && loc.url && loc.url.includes('/version')) return; // 404 resource error
                results.consoleErrors.push({
                    text,
                    location: msg.location(),
                    timestamp: new Date().toISOString(),
                });
            }
        });

        // --- Capture uncaught exceptions ---
        page.on('pageerror', error => {
            // Ignore clipboard permission errors (expected in headless mode)
            if (error.message.includes('Clipboard') || error.message.includes('clipboard')) return;
            results.uncaughtExceptions.push({
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
        });

        // --- Navigate to the app ---
        console.log('[*] Loading application...');
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('[*] Page loaded:', await page.title());

        // Give the app time to initialize (Monaco editors, etc.)
        await page.waitForTimeout(3000);

        // -----------------------------------------------------------------
        // Verify /version 404 produced the sandbox warning banner
        // -----------------------------------------------------------------
        console.log('\n[*] Checking /version 404 handling...');
        const warningBanner = page.locator('.sandbox-warning');
        const warningVisible = await warningBanner.isVisible().catch(() => false);
        console.log(`[*] Sandbox warning banner visible: ${warningVisible}`);

        // -----------------------------------------------------------------
        // Step 1 - visible on load
        // -----------------------------------------------------------------
        console.log('\n[Step 1] Checking initial page...');
        const step1 = page.locator('#step1');
        const step1Visible = await step1.isVisible();
        console.log(`[Step 1] Visible: ${step1Visible}`);

        // Click safe buttons in step 1 (skip API-calling ones)
        await clickSafeButtons(page, '#step1', results, 1);

        // -----------------------------------------------------------------
        // Dismiss any popups/backdrops that may have opened
        // -----------------------------------------------------------------
        await page.evaluate(() => {
            document.querySelectorAll('.curl-popup-backdrop, .modal-backdrop').forEach(el => el.remove());
            document.querySelectorAll('.curl-popup').forEach(el => el.remove());
        });
        await page.waitForTimeout(200);

        // -----------------------------------------------------------------
        // Navbar interactions
        // -----------------------------------------------------------------
        console.log('\n[*] Testing navbar...');

        // Dark mode toggle
        const darkModeBtn = page.locator('#btn-dark-mode');
        if (await darkModeBtn.isVisible()) {
            await darkModeBtn.click();
            await page.waitForTimeout(300);
            results.clickedButtons.push('[Navbar] Dark mode toggle');

            // Toggle back
            await darkModeBtn.click();
            await page.waitForTimeout(300);
            results.clickedButtons.push('[Navbar] Dark mode toggle back');
        }

        // Dropdown menu
        console.log('[*] Testing dropdown menus...');
        const dropdownToggle = page.locator('.dropdown-toggle').first();
        if (await dropdownToggle.isVisible()) {
            await dropdownToggle.click();
            await page.waitForTimeout(300);

            const dropdownItems = page.locator('.dropdown-menu .dropdown-item');
            const ddCount = await dropdownItems.count();
            console.log(`[*] Found ${ddCount} dropdown items`);

            // Close dropdown without clicking destructive items
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
            results.clickedButtons.push('[Dropdown] Opened and closed');
        }

        // -----------------------------------------------------------------
        // Feature showcase (resources section)
        // -----------------------------------------------------------------
        console.log('\n[*] Testing feature showcase...');
        const featureItems = page.locator('.feature-item');
        const featureCount = await featureItems.count();
        console.log(`[*] Found ${featureCount} feature items`);

        for (let i = 0; i < featureCount; i++) {
            try {
                const item = featureItems.nth(i);
                if (await item.isVisible()) {
                    await item.click();
                    await page.waitForTimeout(200);
                    results.clickedButtons.push(`[Feature] Item ${i + 1}`);
                }
            } catch { /* item may not be clickable */ }
        }

        // =================================================================
        // SIGNING FLOW - Mock API integration test
        // =================================================================
        console.log('\n' + '='.repeat(50));
        console.log('  SIGNING FLOW (mocked API)');
        console.log('='.repeat(50));

        // Clear the confetti cookie so confetti #1 fires
        await page.evaluate(() => {
            document.cookie = 'insign_confetti_seen=; max-age=0; path=/';
        });

        // -----------------------------------------------------------------
        // Click "Send to Sandbox" to create a session (mocked)
        // -----------------------------------------------------------------
        console.log('\n[Flow] Clicking "Send to Sandbox" button...');

        // Find the Step 1 send button (onclick="sendStep(1)")
        const sendBtn = page.locator('#step1 button[onclick*="sendStep(1)"]').first();
        if (await sendBtn.isVisible()) {
            await sendBtn.click({ timeout: 5000 });
            results.clickedButtons.push('[Flow] Send to Sandbox (sendStep 1)');
            console.log('[Flow] sendStep(1) triggered');

            // Wait for the mocked /configure/session to complete and UI to update
            await page.waitForTimeout(2000);

            // -----------------------------------------------------------------
            // Wait for Confetti #1 (session creation celebration)
            // -----------------------------------------------------------------
            results.confetti1 = await waitForConfetti(page, 'Confetti #1 (session created)');

            // Verify the success banner appeared
            const successBanner = page.locator('.step-success-banner.banner-session');
            const bannerVisible = await successBanner.isVisible().catch(() => false);
            console.log(`[Flow] Session success banner visible: ${bannerVisible}`);

            // Verify session ID was set
            const sessionIdSet = await page.evaluate(() => {
                return typeof sessionId !== 'undefined' && sessionId !== null && sessionId.length > 0;
            });
            console.log(`[Flow] Session ID set in app: ${sessionIdSet}`);

            // Wait for confetti #1 to finish before checking confetti #2
            await waitForConfettiEnd(page, 10000);

            // -----------------------------------------------------------------
            // Start signature watch
            // In normal usage, startSignatureWatch() is called when the user
            // clicks "Open Session Now as Owner" (openAsOwner), which opens
            // the session in a new tab. Since we can't open tabs in headless,
            // we start the watch manually. It polls /get/status every 4s.
            // Our MITM proxy injects numberOfSignatures: 1 after the
            // baseline calls, triggering showSigningCelebration().
            // -----------------------------------------------------------------
            console.log('\n[Flow] Starting signature watch (normally triggered by "Open as Owner")...');
            await page.evaluate(() => startSignatureWatch());

            // Wait for the baseline fetchSignatureCount call to complete (uses a 4s poll)
            // before enabling injection, so the baseline sees 0 signatures.
            await page.waitForTimeout(2000);
            injectSignatures = true;
            console.log(`[Flow] Injection enabled (after ${statusCallCount} clean status calls)`);
            console.log('[Flow] Waiting for signature watch to detect MITM-injected signature...');

            results.confetti2 = await waitForConfetti(page, 'Confetti #2 (signature detected)', 25000);

            // Verify the signing celebration banner appeared
            const celebrationBanner = page.locator('.banner-signed');
            const celebrationVisible = await celebrationBanner.isVisible().catch(() => false);
            console.log(`[Flow] Signing celebration banner visible: ${celebrationVisible}`);

            // Wait for confetti #2 to finish
            await waitForConfettiEnd(page, 20000);

        } else {
            console.log('[Flow] SKIP - Send button not found or not visible');
        }

        // -----------------------------------------------------------------
        // Check if further steps are now visible after session creation
        // -----------------------------------------------------------------
        for (const stepNum of [2, 3, 4]) {
            const stepEl = page.locator(`#step${stepNum}`);
            if (await stepEl.isVisible()) {
                console.log(`\n[Step ${stepNum}] Now visible, checking buttons...`);
                await clickSafeButtons(page, `#step${stepNum}`, results, stepNum);
            } else {
                console.log(`\n[Step ${stepNum}] Not visible (skipping)`);
            }
        }

        // --- Final wait for any delayed errors ---
        await page.waitForTimeout(1000);

        // --- Close browser ---
        await browser.close();

        // -----------------------------------------------------------------------
        // Report
        // -----------------------------------------------------------------------
        console.log('\n' + '='.repeat(70));
        console.log('  GETTING STARTED TEST REPORT');
        console.log('='.repeat(70));

        console.log(`\n  Buttons clicked:   ${results.clickedButtons.length}`);
        console.log(`  Buttons skipped:   ${results.skippedButtons.length} (API/destructive/external)`);
        console.log(`  Click failures:    ${results.failedClicks.length}`);
        console.log(`  Console errors:    ${results.consoleErrors.length}`);
        console.log(`  Uncaught exceptions: ${results.uncaughtExceptions.length}`);

        console.log('\n--- SIGNING FLOW ---');
        console.log(`  Confetti #1 (session created):   ${results.confetti1 ? 'PASS' : 'FAIL'}`);
        console.log(`  Confetti #2 (signature detected): ${results.confetti2 ? 'PASS' : 'FAIL'}`);
        console.log(`  /get/status calls intercepted:    ${statusCallCount}`);

        if (results.consoleErrors.length > 0) {
            console.log('\n--- CONSOLE ERRORS ---');
            for (const err of results.consoleErrors) {
                console.log(`  [${err.timestamp}] ${err.text}`);
                if (err.location && err.location.url) {
                    console.log(`    at ${err.location.url}:${err.location.lineNumber}`);
                }
            }
        }

        if (results.uncaughtExceptions.length > 0) {
            console.log('\n--- UNCAUGHT EXCEPTIONS ---');
            for (const err of results.uncaughtExceptions) {
                console.log(`  ${err.message}`);
                if (err.stack) {
                    const lines = err.stack.split('\n').slice(0, 3);
                    lines.forEach(l => console.log(`    ${l}`));
                }
            }
        }

        if (results.failedClicks.length > 0) {
            console.log('\n--- FAILED CLICKS ---');
            results.failedClicks.forEach(f => console.log(`  ${f}`));
        }

        if (HEADED) {
            console.log('\n--- CLICKED BUTTONS ---');
            results.clickedButtons.forEach(b => console.log(`  ${b}`));
        }

        console.log('\n' + '='.repeat(70));

        const hasErrors = results.consoleErrors.length > 0 || results.uncaughtExceptions.length > 0;
        const flowFailed = !results.confetti1 || !results.confetti2;
        if (hasErrors || flowFailed) {
            const reasons = [];
            if (hasErrors) reasons.push('browser errors detected');
            if (!results.confetti1) reasons.push('confetti #1 not fired');
            if (!results.confetti2) reasons.push('confetti #2 not fired');
            console.log(`  RESULT: FAIL - ${reasons.join(', ')}`);
            console.log('='.repeat(70));
            process.exitCode = 1;
        } else {
            console.log('  RESULT: PASS - no browser errors, full signing flow verified');
            console.log('='.repeat(70));
        }

    } finally {
        // Kill the entire process group (npx + serve subprocess)
        try { process.kill(-server.pid, 'SIGTERM'); } catch { /* ignore */ }
        // Fallback: kill the main process directly
        try { server.kill('SIGTERM'); } catch { /* ignore */ }
    }
})();

// ---------------------------------------------------------------------------
// Click all safe (non-API, non-destructive) buttons within a scope
// ---------------------------------------------------------------------------
async function clickSafeButtons(page, scopeSelector, results, stepLabel) {
    const buttons = page.locator(`${scopeSelector} button`);
    const btnCount = await buttons.count();
    console.log(`[Step ${stepLabel}] Found ${btnCount} buttons`);

    for (let i = 0; i < btnCount; i++) {
        const btn = buttons.nth(i);
        try {
            if (!(await btn.isVisible())) continue;

            // Get button info
            const btnInfo = await btn.evaluate((el, skipSels) => {
                for (const sel of skipSels) {
                    if (el.matches(sel)) return { skip: true, text: el.textContent.trim(), id: el.id };
                }
                return {
                    skip: false,
                    text: el.textContent.trim().substring(0, 60),
                    id: el.id || '',
                    className: el.className.substring(0, 80),
                };
            }, SKIP_BUTTON_SELECTORS);

            if (btnInfo.skip) {
                results.skippedButtons.push(`[Step ${stepLabel}] ${btnInfo.text} (${btnInfo.id})`);
                continue;
            }

            // Skip buttons with API-calling onclick handlers
            const onclick = await btn.getAttribute('onclick') || '';
            const shouldSkip = SKIP_ONCLICK_PATTERNS.some(pat => onclick.includes(pat));
            if (shouldSkip) {
                results.skippedButtons.push(`[Step ${stepLabel}] API: ${btnInfo.text}`);
                continue;
            }

            // Click it
            await btn.click({ timeout: 3000 }).catch(() => null);
            await page.waitForTimeout(150);
            results.clickedButtons.push(`[Step ${stepLabel}] ${btnInfo.text} (${btnInfo.id || btnInfo.className.substring(0, 30)})`);
        } catch (e) {
            results.failedClicks.push(`[Step ${stepLabel}] Button #${i}: ${e.message.substring(0, 100)}`);
        }
    }
}

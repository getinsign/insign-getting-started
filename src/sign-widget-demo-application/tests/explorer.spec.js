const { test, expect } = require('@playwright/test');

test.describe('API Explorer', () => {

  // These tests share a single inSign session to minimize sandbox resource usage.
  let apiSessionKey;

  test('POST /api/session returns sessionKey, insignSessionId, jwt', async ({ request }) => {
    const response = await request.post('/api/session', {
      data: {
        firstName: 'API', lastName: 'Test',
        street: 'API-Strasse 1', zip: '12345',
        city: 'Teststadt', birthdate: '2000-01-01'
      }
    });

    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.sessionKey).toBeTruthy();
    expect(json.insignSessionId).toBeTruthy();
    expect(json.jwt).toBeTruthy();
    apiSessionKey = json.sessionKey;
  });

  test('POST /api/session rejects missing fields', async ({ request }) => {
    const response = await request.post('/api/session', {
      data: { firstName: 'Only' }
    });
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error.toLowerCase()).toContain('required');
  });

  test('GET /api/session/:key/status returns status', async ({ request }) => {
    expect(apiSessionKey).toBeTruthy();

    const statusRes = await request.get(`/api/session/${apiSessionKey}/status`);
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    expect(status.status).toBeTruthy();
  });

  test('GET /api/session/:key/document returns PDF', async ({ request }) => {
    expect(apiSessionKey).toBeTruthy();

    const docRes = await request.get(`/api/session/${apiSessionKey}/document`);
    if (docRes.ok()) {
      const contentType = docRes.headers()['content-type'];
      expect(contentType).toContain('application/pdf');
    }
  });

  test('Proxy - inSign scripts are accessible via /insign/', async ({ request }) => {
    const res = await request.get('/insign/js/insign-standalonesignature-pad.js');
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text.length).toBeGreaterThan(1000);
    expect(text).toContain('INSIGNAPP');
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

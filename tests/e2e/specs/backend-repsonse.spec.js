/**
 * Stack smoke tests — API-level health checks for Caddy + Nextcloud
 *
 * These tests use Playwright's `request` fixture (no browser needed) to assert
 * that the full Docker stack is wired up correctly:
 *
 *   1. Nextcloud is reachable through Caddy over HTTPS and reports installed
 *   2. Unauthenticated WebDAV access is correctly rejected (401)
 *   3. Authenticated PROPFIND returns 207 Multi-Status
 *   4. Caddy returns the correct CORS headers for the draw.io origin
 *
 * IMPORTANT: These tests require the full Docker Compose stack to be running.
 * They are skipped unless running in CI or locally with INTEGRATION=1.
 *
 * Why Playwright request instead of curl?
 *   curl in ci.yml only blocks until a port responds — it never asserts body
 *   content, authentication behaviour, or response headers.  These tests make
 *   those assertions explicit and reportable.
 */

const { test, expect } = require('@playwright/test');

const NC_URL        = process.env.NEXTCLOUD_URL  || 'https://localhost';
const NC_USER       = process.env.NEXTCLOUD_ADMIN_USER || 'admin';
const NC_PASS       = process.env.NEXTCLOUD_ADMIN_PASSWORD || 'change_me_admin_password';
const DRAWIO_ORIGIN = process.env.DRAWIO_URL     || 'https://localhost:5443';

const AUTH_HEADER = `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64')}`;
const DAV_ROOT    = `${NC_URL}/remote.php/dav/files/${NC_USER}/`;

// Caddy uses a locally-generated certificate — ignore TLS errors for all
// requests in this file (equivalent to curl -k).
test.use({ ignoreHTTPSErrors: true });

// Skip every test in this file unless the full stack is running.
test.beforeEach(() => {
  test.skip(
    !process.env.CI && !process.env.INTEGRATION,
    'Skipped locally — run with INTEGRATION=1 or in CI'
  );
});

// ── 1. Nextcloud reachability ─────────────────────────────────────────────────

test.describe('Nextcloud health (via Caddy HTTPS)', () => {
  test('GET /status.php returns 200 and reports installed:true', async ({ request }) => {
    const response = await request.get(`${NC_URL}/status.php`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.installed).toBe(true);
  });
});

// ── 2. WebDAV authentication ──────────────────────────────────────────────────

test.describe('WebDAV authentication', () => {
  test('unauthenticated PROPFIND is rejected with 401', async ({ request }) => {
    const response = await request.fetch(DAV_ROOT, {
      method: 'PROPFIND',
      headers: { Depth: '0' },
    });

    expect(response.status()).toBe(401);
  });

  test('PROPFIND with valid credentials returns 207 Multi-Status', async ({ request }) => {
    const response = await request.fetch(DAV_ROOT, {
      method: 'PROPFIND',
      headers: {
        Authorization: AUTH_HEADER,
        Depth: '0',
      },
    });

    expect(response.status()).toBe(207);
  });
});

// ── 3. CORS preflight (Caddy configuration) ───────────────────────────────────

test.describe('CORS preflight for draw.io origin', () => {
  test('OPTIONS preflight returns 204 with correct Allow-Origin header', async ({ request }) => {
    const response = await request.fetch(DAV_ROOT, {
      method: 'OPTIONS',
      headers: {
        Origin: DRAWIO_ORIGIN,
        'Access-Control-Request-Method': 'PROPFIND',
        'Access-Control-Request-Headers': 'Authorization, Depth',
      },
    });

    expect(response.status()).toBe(204);
    expect(response.headers()['access-control-allow-origin']).toBe(DRAWIO_ORIGIN);
    expect(response.headers()['access-control-allow-methods']).toMatch(/PROPFIND/i);
  });

  test('OPTIONS preflight includes Access-Control-Allow-Credentials: true', async ({ request }) => {
    const response = await request.fetch(DAV_ROOT, {
      method: 'OPTIONS',
      headers: {
        Origin: DRAWIO_ORIGIN,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });

    expect(response.headers()['access-control-allow-credentials']).toBe('true');
  });
});

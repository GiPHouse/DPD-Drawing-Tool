/**
 * Nextcloud integration suite — full-stack round-trips
 * ====================================================
 *
 * These tests need the WHOLE dev stack running (draw.io + Nextcloud + Caddy)
 * and therefore actually talk to Nextcloud over WebDAV / OCS. They are SKIPPED
 * by default so the everyday `npx playwright test` run stays under a minute;
 * enable them with INTEGRATION=1 (or in CI).
 *
 *   # one-time setup
 *   cp .env.example .env
 *   bash start.sh
 *
 *   # run the round-trips
 *   cd tests/e2e
 *   INTEGRATION=1 npx playwright test specs/nextcloud-integration.spec.js
 *
 * Feature → test map
 * ------------------
 *   Infra   — Nextcloud reachable + WebDAV auth + CORS for the draw.io origin
 *   Save    — file written and confirmed on Nextcloud (WebDAV HEAD 200)
 *   Load    — saved file appears in My Files and loads onto the canvas
 *   Delete  — file removed and confirmed gone (WebDAV HEAD 404)
 *   Share   — Sharing tab renders for a selected file ("Share with people")
 *   Version — Versions tab renders for a selected file
 */

'use strict';

const { test, expect } = require('@playwright/test');
const {
  NC_URL, NC_USER, NC_PASS, NC_DAV_URL,
  loadApp, closeDialogs, clickFileMenuAction, injectNextcloudSession,
} = require('../helpers');

test.use({ ignoreHTTPSErrors: true });

// Skip the whole file unless the full stack is running.
test.beforeEach(() => {
  test.skip(
    !process.env.CI && !process.env.INTEGRATION,
    'Skipped locally — run with INTEGRATION=1 or in CI'
  );
});

const AUTH = `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64')}`;

// ── Local round-trip helpers (kept here so the fast suite stays dependency-free) ─

/** Save the current diagram to Nextcloud under <name> (name may omit .drawio). */
async function saveAs(page, name) {
  await injectNextcloudSession(page);
  await closeDialogs(page);
  await clickFileMenuAction(page, /^save$/i);
  await page.getByText('Save diagram to Nextcloud').waitFor({ state: 'visible', timeout: 10_000 });

  // Wait for the session banner to settle into its "Connected as" state BEFORE
  // interacting. The banner resolves the session asynchronously and re-renders
  // the dialog when it does; filling/clicking before then detaches the Save
  // button mid-action. Once "Connected as" shows, the dialog is stable.
  await page.locator('text=/connected as/i').waitFor({ state: 'visible', timeout: 10_000 });

  await page.locator('input[placeholder="my-diagram"]').fill(name.replace(/\.drawio$/i, ''));
  await page.locator('button.gePrimaryBtn', { hasText: /^save diagram$/i }).first().click();
  await page.waitForTimeout(3_000); // allow the WebDAV PUT to complete
}

/** Open My Files, click the row for <name>, wait for the detail tabs. */
async function selectInMyFiles(page, name) {
  const base = name.endsWith('.drawio') ? name : `${name}.drawio`;
  await injectNextcloudSession(page);
  await closeDialogs(page);
  await clickFileMenuAction(page, /^my\s*files$/i);
  await page.locator('text=.drawio only').waitFor({ state: 'visible', timeout: 20_000 });
  // Each file row is a <div> containing a <span> whose text is the filename.
  // Click the span — the click bubbles to the row's onclick (selectFile), which
  // reveals the detail panel. Clicking an ancestor div would NOT select it.
  const nameSpan = page
    .locator('.geDialog:visible span')
    .filter({ hasText: base })
    .first();
  await nameSpan.waitFor({ state: 'visible', timeout: 10_000 });
  await nameSpan.click();
  await page.locator('button[data-tab-id="sharing"]').waitFor({ state: 'visible', timeout: 8_000 });
}

// ── Infra ───────────────────────────────────────────────────────────────────

test('Nextcloud is reachable and reports installed:true', async ({ request }) => {
  const res = await request.get(`${NC_URL}/status.php`);
  expect(res.status()).toBe(200);
  expect((await res.json()).installed).toBe(true);
});

test('WebDAV rejects anonymous access and accepts valid credentials', async ({ request }) => {
  const anon = await request.fetch(NC_DAV_URL, { method: 'PROPFIND', headers: { Depth: '0' } });
  expect(anon.status()).toBe(401);

  const auth = await request.fetch(NC_DAV_URL, {
    method: 'PROPFIND',
    headers: { Authorization: AUTH, Depth: '0' },
  });
  expect(auth.status()).toBe(207);
});

test('Caddy returns CORS headers for the draw.io origin', async ({ request }) => {
  const origin = process.env.DRAWIO_URL || 'https://localhost:5443';
  const res = await request.fetch(NC_DAV_URL, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'PROPFIND',
      'Access-Control-Request-Headers': 'Authorization, Depth',
    },
  });
  expect(res.status()).toBe(204);
  expect(res.headers()['access-control-allow-origin']).toBe(origin);
  expect(res.headers()['access-control-allow-credentials']).toBe('true');
});

// ── Save ──────────────────────────────────────────────────────────────────────

test('Save writes the diagram to Nextcloud (WebDAV HEAD 200)', async ({ page, request }) => {
  test.setTimeout(90_000);
  const name = `e2e-save-${Date.now()}.drawio`;
  await loadApp(page);
  await saveAs(page, name);

  const res = await request.head(`${NC_DAV_URL}${name}`, { headers: { Authorization: AUTH } });
  expect(res.status()).toBe(200);
});

// ── Load ────────────────────────────────────────────────────────────────────

test('A saved file appears in My Files and loads onto the canvas', async ({ page }) => {
  test.setTimeout(90_000);
  const name = `e2e-load-${Date.now()}.drawio`;
  await loadApp(page);
  await saveAs(page, name);
  await selectInMyFiles(page, name);

  await page.locator('.geDialog:visible button').filter({ hasText: /load diagram/i }).first().click();
  await expect(page.locator('.geEditor')).toBeVisible({ timeout: 10_000 });
});

// ── Delete ──────────────────────────────────────────────────────────────────

test('Delete removes the file from Nextcloud (WebDAV HEAD 404)', async ({ page, request }) => {
  test.setTimeout(90_000);
  const name = `e2e-del-${Date.now()}.drawio`;
  await loadApp(page);
  await saveAs(page, name);
  await selectInMyFiles(page, name);

  // Click the bottom-row Delete, then confirm in draw.io's confirm() dialog.
  await page.locator('.geDialog:visible button').filter({ hasText: /^delete$/i }).first().click();
  await page.getByText(/from Nextcloud\?/i).waitFor({ state: 'visible', timeout: 8_000 });
  // The confirm dialog's action button is also labelled "Delete"; it is the
  // last such button now that the confirm dialog is on top.
  await page.locator('.geDialog:visible button').filter({ hasText: /^delete$/i }).last().click();

  // The WebDAV DELETE is async; poll the HEAD until the file is gone (404)
  // rather than asserting after a fixed wait.
  await expect
    .poll(
      async () =>
        (await request.head(`${NC_DAV_URL}${name}`, { headers: { Authorization: AUTH } })).status(),
      { timeout: 15_000 }
    )
    .toBe(404);
});

// ── Share ─────────────────────────────────────────────────────────────────────

test('Sharing tab renders for a selected file', async ({ page }) => {
  test.setTimeout(90_000);
  const name = `e2e-share-${Date.now()}.drawio`;
  await loadApp(page);
  await saveAs(page, name);
  await selectInMyFiles(page, name);

  // Sharing tab is active by default; its content confirms renderSharingPane ran.
  await expect(page.getByText('Share with people', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[placeholder="Search by name or email…"]')).toBeVisible();
});

// ── Version history ─────────────────────────────────────────────────────────

test('Versions tab renders for a selected file', async ({ page }) => {
  test.setTimeout(90_000);
  const name = `e2e-version-${Date.now()}.drawio`;
  await loadApp(page);
  await saveAs(page, name);
  await selectInMyFiles(page, name);

  const versionsTab = page.locator('button[data-tab-id="versions"]');
  await expect(versionsTab).toBeVisible({ timeout: 5_000 });
  await versionsTab.click();
});

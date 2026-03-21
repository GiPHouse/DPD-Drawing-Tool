/**
 * File operations E2E tests (Nextcloud integration)
 *
 * Covers Sprint 2 issues:
 *   #98   Create UI for saving files
 *   #99   Create UI for sharing files with others
 *   #100  Create a UI for loading files
 *   #107  Create UI for version control
 *   #108  Create UI for deleting a file
 *   #117  Deleting File from Nextcloud (Done)
 *
 * IMPORTANT: These tests require the full Docker Compose stack to be running
 * (draw.io on port 5500 + Nextcloud on https://localhost).
 *
 * In GitHub Actions this is handled by the `integration-tests` job in ci.yml,
 * which calls `docker compose up` before running this spec file.
 *
 * Set NEXTCLOUD_URL, NEXTCLOUD_USER, and NEXTCLOUD_PASS environment variables
 * to point to a test Nextcloud instance.
 */

const { test, expect } = require('@playwright/test');

const NC_URL  = process.env.NEXTCLOUD_URL  || 'https://localhost';
const NC_USER = process.env.NEXTCLOUD_USER || 'admin';
const NC_PASS = process.env.NEXTCLOUD_PASS || 'admin';

const TEST_FILENAME = `test-diagram-${Date.now()}.drawio`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadApp(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/');
  await page.waitForSelector('.geEditor', { timeout: 20_000 });
}

/**
 * Opens the Save File dialog in the app.
 * TODO: Update selector once issue #98 UI is merged — look for the actual
 *       save button / menu item in the custom NOLAI toolbar.
 */
async function openSaveDialog(page) {
  // Try the File menu first, then fall back to a direct button
  const fileMenu = page.locator('[data-testid="file-menu"], .geMenubar button').first();
  await fileMenu.click();
  await page.getByRole('menuitem', { name: /save/i }).first().click();
}

/**
 * Opens the Load File dialog in the app.
 * TODO: Update selector once issue #100 UI is merged.
 */
async function openLoadDialog(page) {
  const fileMenu = page.locator('[data-testid="file-menu"], .geMenubar button').first();
  await fileMenu.click();
  await page.getByRole('menuitem', { name: /open|load/i }).first().click();
}

// ── Save ─────────────────────────────────────────────────────────────────────

test.describe('Save file to Nextcloud', () => {
  test('save dialog opens when clicking Save', async ({ page }) => {
    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    await loadApp(page);
    await openSaveDialog(page);

    // TODO: Replace with the actual save dialog selector from issue #98
    const dialog = page.locator('[data-testid="save-dialog"], .geSaveDialog, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
  });

  test('diagram can be saved with a filename and appears in Nextcloud', async ({ page, request }) => {
    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    await loadApp(page);
    await openSaveDialog(page);

    // TODO: fill in the filename input and confirm save
    // const filenameInput = page.locator('[data-testid="save-filename-input"]');
    // await filenameInput.fill(TEST_FILENAME);
    // await page.getByRole('button', { name: /save/i }).click();

    test.skip(true, 'Awaiting issue #98 — Save UI implementation');

    // Verify the file exists in Nextcloud via WebDAV
    const response = await request.head(
      `${NC_URL}/remote.php/dav/files/${NC_USER}/${TEST_FILENAME}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64')}`,
        },
        ignoreHTTPSErrors: true,
      }
    );
    expect(response.status()).toBe(200);
  });
});

// ── Load ─────────────────────────────────────────────────────────────────────

test.describe('Load file from Nextcloud', () => {
  test('load dialog opens when clicking Open', async ({ page }) => {
    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    await loadApp(page);
    await openLoadDialog(page);

    // TODO: Replace with the actual load dialog selector from issue #100
    const dialog = page.locator('[data-testid="load-dialog"], .geLoadDialog, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
  });

  test('a previously saved file appears in the load dialog', async ({ page }) => {
    test.skip(true, 'Awaiting issue #100 — Load UI implementation');
    // TODO: pre-upload a fixture .drawio file via WebDAV, then assert it appears in the list
  });
});

// ── Delete ────────────────────────────────────────────────────────────────────

test.describe('Delete file from Nextcloud', () => {
  test('delete button removes the file from the file list', async ({ page }) => {
    test.skip(true, 'Awaiting issue #108 — Delete UI implementation');
    // TODO: upload fixture file, open delete dialog, confirm deletion,
    //       then verify the file is gone (404 via WebDAV)
  });

  test('deleting a file shows a confirmation prompt before proceeding', async ({ page }) => {
    test.skip(true, 'Awaiting issue #108 — Delete UI implementation');
    // TODO: open the delete dialog and assert a confirmation step exists
  });
});

// ── Version control ───────────────────────────────────────────────────────────

test.describe('Version control UI', () => {
  test('version history dialog opens and lists saved versions', async ({ page }) => {
    test.skip(true, 'Awaiting issue #107 — Version control UI implementation');
    // TODO: save a file twice with different content, open version history,
    //       assert both versions are listed with timestamps
  });

  test('restoring an older version reverts the canvas content', async ({ page }) => {
    test.skip(true, 'Awaiting issue #107 — Version control UI implementation');
  });
});

// ── Share ─────────────────────────────────────────────────────────────────────

test.describe('Share file with others', () => {
  test('share dialog opens and allows entering a recipient', async ({ page }) => {
    test.skip(true, 'Awaiting issue #99 — Share UI implementation');
    // TODO: open share dialog, type a username, assert the sharing invite is created
  });
});

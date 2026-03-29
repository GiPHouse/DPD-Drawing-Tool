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
  await page.goto('/?atlas=1');
  await page.waitForSelector('#geInfo', { state: 'detached', timeout: 60_000 });
}

async function runEditorAction(page, actionName) {
  return page.evaluate((name) => {
    const candidates = [];

    const addCandidate = (obj) => {
      if (obj != null) {
        candidates.push(obj);
      }
    };

    addCandidate(window.ui);
    addCandidate(window.editorUi);
    addCandidate(window.app);

    for (const key of Object.getOwnPropertyNames(window)) {
      try {
        addCandidate(window[key]);
      } catch (e) {
        // Ignore globals with throwing getters.
      }
    }

    for (const candidate of candidates) {
      const maybeUi = candidate && candidate.actions ? candidate : candidate && candidate.editorUi;

      if (maybeUi && maybeUi.actions && typeof maybeUi.actions.get === 'function') {
        const action = maybeUi.actions.get(name);

        if (action && typeof action.funct === 'function') {
          action.funct();
          return true;
        }
      }
    }

    return false;
  }, actionName);
}

async function clickFileMenuAction(page, actionLabelRegex) {
  const fileMenu = page
    .locator('a.geItem, button.geItem, .geMenubar a, .geMenubar button')
    .filter({ hasText: /^file$/i })
    .first();

  await fileMenu.click();

  const popup = page.locator('.mxPopupMenu').last();
  await expect(popup).toBeVisible({ timeout: 10_000 });

  const actionItem = popup
    .locator('.mxPopupMenuItem, tr, td, a, div')
    .filter({ hasText: actionLabelRegex })
    .first();

  await actionItem.click();
}

async function openDialogViaActionOrMenu(page, actionName, menuRegex) {
  const executed = await runEditorAction(page, actionName);

  if (!executed) {
    await clickFileMenuAction(page, menuRegex);
  }
}

async function fillNextcloudDialog(page, filename) {
  await page.locator('tr', { hasText: 'Nextcloud Base URL:' }).locator('input').fill(NC_URL);
  await page.locator('tr', { hasText: 'Username:' }).locator('input').fill(NC_USER);
  await page.locator('tr', { hasText: 'Password:' }).locator('input').fill(NC_PASS);
  await page.locator('tr', { hasText: 'Remote Path:' }).locator('input').fill('');

  if (filename != null) {
    await page.locator('tr', { hasText: 'Filename:' }).locator('input').fill(filename);
  }
}

async function waitForFileOnNextcloud(request, filename, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  const encodedUser = encodeURIComponent(NC_USER);
  const encodedFile = encodeURIComponent(filename);
  const fileUrl = `${NC_URL}/remote.php/dav/files/${encodedUser}/${encodedFile}`;

  while (Date.now() < deadline) {
    const response = await request.fetch(fileUrl, {
      method: 'HEAD',
      headers: {
        Authorization: `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64')}`,
      },
      ignoreHTTPSErrors: true,
    });

    if (response.status() === 200) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${filename} to appear in Nextcloud`);
}

async function uploadFixtureDrawio(request, filename) {
  const encodedUser = encodeURIComponent(NC_USER);
  const encodedFile = encodeURIComponent(filename);
  const fileUrl = `${NC_URL}/remote.php/dav/files/${encodedUser}/${encodedFile}`;
  const xml = '<mxfile host="app.diagrams.net"><diagram id="test" name="Page-1"><mxGraphModel/></diagram></mxfile>';

  const response = await request.fetch(fileUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64')}`,
      'Content-Type': 'application/xml; charset=utf-8',
    },
    data: xml,
    ignoreHTTPSErrors: true,
  });

  expect([201, 204]).toContain(response.status());
}

/**
 * Opens the Save File dialog in the app.
 * TODO: Update selector once issue #98 UI is merged — look for the actual
 *       save button / menu item in the custom NOLAI toolbar.
 */
async function openSaveDialog(page) {
  await openDialogViaActionOrMenu(page, 'saveToNextcloud', /save\s*to\s*nextcloud|saveToNextcloud/i);
}

/**
 * Opens the Load File dialog in the app.
 * TODO: Update selector once issue #100 UI is merged.
 */
async function openLoadDialog(page) {
  await openDialogViaActionOrMenu(page, 'My Files', /my\s*files/i);
}

// ── Save ─────────────────────────────────────────────────────────────────────

test.describe('Save file to Nextcloud', () => {
  test('save dialog opens when clicking Save', async ({ page }) => {
    await loadApp(page);
    await openSaveDialog(page);

    await expect(page.getByText('Save diagram to Nextcloud')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('tr', { hasText: 'Filename:' }).locator('input')).toBeVisible();
  });

  test('diagram can be saved with a filename and appears in Nextcloud', async ({ page, request }) => {
    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    await loadApp(page);
    await openSaveDialog(page);

    await fillNextcloudDialog(page, TEST_FILENAME);

    await page.locator('button.gePrimaryBtn').filter({ hasText: /^ok$/i }).click();
    await waitForFileOnNextcloud(request, TEST_FILENAME);
  });
});

// ── Load ─────────────────────────────────────────────────────────────────────

test.describe('Load file from Nextcloud', () => {
  test('load dialog opens when clicking Open', async ({ page }) => {
    await loadApp(page);
    await openLoadDialog(page);

    await expect(page.getByText('Load diagram from Nextcloud')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('tr', { hasText: 'Nextcloud Base URL:' }).locator('input')).toBeVisible();
  });

  test('a previously saved file appears in the load dialog', async ({ page, request }) => {
    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    const fixtureName = `load-fixture-${Date.now()}.drawio`;
    await uploadFixtureDrawio(request, fixtureName);

    await loadApp(page);
    await openLoadDialog(page);
    await fillNextcloudDialog(page, null);

    await page.locator('button.gePrimaryBtn').filter({ hasText: /^ok$/i }).click();
    await expect(page.getByText('Select a .drawio file to load')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('select option', { hasText: fixtureName })).toBeVisible();
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

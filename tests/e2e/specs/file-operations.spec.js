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
const NC_DAV_URL = process.env.NEXTCLOUD_DAV_URL ||
  (NC_URL.includes('/remote.php/dav/')
    ? NC_URL
    : `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/`);

const TEST_FILENAME = `test-diagram-${Date.now()}.drawio`;

// Nextcloud runs behind Caddy with a local/self-signed certificate in CI.
// Browser-side fetches from draw.io -> https://localhost must ignore TLS errors.
test.use({ ignoreHTTPSErrors: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadApp(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/?atlas=1');
  await page.waitForSelector('#geInfo', { state: 'detached', timeout: 60_000 });
}

async function clickFileMenuAction(page, actionLabelRegex) {
  const fileMenu = page
    .locator('a.geItem, button.geItem, .geMenubar a, .geMenubar button')
    .filter({ hasText: /^file$/i })
    .first();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await fileMenu.click({ force: true, timeout: 4_000 });

      const popup = page.locator('.mxPopupMenu').last();
      await expect(popup).toBeVisible({ timeout: 6_000 });

      const actionItem = popup
        .locator('.mxPopupMenuItem, tr, td, a, div')
        .filter({ hasText: actionLabelRegex })
        .first();

      await actionItem.click({ force: true, timeout: 4_000 });
      return;
    } catch {
      await closeDialogs(page);
      await page.waitForTimeout(400);
    }
  }

  throw new Error(`Could not click File menu action matching ${actionLabelRegex}`);
}

async function waitVisible(locator, timeoutMs) {
  try {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function fillNextcloudDialog(page, filename) {
  const filled = await page.evaluate(({ url, user, pass, remotePath, name }) => {
    const dialogs = Array.from(document.querySelectorAll('.geDialog'));
    let activeDialog = null;

    for (let i = dialogs.length - 1; i >= 0; i -= 1) {
      const dlg = dialogs[i];
      if (dlg.offsetParent !== null) {
        activeDialog = dlg;
        break;
      }
    }

    if (activeDialog == null) {
      return false;
    }

    const fillByPlaceholder = (placeholder, value) => {
      const input = activeDialog.querySelector(`input[placeholder="${placeholder}"]`);

      if (!input) {
        return false;
      }

      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };

    const baseFilled =
      fillByPlaceholder('Enter WebDAV URL', url) &&
      fillByPlaceholder('Nextcloud username', user) &&
      fillByPlaceholder('Nextcloud password', pass) &&
      fillByPlaceholder('e.g. /Diagrams', remotePath);

    if (!baseFilled) {
      return false;
    }

    if (name != null) {
      return fillByPlaceholder('file.drawio', name);
    }

    return true;
  }, {
    url: NC_DAV_URL,
    user: NC_USER,
    pass: NC_PASS,
    remotePath: '',
    name: filename,
  });

  if (!filled) {
    throw new Error('Could not fill fields in active Nextcloud dialog');
  }
}

async function openMyFilesList(page) {
  await closeDialogs(page);
  await openLoadDialog(page);
  await fillNextcloudDialog(page, null);
  await clickTopmostOkButton(page);

  const listTitle = page.getByText('Select a .drawio file to load');
  const listTitleAlt = page.getByText('Select a diagram');
  const emptyMessage = page.getByText('No .drawio files found in Nextcloud.');

  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (
      await listTitle.isVisible().catch(() => false) ||
      await listTitleAlt.isVisible().catch(() => false)
    ) {
      return 'list';
    }

    if (await emptyMessage.isVisible().catch(() => false)) {
      return 'empty';
    }

    await page.waitForTimeout(250);
  }

  const visibleText = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('.geDialog')).filter((el) => el.offsetParent !== null);
    return dialogs.map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ');
  });

  throw new Error(`My Files result dialog did not appear. Visible dialog text: ${visibleText}`);
}

async function closeDialogs(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

async function clickTopmostOkButton(page) {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button.gePrimaryBtn'));

    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      const btn = buttons[i];
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      const text = (btn.textContent || '').trim();

      const visible = rect.width > 0 && rect.height > 0 &&
        style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

      if (visible && /^(save diagram|ok|open|fetch files)$/i.test(text)) {
        btn.click();
        return true;
      }
    }

    return false;
  });

  if (!clicked) {
    throw new Error('Unable to click topmost OK button in dialog');
  }
}

async function assertFileAppearsInMyFiles(page, filename, maxAttempts = 12) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = await openMyFilesList(page);

    if (state === 'empty') {
      await closeDialogs(page);
      await page.waitForTimeout(1500);
      continue;
    }

    const option = page.locator('select option', { hasText: filename }).first();

    if (await option.count() > 0) {
      await expect(option).toBeVisible({ timeout: 5_000 });
      return;
    }

    await closeDialogs(page);
    await page.waitForTimeout(2000);
  }

  const visibleText = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('.geDialog')).filter((el) => el.offsetParent !== null);
    return dialogs.map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ');
  });

  throw new Error(`File ${filename} did not appear in My Files list. Visible dialog text: ${visibleText}`);
}

/**
 * Opens the Save File dialog in the app.
 * TODO: Update selector once issue #98 UI is merged — look for the actual
 *       save button / menu item in the custom NOLAI toolbar.
 */
async function openSaveDialog(page) {
  const title = page.getByRole('heading', { name: /save diagram to nextcloud/i });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await closeDialogs(page);
    await clickFileMenuAction(page, /^save/i);

    if (await waitVisible(title, 4_000)) {
      return;
    }
  }

  throw new Error('Could not open Save Diagram to Nextcloud dialog');
}

/**
 * Opens the Load File dialog in the app.
 * TODO: Update selector once issue #100 UI is merged.
 */
async function openLoadDialog(page) {
  const title = page.getByRole('heading', { name: /load diagram from nextcloud/i });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await closeDialogs(page);
    await clickFileMenuAction(page, /^myfiles$|my\s*files/i);

    if (await waitVisible(title, 4_000)) {
      return;
    }
  }

  throw new Error('Could not open Load diagram from Nextcloud dialog');
}

async function openDeleteConfirmDialog(page, filename) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await openLoadDialog(page);
    await fillNextcloudDialog(page, null);
    await clickTopmostOkButton(page);

    const select = page.locator('.geDialog:visible select').last();
    await expect(select).toBeVisible({ timeout: 10_000});

    const options = await select.locator('option').allTextContents();
  
    if (options.includes(filename)) {
      await select.selectOption({ label: filename });
      const deleteBtn = page.locator('.geDialog:visible button').filter({ hasText: /^delete$/i }).first();
      await deleteBtn.click();
      return;
    }
    
    await closeDialogs(page);
    await page.waitForTimeout(2000);
  }

  throw new Error (`Timeout: File ${filename} never appeared in the list.`);
}

async function clickConfirmDeleteButton(page) {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button.gePrimaryBtn, .geDialog button'));
    for (let i = buttons.length - 1; i >= 0; i-=1) {
      const btn = buttons[i];
      const text = (btn.textContent || '').trim();
      if (/^delete$/i.test(text) && btn.offsetParent != null) {
        btn.click();
        return true;
      }
    }
    return false
  });
  if (!clicked) throw new Error('Could not click the confirmation Delete button');
}

// ── Save ─────────────────────────────────────────────────────────────────────

test.describe('Save file to Nextcloud', () => {
  test('save dialog opens when clicking Save', async ({ page }) => {
    await loadApp(page);
    await openSaveDialog(page);

    const saveDialog = page.locator('.geDialog:visible').last();
    await expect(saveDialog.getByRole('heading', { name: /save diagram to nextcloud/i })).toBeVisible({ timeout: 10_000 });
    await expect(saveDialog.locator('input[placeholder="file.drawio"]')).toBeVisible();
  });

  test('diagram can be saved with a filename and appears in Nextcloud', async ({ page }) => {
    test.setTimeout(90_000);

    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    await loadApp(page);
    await openSaveDialog(page);

    await fillNextcloudDialog(page, TEST_FILENAME);

    await clickTopmostOkButton(page);
    await assertFileAppearsInMyFiles(page, TEST_FILENAME);
  });
});

// ── Load ─────────────────────────────────────────────────────────────────────

test.describe('Load file from Nextcloud', () => {
  test('load dialog opens when clicking Open', async ({ page }) => {
    await loadApp(page);
    await openLoadDialog(page);

    const loadDialog = page.locator('.geDialog:visible').last();
    await expect(loadDialog.getByRole('heading', { name: /load diagram from nextcloud/i })).toBeVisible({ timeout: 10_000 });
    await expect(loadDialog.locator('input[placeholder="Nextcloud username"]')).toBeVisible();
  });

  test('a previously saved file appears in the load dialog', async ({ page }) => {
    test.setTimeout(90_000);

    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    const fixtureName = `load-fixture-${Date.now()}.drawio`;

    await loadApp(page);
    await openSaveDialog(page);
    await fillNextcloudDialog(page, fixtureName);
    await clickTopmostOkButton(page);
    await assertFileAppearsInMyFiles(page, fixtureName);
  });
});

// ── Delete ────────────────────────────────────────────────────────────────────

test.describe('Delete file from Nextcloud', () => {
  test('delete button removes the file from the file list', async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    const deleteFixture = `delete-test-${Date.now()}.drawio`;

    await loadApp(page);
    await openSaveDialog(page);
    await fillNextcloudDialog(page, deleteFixture);
    await clickTopmostOkButton(page);
    await assertFileAppearsInMyFiles(page, deleteFixture);
    await closeDialogs(page);

    await openDeleteConfirmDialog(page, deleteFixture);
    await clickConfirmDeleteButton(page);

    const option = page.locator('.geDialog:visible select option', {hasText: deleteFixture });
    await expect(option).not.toBeVisible({ timeout: 5_000 });
  });

  test('deleting a file shows a confirmation prompt before proceeding', async ({ page }) => {
    // test.skip(true, 'Awaiting issue #108 — Delete UI implementation');
    test.skip(
      !process.env.CI && !process.env.INTEGRATION,
      'Skipped locally — run with INTEGRATION=1 or in CI'
    );

    const filename = `confirm-test-${Date.now()}.drawio`;

    await loadApp(page);
    await openSaveDialog(page);
    await fillNextcloudDialog(page, filename);
    await clickTopmostOkButton(page);
    await closeDialogs(page);

    await openDeleteConfirmDialog(page, filename);

    const confirmDialog = page.locator('.geDialog:visible').last();
    await expect(confirmDialog).toContainText(/are you sure you want to delete/i);
    await expect(confirmDialog).toContainText(filename);

    await page.keyboard.press('Escape');
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

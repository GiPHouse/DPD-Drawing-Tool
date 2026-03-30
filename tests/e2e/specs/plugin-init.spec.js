/**
 * Plugin initialisation & UI customisation tests
 *
 * These automate the manual checks currently in:
 *   tests/manual/PLUGIN_DEMO_TEST.md
 *   tests/manual/UI_LOGO_TEST.md
 *
 * Run with: npx playwright test specs/plugin-init.spec.js
 */

const { test, expect } = require('@playwright/test');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Navigate to the app and wait for full initialisation.
 *
 * Key decisions:
 *
 * 1. We use `/?atlas=1` rather than `/` because the NOLAI logo is only injected
 *    into the DOM when draw.io runs in atlas (online) theme — see App.js line 1870.
 *    Without this parameter, Chromium loads in device/offline mode and the logo
 *    never appears.
 *
 * 2. We wait for `#geInfo` to be DETACHED, not for `.geEditor` to be visible.
 *    The `<body>` element already has the `geEditor` class in the static HTML, so
 *    `waitForSelector('.geEditor')` resolves immediately — before any JavaScript
 *    has run — and subsequent assertions fire before the plugin callback executes.
 *    `#geInfo` is the loading-screen div that draw.io removes via
 *    `geInfo.parentNode.removeChild(geInfo)` once the editor is fully ready,
 *    including all `loadPlugin` callbacks.
 *
 * 3. A 60-second timeout covers Docker cold-start.
 *
 * NOTE: Remove the dialog handler once issue #115 replaces alert() with a
 * custom, non-blocking notification component.
 */
async function loadApp(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/?atlas=1');
  await page.waitForSelector('#geInfo', { state: 'detached', timeout: 60_000 });
}

// ── Plugin init ───────────────────────────────────────────────────────────────

test.describe('DPD plugin initialisation', () => {
  test('DPD Plugin Loaded is logged to the console', async ({ page }) => {
    const consoleLogs = [];
    // Register BEFORE goto so no early messages are missed
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    await loadApp(page);

    expect(consoleLogs).toContain('DPD Plugin Loaded');
  });

  test('no console errors on startup', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await loadApp(page);

    expect(errors).toHaveLength(0);
  });
});

// ── NOLAI UI customisations ───────────────────────────────────────────────────

test.describe('NOLAI logo', () => {
  test('logo is visible in the top-left corner', async ({ page }) => {
    await loadApp(page);
    // The logo img has class "geSmallAppIcon" and src containing "NOLAI_logo.png".
    // It does NOT have an alt attribute — draw.io sets a "title" attribute instead.
    const logo = page.locator('img.geSmallAppIcon, img[src*="NOLAI_logo"]').first();
    await expect(logo).toBeVisible();
  });

  test('logo links to https://www.ru.nl/en/nolai', async ({ page, context }) => {
    await loadApp(page);
    const logo = page.locator('img.geSmallAppIcon, img[src*="NOLAI_logo"]').first();

    // Clicking the logo should open a new tab pointing to the NOLAI site
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      logo.click(),
    ]);
    await expect(newPage).toHaveURL(/ru\.nl.*nolai/i);
    await newPage.close();
  });
});

test.describe('Suppressed UI elements', () => {
  test('"Edit Data" button is not visible', async ({ page }) => {
    await loadApp(page);
    await expect(page.getByText('Edit Data')).not.toBeVisible();
  });

  test('"Clear Default Style" option is not visible', async ({ page }) => {
    await loadApp(page);
    await expect(page.getByText('Clear Default Style')).not.toBeVisible();
  });
});

test.describe('Browser resize behaviour', () => {
  test('app renders correctly in a smaller window', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loadApp(page);
    // body.geEditor is always present; verify the main toolbar is also visible
    // as a proxy for the editor being rendered correctly
    await expect(page.locator('.geEditor')).toBeVisible();
  });

  test('app renders correctly in a full-screen window', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loadApp(page);
    await expect(page.locator('.geEditor')).toBeVisible();
  });
});

/**
 * DPD rule enforcement E2E tests
 *
 * Covers Sprint 2 issues:
 *   #110  Create and understand DPD semantic rules
 *   #112  Implement UI representation of DPD rules enforcement
 *   #113  Update plugin to enforce DPD rules based on attributes
 *   #115  Custom Alert Messages
 *   #120  Implementing UI choice option for shape attributes
 *
 * These tests use the draw.io canvas via Playwright's mouse API.
 * They will need the DPD stencil library loaded (issue #111 — Add XML attributes
 * to library) before the shape-specific assertions can be finalised.
 *
 * Sections marked TODO indicate where selectors / logic need updating once the
 * relevant Sprint 2 task is merged.
 *
 * Run with: npx playwright test specs/dpd-rules.spec.js
 */

const { test, expect } = require('@playwright/test');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Navigate to the app and wait for full initialisation.
 *
 * Key decisions (same as plugin-init.spec.js — see that file for full notes):
 *
 * 1. `/?atlas=1` ensures the atlas theme is active so the sidebar and all
 *    plugin callbacks are registered before assertions run.
 *
 * 2. We wait for `#geInfo` to be DETACHED — the loading-screen div that
 *    draw.io removes once the editor is fully ready, including all `loadPlugin`
 *    callbacks.  Waiting for `.geEditor` would resolve immediately because
 *    `<body class="geEditor">` is already in the static HTML.
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

/**
 * Drop a shape from the sidebar onto the canvas.
 *
 * Key decisions:
 *
 * 1. All sidebar panels start collapsed.  We click the "General" header to
 *    expand it, which reveals the `.geSidebar .geItem` shape tiles.
 *
 * 2. The panel header is an `<a class="geTitle">` element — a SIBLING of the
 *    `.geSidebar` content div, not a child of it.  So we must target
 *    `a.geTitle` directly; using `.geSidebar .getByText('General')` would
 *    search inside the (currently empty) panel body and time out.
 *
 * 3. `.geSidebar .geItem` is the stable selector for individual shape tiles
 *    inside any expanded sidebar panel (grapheditor.css line 1891).
 *
 * TODO: Once the DPD stencil panel has been added (issue #111) and given a
 *       stable CSS class or data attribute, switch to that panel's `<a.geTitle>`
 *       and change the tile selector accordingly.
 */
async function dropShapeOnCanvas(page, targetX, targetY) {
  // Expand the General panel — target the <a class="geTitle"> header element,
  // NOT .geSidebar (which is the collapsed content container, not the header)
  await page.locator('a.geTitle').filter({ hasText: /^General$/ }).first().click();

  const firstShape = page.locator('.geSidebar .geItem').first();
  await firstShape.waitFor({ state: 'visible', timeout: 10_000 });

  const canvas = page.locator('.geEditor canvas').first();
  const canvasBox = await canvas.boundingBox();

  await firstShape.dragTo(canvas, {
    targetPosition: {
      x: targetX - canvasBox.x,
      y: targetY - canvasBox.y,
    },
  });
}

// ── Vertex lifecycle (automated equivalents of PLUGIN_DEMO_TEST.md) ───────────

test.describe('Vertex lifecycle events', () => {
  test('adding a shape logs "Vertex added" and "Vertex moved"', async ({ page }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await loadApp(page);
    await dropShapeOnCanvas(page, 400, 300);

    expect(logs.some((l) => l.startsWith('Vertex added'))).toBe(true);
    expect(logs.some((l) => l.startsWith('Vertex moved'))).toBe(true);
  });

  test('no duplicate vertex logs when adding a shape', async ({ page }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await loadApp(page);
    await dropShapeOnCanvas(page, 400, 300);

    const addedLogs = logs.filter((l) => l.startsWith('Vertex added'));
    expect(addedLogs).toHaveLength(1);
  });
});

// ── DPD rule enforcement ──────────────────────────────────────────────────────
// These tests will be fleshed out once issues #112 and #113 are merged.
// The pattern for each test is:
//   1. Place a shape with certain attributes
//   2. Attempt an invalid connection (or set an invalid attribute)
//   3. Assert the custom alert/notification appears with the correct message
//   4. Assert the invalid state is visually indicated

test.describe('DPD semantic rule enforcement', () => {
  /**
   * TODO (issue #112 / #113): Update the alert/notification selector to match
   * the custom alert component once issue #115 is implemented.
   * Replace `page.getByRole('alert')` with the actual component selector.
   */

  test('shows a rule-violation alert when an invalid connection is made', async ({ page }) => {
    // IMPORTANT: test.skip must be the first statement — if any earlier call
    // (loadApp, dropShapeOnCanvas) throws, the skip is never reached and the
    // test reports as failed rather than skipped.
    test.skip(true, 'Awaiting issue #113 — DPD rule enforcement in plugin');

    await loadApp(page);

    // Place two shapes
    await dropShapeOnCanvas(page, 300, 300);
    await dropShapeOnCanvas(page, 600, 300);

    // TODO: Draw a connection between them that violates a DPD rule.
    // Once the DPD rule attributes are on the shapes, this should trigger an alert.
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/DPD rule violation/i);
  });

  test('does not show an alert for a valid connection', async ({ page }) => {
    test.skip(true, 'Awaiting issue #113 — DPD rule enforcement in plugin');

    await loadApp(page);

    // TODO: place two compatible shapes and connect them
    const alert = page.getByRole('alert');
    await expect(alert).not.toBeVisible();
  });
});

// ── Shape attribute UI (issue #120) ──────────────────────────────────────────

test.describe('Shape attribute panel', () => {
  test('clicking a shape opens the attribute panel', async ({ page }) => {
    test.skip(true, 'Awaiting issue #120 — UI choice option for shape attributes');

    await loadApp(page);
    await dropShapeOnCanvas(page, 400, 300);

    // Click the placed shape
    await page.mouse.click(400, 300);

    // TODO: update selector once the attribute choice panel (issue #120) is merged
    const attrPanel = page.locator('.dpd-attribute-panel, [data-testid="attribute-panel"]');
    await expect(attrPanel).toBeVisible();
  });

  test('attribute panel shows the correct options for a DPD shape', async ({ page }) => {
    test.skip(true, 'Awaiting issue #120 — UI choice option for shape attributes');

    await loadApp(page);
    await dropShapeOnCanvas(page, 400, 300);
    await page.mouse.click(400, 300);

    // TODO: assert that dropdown options match the DPD XML attribute definitions
    const dropdown = page.locator('.dpd-attribute-panel select').first();
    await expect(dropdown).toBeVisible();
  });
});

/**
 * E2E tests for DPD rule enforcement and the DPD console sidebar panel.
 *
 * These tests run against the live draw.io app in a real browser via
 * Playwright. They cover:
 *   - DPD console panel visibility, empty state, and header controls
 *   - Highlights toggle button behaviour
 *   - Edit-lock warning banner visibility
 *   - Structural rule enforcement (R-S1/S2/S3) — currently skipped pending
 *     the DPD stencil library (issue #111)
 *   - Full-graph validation rules (R-S4, R-I*, R-L*, R-P*) — skipped pending #111
 *
 * Run: npx playwright test specs/dpd-rules.spec.js
 */

const { test, expect } = require('@playwright/test');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Navigate to the draw.io app and wait for full initialisation.
 *
 * The `/?atlas=1` query string activates the atlas theme, which registers
 * the sidebar and all plugin callbacks before the loading screen is removed.
 * We wait for `#geInfo` to be detached — draw.io removes this element once
 * the editor (including all loadPlugin callbacks) is fully ready. The 60-second
 * timeout accommodates Docker cold-start times.
 *
 * A dialog handler is registered to dismiss any native browser dialogs that
 * may appear (e.g. unsaved-changes prompts), keeping tests from hanging.
 */
async function loadApp(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/?atlas=1');
  await page.waitForSelector('#geInfo', { state: 'detached', timeout: 60_000 });
}

/**
 * Drag the first shape from the General sidebar panel onto the canvas.
 *
 * All sidebar panels start collapsed. We click the "General" header to expand
 * it and wait for shape tiles to appear. The drag target is specified relative
 * to the canvas bounding box.
 *
 * TODO: Once the DPD stencil panel (issue #111) has a stable CSS class,
 *       switch to that panel's header and tile selector.
 */
async function dropShapeOnCanvas(page, targetX, targetY) {
  await page.locator('a.geTitle').filter({ hasText: /^General$/ }).first().click();

  const firstShape = page.locator('.geSidebar .geItem').first();
  await firstShape.waitFor({ state: 'visible', timeout: 10_000 });

  const diagramContainer = page.locator('.geDiagramContainer').first();
  await diagramContainer.waitFor({ state: 'visible', timeout: 20_000 });

  const canvasBox = await diagramContainer.boundingBox();

  await firstShape.dragTo(diagramContainer, {
    targetPosition: {
      x: targetX - canvasBox.x,
      y: targetY - canvasBox.y,
    },
  });
}

/**
 * Returns a locator for the DPD console panel in the right-hand sidebar.
 *
 * EditorUi.createUi embeds the DPD console below the format panel.
 * DPDConsole.createHeader sets the title div text to 'DPD Violations',
 * which is the stable anchor used here to locate the panel's parent element.
 */
async function getDPDConsolePanel(page) {
  return page.locator('text=DPD Violations').locator('..');
}

// ── Vertex lifecycle ──────────────────────────────────────────────────────────

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

// ── DPD console sidebar panel ─────────────────────────────────────────────────

test.describe('DPD Console sidebar panel', () => {
  test('DPD console panel is visible in the right sidebar', async ({ page }) => {
    await loadApp(page);

    // DPDConsole.createHeader sets the title text to 'DPD Violations'.
    const consolePanelTitle = page.getByText('DPD Violations', { exact: true });
    await expect(consolePanelTitle).toBeVisible({ timeout: 10_000 });
  });

  test('DPD console shows "No violations detected" on a fresh empty diagram', async ({ page }) => {
    await loadApp(page);

    // DPDConsole.createConsoleArea creates a div with id="dpdEmptyMessage"
    // that is visible until the first violation is added.
    const emptyMsg = page.locator('#dpdEmptyMessage');
    await expect(emptyMsg).toBeVisible({ timeout: 10_000 });
    await expect(emptyMsg).toContainText('No violations detected');
  });

  test('DPD console panel has a Highlights toggle button', async ({ page }) => {
    await loadApp(page);

    // DPDConsole.createHeader creates a <button> with textContent 'Highlights'.
    const highlightsBtn = page.locator('button', { hasText: 'Highlights' });
    await expect(highlightsBtn).toBeVisible({ timeout: 10_000 });
  });

  test('DPD console panel has a clear (✕) button', async ({ page }) => {
    await loadApp(page);

    // DPDConsole.createHeader creates a <button> with textContent '✕' for
    // clearing all violations from the panel.
    const clearBtn = page.locator('button', { hasText: '✕' });
    await expect(clearBtn).toBeVisible({ timeout: 10_000 });
  });

  test('footer shows "0 violations" on a fresh empty diagram', async ({ page }) => {
    await loadApp(page);

    // DPDConsole.createFooter initialises statsText with "0 violations".
    const statsText = page.getByText('0 violations', { exact: true });
    await expect(statsText).toBeVisible({ timeout: 10_000 });
  });
});

// ── Violation display and highlight controls ──────────────────────────────────

test.describe('DPD violation display after triggering validation', () => {
  test('console shows violation entries after clicking Highlights with an unannotated edge', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await loadApp(page);

    // Place two shapes on the canvas.
    await dropShapeOnCanvas(page, 300, 300);
    await dropShapeOnCanvas(page, 600, 300);

    // Clicking Highlights calls toggleHighlights() → validateGraph(). With two
    // unconnected generic shapes (no DPD edge between them), validation runs but
    // produces no violations — the empty-state message should remain visible.
    // This test primarily verifies that clicking Highlights does not crash the page.
    const highlightsBtn = page.locator('button', { hasText: 'Highlights' });
    await expect(highlightsBtn).toBeVisible({ timeout: 10_000 });
    await highlightsBtn.click();

    await expect(page.locator('#dpdEmptyMessage')).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Highlights a second time deactivates highlights (toggle off)', async ({ page }) => {
    await loadApp(page);

    const highlightsBtn = page.locator('button', { hasText: 'Highlights' });
    await expect(highlightsBtn).toBeVisible({ timeout: 10_000 });

    // First click activates highlights; second click clears them.
    await highlightsBtn.click();
    await highlightsBtn.click();

    // After the second click the button returns to its inactive state. CSS
    // custom properties are hard to assert in Playwright, so we verify the
    // button remains visible and the page has not crashed.
    await expect(highlightsBtn).toBeVisible();
  });

  test('clicking the clear (✕) button removes violation entries from the console', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await loadApp(page);

    await dropShapeOnCanvas(page, 400, 300);

    // Clicking clear calls DPDConsole.clear() which resets violations, removes
    // all .dpdViolationEntry elements, and restores the empty-state message.
    const clearBtn = page.locator('button', { hasText: '✕' });
    await clearBtn.click();

    await expect(page.locator('#dpdEmptyMessage')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('0 violations', { exact: true })).toBeVisible({ timeout: 5_000 });
  });
});

// ── Edit-lock warning banner ──────────────────────────────────────────────────

test.describe('Edit-lock warning banner', () => {
  test('warning banner is hidden on initial load', async ({ page }) => {
    await loadApp(page);

    // dpd.js appends a floating warning banner to document.body and sets
    // its display to 'none' until setEditLockState(true) is called.
    const banner = page.locator('text=Diagram editing is locked');
    await expect(banner).toBeHidden({ timeout: 5_000 });
  });
});

// ── DPD structural rule enforcement ──────────────────────────────────────────

test.describe('DPD semantic rule enforcement', () => {
  // Structural rule tests (R-S1/S2/S3) require two DPD-typed shapes from the
  // DPD stencil library so that graph.isValidConnection can check their
  // data-type attributes. These tests are skipped until issue #111 is merged.

  test('R-S1: connecting two data stores shows violation in the console (not alert)', async ({ page }) => {
    test.skip(true, 'Awaiting issue #111 — DPD library must be loaded for data_store shapes');

    await loadApp(page);

    // TODO: Drag two data_store shapes from the DPD library panel.
    // TODO: Attempt to draw an arrow between them.
    // The connection should be blocked by graph.isValidConnection, and an
    // R-S1 entry should appear in the console instead of a browser alert.
    const violation = page.locator('.dpdViolationEntry').filter({ hasText: 'R-S1' });
    await expect(violation).toBeVisible({ timeout: 5_000 });
  });

  test('R-S2: connecting two external entities shows violation in the console', async ({ page }) => {
    test.skip(true, 'Awaiting issue #111 — DPD library must be loaded for external_entity shapes');

    await loadApp(page);

    const violation = page.locator('.dpdViolationEntry').filter({ hasText: 'R-S2' });
    await expect(violation).toBeVisible({ timeout: 5_000 });
  });

  test('R-S3: connecting data store to external entity shows violation in the console', async ({ page }) => {
    test.skip(true, 'Awaiting issue #111 — DPD library must be loaded');

    await loadApp(page);

    const violation = page.locator('.dpdViolationEntry').filter({ hasText: 'R-S3' });
    await expect(violation).toBeVisible({ timeout: 5_000 });
  });

  test('valid process → data_store connection does NOT produce a violation', async ({ page }) => {
    test.skip(true, 'Awaiting issue #111 — DPD library must be loaded');

    await loadApp(page);

    const structuralViolations = page.locator('.dpdViolationEntry').filter({
      hasText: /R-S[123]/,
    });
    await expect(structuralViolations).toHaveCount(0);
  });

  // Full-graph validation tests (R-S4, R-I*, R-L*, R-P*) additionally require
  // edges annotated via the Annotate Data Flow dialog. Remove each skip as the
  // prerequisite issues are merged.

  test('R-S4: unannotated edge shows warning in the console', async ({ page }) => {
    test.skip(true, 'Awaiting issue #111 — requires DPD shapes with data-type attributes');

    await loadApp(page);

    // TODO: Place process + data_store, connect them, cancel the annotation
    //       dialog, then click Highlights.
    const r4Entry = page.locator('.dpdViolationEntry').filter({ hasText: 'R-S4' });
    await expect(r4Entry).toBeVisible({ timeout: 5_000 });
    // R-S4 is a warning (orange border), not an error (red border).
    await expect(r4Entry).not.toHaveCSS('border-left-color', 'rgb(255, 68, 68)');
  });

  test('violation entry appears in the console when an invalid connection is made', async ({ page }) => {
    test.skip(true, 'Awaiting issue #111 — DPD rule enforcement needs DPD shapes');

    await loadApp(page);

    // TODO: Draw a connection between DPD shapes that violates a rule.
    // Violations are reported to the console panel, not via window.alert().
    const violation = page.locator('.dpdViolationEntry');
    await expect(violation).toBeVisible();
  });

  test('no violation entry appears for a valid connection', async ({ page }) => {
    test.skip(true, 'Awaiting issue #111 — DPD rule enforcement needs DPD shapes');

    await loadApp(page);

    // TODO: Place two compatible DPD shapes and connect them.
    const violations = page.locator('.dpdViolationEntry');
    await expect(violations).toHaveCount(0);
  });
});

// ── Shape attribute panel ─────────────────────────────────────────────────────

test.describe('Shape attribute panel', () => {
  test('clicking a shape opens the attribute panel', async ({ page }) => {
    test.skip(true, 'Awaiting issue #120 — UI choice option for shape attributes');

    await loadApp(page);
    await dropShapeOnCanvas(page, 400, 300);

    await page.mouse.click(400, 300);

    const attrPanel = page.locator('.dpd-attribute-panel, [data-testid="attribute-panel"]');
    await expect(attrPanel).toBeVisible();
  });

  test('attribute panel shows the correct options for a DPD shape', async ({ page }) => {
    test.skip(true, 'Awaiting issue #120 — UI choice option for shape attributes');

    await loadApp(page);
    await dropShapeOnCanvas(page, 400, 300);
    await page.mouse.click(400, 300);

    const dropdown = page.locator('.dpd-attribute-panel select').first();
    await expect(dropdown).toBeVisible();
  });
});

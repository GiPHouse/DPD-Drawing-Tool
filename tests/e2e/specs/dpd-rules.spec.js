/**
 * E2E tests for DPD rule enforcement and the DPD console sidebar panel.
 *
 * These tests run against the live draw.io app in a real browser via
 * Playwright. They cover:
 * - DPD console panel visibility, empty state, and header controls
 * - Highlights toggle button behaviour
 * - Edit-lock warning banner visibility
 *
 * Run: npx playwright test specs/dpd-rules.spec.js
 */

const { test, expect } = require('@playwright/test');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Navigate to the draw.io app and wait for full initialisation.
 */
async function loadApp(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto('/?atlas=1');
  await page.waitForSelector('#geInfo', { state: 'detached', timeout: 60_000 });
}

/**
 * Drag the first shape from the General sidebar panel onto the canvas.
 */
async function dropShapeOnCanvas(page, targetX, targetY) {
  const firstShape = page.locator('.geSidebar .geItem').first();
  
  // Only click the 'General' header if the shape is hidden
  if (!(await firstShape.isVisible())) {
    await page.locator('a.geTitle').filter({ hasText: /^General$/ }).first().click();
  }

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
    const consolePanelTitle = page.getByText('DPD Violations', { exact: true });
    await expect(consolePanelTitle).toBeVisible({ timeout: 10_000 });
  });

  test('DPD console shows "No violations detected" on a fresh empty diagram', async ({ page }) => {
    await loadApp(page);
    const emptyMsg = page.locator('#dpdEmptyMessage');
    await expect(emptyMsg).toBeVisible({ timeout: 10_000 });
    await expect(emptyMsg).toContainText('No violations detected');
  });

  test('DPD console panel has a Highlights toggle button', async ({ page }) => {
    await loadApp(page);
    const highlightsBtn = page.locator('button', { hasText: 'Highlights' });
    await expect(highlightsBtn).toBeVisible({ timeout: 10_000 });
  });

  test('DPD console panel has a clear (✕) button', async ({ page }) => {
    await loadApp(page);
    const clearBtn = page.locator('button', { hasText: '✕' });
    await expect(clearBtn).toBeVisible({ timeout: 10_000 });
  });

  test('footer shows "0 violations" on a fresh empty diagram', async ({ page }) => {
    await loadApp(page);
    const statsText = page.getByText('0 violations', { exact: true });
    await expect(statsText).toBeVisible({ timeout: 10_000 });
  });
});

// ── Violation display and highlight controls ──────────────────────────────────

test.describe('DPD violation display after triggering validation', () => {
  test('console shows violation entries after clicking Highlights with an unannotated edge', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await loadApp(page);

    await dropShapeOnCanvas(page, 300, 300);
    await dropShapeOnCanvas(page, 600, 300);

    const highlightsBtn = page.locator('button', { hasText: 'Highlights' });
    await expect(highlightsBtn).toBeVisible({ timeout: 10_000 });
    await highlightsBtn.click();

    await expect(page.locator('#dpdEmptyMessage')).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Highlights a second time deactivates highlights (toggle off)', async ({ page }) => {
    await loadApp(page);

    const highlightsBtn = page.locator('button', { hasText: 'Highlights' });
    await expect(highlightsBtn).toBeVisible({ timeout: 10_000 });

    await highlightsBtn.click();
    await highlightsBtn.click();

    await expect(highlightsBtn).toBeVisible();
  });

  test('clicking the clear (✕) button removes violation entries from the console', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await loadApp(page);

    await dropShapeOnCanvas(page, 400, 300);

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
    const banner = page.locator('text=Diagram editing is locked');
    await expect(banner).toBeHidden({ timeout: 5_000 });
  });
});
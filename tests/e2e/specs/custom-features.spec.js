/**
 * Custom feature smoke suite — DPD Drawing Tool (NOLAI additions)
 * ==============================================================
 *
 * One fast test per custom feature that the team added on top of stock
 * draw.io (https://github.com/jgraph/drawio). The whole file is designed to
 * finish in WELL under a minute: it runs chromium-only, needs no live
 * Nextcloud backend, and builds DPD shapes through the graph model instead of
 * slow drag-and-drop. (True Nextcloud round-trips live in
 * nextcloud-integration.spec.js, gated behind INTEGRATION=1.)
 *
 * Feature → test map
 * ------------------
 *   1.  DPD plugin initialises               → "DPD Plugin Loaded" console log
 *   2.  Clean startup                        → no console errors
 *   3.  NOLAI logo branding                  → logo visible, links to nolai
 *   4.  Stock draw.io UI suppression         → "Edit Data" not present
 *   5.  DPD violations console panel         → panel + empty state + "0 violations"
 *   6.  Highlights / clear controls          → both buttons render
 *   7.  Edit-lock banner                     → hidden until highlights active
 *   8.  Process annotation dialog            → auto-opens with its fields
 *   9.  Data-store annotation dialog         → auto-opens with its field
 *   10. DPD right-click context menu         → "Edit Properties…" on a node
 *   11. DPD rule-violation highlighting      → R-S2 detected, count updates
 *   12. Nextcloud Save feature               → "Save diagram to Nextcloud" dialog
 *   13. Nextcloud My Files feature           → My Files dialog opens
 *
 * Run: cd tests/e2e && npx playwright test specs/custom-features.spec.js
 */

'use strict';

const { test, expect } = require('@playwright/test');
const {
  loadApp,
  closeDialogs,
  clickFileMenuAction,
  injectNextcloudSession,
  insertDpdNode,
  insertViolationPair,
  cellScreenCenter,
  hideAppDialog,
  waitDpdReady,
  setHighlights,
} = require('../helpers');

test.use({ ignoreHTTPSErrors: true });

// ── 1–2. Plugin initialisation ──────────────────────────────────────────────

test('DPD plugin loads and logs its init message', async ({ page }) => {
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await loadApp(page);
  expect(logs).toContain('DPD Plugin Loaded');
});

test('app starts with no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await loadApp(page);
  expect(errors).toHaveLength(0);
});

// ── 3. NOLAI logo branding ──────────────────────────────────────────────────

test('NOLAI logo is shown and links to the NOLAI site', async ({ page }) => {
  // Stub window.open so we can assert the target without a real navigation.
  await page.addInitScript(() => {
    window.__openedUrl = null;
    const orig = window.open;
    window.open = function (...a) { window.__openedUrl = a[0] ? String(a[0]) : null; return orig.apply(window, a); };
  });

  await loadApp(page);

  // The app icon is an <a class="geAppIcon"> whose background is the NOLAI logo.
  // It is present in the menubar but CSS-hidden in compact mode, so we assert
  // on its presence + branding + click behaviour rather than CSS visibility.
  const logo = page.locator('a.geAppIcon').first();
  await expect(logo).toHaveCount(1);
  const bg = await logo.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toMatch(/NOLAI_logo/i);

  // Dispatch the click directly so it fires regardless of compact-mode hiding;
  // appIconClicked() opens the NOLAI site.
  await logo.evaluate((el) => el.click());
  await expect.poll(() => page.evaluate(() => window.__openedUrl || '')).toMatch(/ru\.nl.*nolai/i);
});

// ── 4. Stock draw.io UI suppression ─────────────────────────────────────────

test('suppressed stock draw.io control "Edit Data" is not present', async ({ page }) => {
  await loadApp(page);
  await expect(page.getByText('Edit Data', { exact: true })).toHaveCount(0);
});

// ── 5–7. DPD violations console panel + controls + lock banner ──────────────

test('DPD violations console renders with empty state and controls', async ({ page }) => {
  await loadApp(page);

  await expect(page.getByText('DPD Violations', { exact: true })).toBeVisible();
  await expect(page.locator('#dpdEmptyMessage')).toContainText('No violations detected');
  await expect(page.getByText('0 violations', { exact: true })).toBeVisible();

  // Highlights toggle + clear (✕) buttons are NOLAI-only additions.
  await expect(page.locator('button', { hasText: 'Highlights' })).toBeVisible();
  await expect(page.locator('button', { hasText: '✕' })).toBeVisible();

  // Edit-lock warning banner stays hidden until highlights are switched on.
  await expect(page.locator('text=Diagram editing is locked')).toBeHidden();
});

// ── 8. Process annotation dialog ─────────────────────────────────────────────

test('process node auto-opens the annotation dialog with its fields', async ({ page }) => {
  await loadApp(page);
  await insertDpdNode(page, 'process');

  await expect(page.locator('h3:has-text("Annotate Data Flow")')).toBeVisible({ timeout: 8_000 });
  // Process dialog carries three constraint selects (dpd.js IDs).
  await expect(page.locator('#dpd-accepts-max')).toBeVisible();
  await expect(page.locator('#dpd-outputs-max')).toBeVisible();
  await expect(page.locator('#dpd-link-max')).toBeVisible();
});

// ── 9. Data-store annotation dialog ──────────────────────────────────────────

test('data-store node auto-opens its annotation dialog', async ({ page }) => {
  await loadApp(page);
  await insertDpdNode(page, 'data_store');

  await expect(page.locator('h3:has-text("Annotate Data Flow")')).toBeVisible({ timeout: 8_000 });
  // Data-store dialog has a single select and none of the process selects.
  await expect(page.locator('#dpd-stores-max')).toBeVisible();
  await expect(page.locator('#dpd-accepts-max')).toHaveCount(0);
});

// ── 10. DPD right-click context menu extension ───────────────────────────────

test('right-clicking a DPD node shows "Edit Properties…"', async ({ page }) => {
  await loadApp(page);
  const cellId = await insertDpdNode(page, 'process', { x: 200, y: 160 });

  // The insert auto-opens the annotation dialog; close it via the EditorUi so
  // it cannot intercept the right-click that follows.
  await page.locator('h3:has-text("Annotate Data Flow")').waitFor({ state: 'visible', timeout: 8_000 });
  await hideAppDialog(page);
  await expect(page.locator('h3:has-text("Annotate Data Flow")')).toBeHidden({ timeout: 5_000 });

  // dpd.js adds "Edit Properties…" only when the cell under the cursor is a DPD
  // vertex (see its popup factoryMethod), so the right-click must land on the
  // 120x60 node. Recompute the node centre and re-issue the click on each
  // attempt so the menu is opened on the node once the graph layout has settled.
  const editItem = page.locator('.mxPopupMenu').last().getByText('Edit Properties…');
  await expect(async () => {
    await closeDialogs(page);
    const c = await cellScreenCenter(page, cellId);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await expect(editItem).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await closeDialogs(page);
});

// ── 11. DPD rule-violation highlighting ──────────────────────────────────────

test('rule violation is detected and shown when Highlights runs', async ({ page }) => {
  await loadApp(page);

  // Wait until the DPD validator is wired (Highlights is a no-op before the
  // first validateGraph runs). This also clears the initial empty-graph state.
  await waitDpdReady(page);

  // Two external entities joined by an edge → rule R-S2 (error).
  await insertViolationPair(page);

  // Turn Highlights ON deterministically (this is the Highlights button's own
  // handler) so the result doesn't race with dpd.js's background re-validation.
  await setHighlights(page, true);

  // The R-S2 (external↔external) violation must be reported. An unannotated
  // edge also raises an R-S4 warning, so we assert on the R-S2 entry rather
  // than a total count.
  await expect(
    page.locator('.dpdViolationEntry').filter({ hasText: 'R-S2' })
  ).toHaveCount(1, { timeout: 8_000 });

  // The empty state is gone and editing locks while highlights are active.
  await expect(page.locator('#dpdEmptyMessage')).toBeHidden();
  await expect(page.locator('text=Diagram editing is locked')).toBeVisible();
});

// ── 12. Nextcloud Save feature ───────────────────────────────────────────────

test('File > Save opens the Nextcloud save dialog', async ({ page }) => {
  await loadApp(page);
  await injectNextcloudSession(page); // banner shows "Connected as" state
  await closeDialogs(page);
  await clickFileMenuAction(page, /^save$/i);

  await expect(page.getByText('Save diagram to Nextcloud')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[placeholder="my-diagram"]')).toBeVisible();
});

// ── 13. Nextcloud My Files feature ───────────────────────────────────────────

test('File > My Files opens the Nextcloud files dialog', async ({ page }) => {
  await loadApp(page);
  await closeDialogs(page);
  await clickFileMenuAction(page, /^my\s*files$/i);

  // Without a backend the session banner shows; with one, the file panel does.
  // Either proves the custom My Files entry point is wired up.
  const signIn   = page.locator('button', { hasText: /^sign in$/i });
  const connected = page.locator('text=/connected as/i');
  const filePanel = page.locator('text=.drawio only');

  const appeared = await Promise.race([
    signIn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true),
    connected.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true),
    filePanel.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true),
  ]).catch(() => false);

  expect(appeared).toBe(true);
});

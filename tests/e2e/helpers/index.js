/**
 * Shared Playwright helpers for the DPD Drawing Tool E2E suite.
 * ============================================================
 *
 * This suite was rewritten from scratch (task199) to be MINIMAL and FAST:
 * the default run (specs/custom-features.spec.js) drives every custom NOLAI
 * feature through the UI in well under a minute, with no live Nextcloud
 * backend required. The slower true-round-trip checks live in
 * specs/nextcloud-integration.spec.js and are skipped unless INTEGRATION=1.
 *
 * DESIGN NOTES (why things are done this way)
 * -------------------------------------------
 *  - App URL is /?atlas=1. The "atlas" theme is required for the NOLAI logo
 *    and several plugin hooks to initialise (offline mode skips them).
 *  - The DPD plugin (plugins/dpd.js) is force-loaded by PreConfig.js
 *    (urlParams['p']='dpd'), so no plugin URL param is needed here.
 *  - We build DPD shapes via the live mxGraph model rather than drag-and-drop.
 *    Dragging sidebar shapes is slow and flaky; inserting a vertex through the
 *    graph API fires the exact same model CHANGE listener in dpd.js, so the
 *    auto-annotation dialogs and rule engine are exercised identically but
 *    deterministically. See captureUi() for how we reach the EditorUi.
 *
 * Environment overrides (defaults match .env.example dev stack):
 *    DRAWIO_URL                https://localhost:5443
 *    NEXTCLOUD_URL             https://localhost
 *    NEXTCLOUD_ADMIN_USER      admin
 *    NEXTCLOUD_ADMIN_PASSWORD  admin
 */

'use strict';

// ── Environment ───────────────────────────────────────────────────────────────

const NC_URL  = process.env.NEXTCLOUD_URL || 'https://localhost';
const NC_USER = process.env.NEXTCLOUD_ADMIN_USER || 'admin';
const NC_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || 'admin';

/** WebDAV root for the admin user (used by integration round-trip checks). */
const NC_DAV_URL =
  process.env.NEXTCLOUD_DAV_URL ||
  `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/`;

// ── App loading ───────────────────────────────────────────────────────────────

/**
 * Navigate to the draw.io app and wait until the plugin lifecycle has finished.
 *
 * We wait for #geInfo (the loading-screen element) to be DETACHED because
 * draw.io removes it only after every loadPlugin callback has run — that is the
 * earliest moment the DPD plugin's UI (violations console, logo, etc.) is
 * guaranteed to exist. Waiting on `.geEditor` would fire too early because that
 * class is present in the static HTML before any JS executes.
 *
 * The dialog handler dismisses the plugin's startup alert() (issue #115).
 */
async function loadApp(page) {
  page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto('/?atlas=1');
  await page.waitForSelector('#geInfo', { state: 'detached', timeout: 60_000 });
}

// ── EditorUi / graph access ─────────────────────────────────────────────────────

/**
 * Obtain a handle to the live EditorUi inside the page and stash it on
 * window.__ui for reuse by later in-page calls.
 *
 * HOW: after the app has loaded, draw.io rebinds window.Draw.loadPlugin to a
 * function that immediately invokes its callback with the EditorUi instance
 * (`callback(this)`). Calling it once more is a side-effect-free way to capture
 * `ui` without modifying any application code.
 */
async function captureUi(page) {
  await page.evaluate(() => {
    if (!window.__ui && window.Draw && typeof window.Draw.loadPlugin === 'function') {
      window.Draw.loadPlugin(function (ui) { window.__ui = ui; });
    }
  });
}

/**
 * Insert one DPD component vertex into the diagram via the graph model.
 *
 * The value is a UserObject element carrying data-type=<type>, exactly like the
 * shapes in the DPDS custom library. dpd.js's model CHANGE listener reacts to
 * the insert: for 'process' / 'data_store' it auto-opens the annotation dialog;
 * 'external_entity' inserts silently (no dialog) which is handy for rule tests.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'process'|'data_store'|'external_entity'} type
 * @param {{x?:number,y?:number,label?:string}} [opts]
 */
async function insertDpdNode(page, type, opts = {}) {
  await captureUi(page);
  return page.evaluate(
    ({ type, x, y, label }) => {
      const ui = window.__ui;
      const graph = ui.editor.graph;
      const model = graph.getModel();
      const parent = graph.getDefaultParent();
      const doc = mxUtils.createXmlDocument();
      const node = doc.createElement('UserObject');
      node.setAttribute('label', label || type);
      node.setAttribute('data-type', type);
      let cell;
      model.beginUpdate();
      try {
        cell = graph.insertVertex(parent, null, node, x, y, 120, 60);
      } finally {
        model.endUpdate();
      }
      return cell.id; // so callers can locate the rendered shape later
    },
    { type, x: opts.x ?? 80, y: opts.y ?? 80, label: opts.label }
  );
}

/**
 * Return the viewport-relative centre of a cell, mapping the mxGraph cell
 * state (content-pixel coords) through the diagram container's bounding rect
 * and scroll offset. Used to click/right-click a shape reliably regardless of
 * the graph's translate/scale.
 */
async function cellScreenCenter(page, cellId) {
  return page.evaluate((id) => {
    const graph = window.__ui.editor.graph;
    const model = graph.getModel();

    // Resolve the cell. The id from insertVertex can be null (draw.io may not
    // assign one until save), so fall back to the most recently added top-level
    // vertex — which is the node the caller just inserted.
    let cell = id != null ? model.getCell(id) : null;
    if (!cell) {
      const verts = graph.getChildVertices(graph.getDefaultParent());
      cell = verts[verts.length - 1];
    }

    graph.view.validate(); // best-effort: create render state when possible
    const r = graph.container.getBoundingClientRect();
    const sl = graph.container.scrollLeft;
    const st = graph.container.scrollTop;

    const state = graph.view.getState(cell);
    if (state && state.width) {
      return {
        x: r.left + state.x + state.width / 2 - sl,
        y: r.top + state.y + state.height / 2 - st,
      };
    }
    // Deterministic fallback: map geometry through view scale/translate. This
    // never depends on a render state existing.
    const geo = model.getGeometry(cell);
    const s = graph.view.scale;
    const t = graph.view.translate;
    return {
      x: r.left + (t.x + geo.x + geo.width / 2) * s - sl,
      y: r.top + (t.y + geo.y + geo.height / 2) * s - st,
    };
  }, cellId);
}

/**
 * Wait until the DPD validation subsystem is fully wired.
 *
 * The Highlights button's onToggleHighlights callback is null until the first
 * validateGraph() runs — which dpd.js schedules ~800 ms after load via its
 * root-change listener. Clicking Highlights before then is a silent no-op.
 * Calling this first makes Highlights-driven tests deterministic regardless of
 * machine load, and guarantees the initial (empty-graph) validation has
 * already happened so the console starts clean.
 */
async function waitDpdReady(page) {
  await captureUi(page);
  await page.waitForFunction(
    () =>
      window.__ui &&
      window.__ui.dpdConsole &&
      typeof window.__ui.dpdConsole.onToggleHighlights === 'function',
    null,
    { timeout: 15_000 }
  );
}

/**
 * Force the Highlights toggle to the desired state via the console's
 * onToggleHighlights callback — the exact handler the Highlights button's
 * onclick invokes.
 *
 * Why not just click the button: dpd.js re-runs validateGraph ~800 ms after
 * each root change during load, and one of those can flip highlights ON by
 * itself once a violation exists. A blind button click would then toggle it
 * back OFF. Reading the current toggle state (toggleBtn._active) and only
 * toggling when needed makes the end state deterministic regardless of those
 * background timers.
 */
async function setHighlights(page, on) {
  await captureUi(page);
  await page.evaluate((want) => {
    const c = window.__ui && window.__ui.dpdConsole;
    if (!c || typeof c.onToggleHighlights !== 'function') return;
    const active = !!(c.toggleBtn && c.toggleBtn._active);
    if (active !== want) c.onToggleHighlights();
  }, on);
}

/** Close any DPD annotation dialog through the EditorUi (reliable, scoped). */
async function hideAppDialog(page) {
  await page.evaluate(() => {
    if (window.__ui && typeof window.__ui.hideDialog === 'function') window.__ui.hideDialog();
  });
}

/**
 * Insert a structural rule violation: two external_entity vertices joined by an
 * edge. This trips rule R-S2 ("two external entities cannot connect directly").
 *
 * external_entity is chosen deliberately — it triggers a violation WITHOUT the
 * auto-annotation dialog that process/data_store nodes would pop, keeping the
 * test free of dialog interference before the Highlights validation runs.
 */
async function insertViolationPair(page) {
  await captureUi(page);
  const ok = await page.evaluate(() => {
    const ui = window.__ui;
    const graph = ui.editor.graph;
    const model = graph.getModel();
    const parent = graph.getDefaultParent();
    const doc = mxUtils.createXmlDocument();
    const mkNode = (label) => {
      const n = doc.createElement('UserObject');
      n.setAttribute('label', label);
      n.setAttribute('data-type', 'external_entity');
      return n;
    };
    // The edge value must be an element (not a bare string) so dpd.js helpers
    // such as getEdgeProps/addEdgeIcon can read attributes off it safely.
    const mkEdge = () => doc.createElement('UserObject');
    let edge;
    model.beginUpdate();
    try {
      const a = graph.insertVertex(parent, null, mkNode('A'), 60, 80, 120, 60);
      const b = graph.insertVertex(parent, null, mkNode('B'), 320, 80, 120, 60);
      edge = graph.insertEdge(parent, null, mkEdge(), a, b);
      // Belt-and-suspenders: guarantee terminals are bound, otherwise dpd.js's
      // structural check (`if (!src || !tgt) return;`) silently skips the edge.
      model.setTerminal(edge, a, true);
      model.setTerminal(edge, b, false);
    } finally {
      model.endUpdate();
    }
    return !!(model.getTerminal(edge, true) && model.getTerminal(edge, false));
  });
  if (!ok) throw new Error('insertViolationPair: edge terminals were not bound');
}

// ── Dialog / menu utilities ─────────────────────────────────────────────────────

/** Press Escape twice to dismiss any open dialog or popup menu. */
async function closeDialogs(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

/**
 * Open the draw.io File menu and click the item matching actionLabelRegex.
 * Tries role-based and class-based selectors, falling back to Alt+F, and
 * retries a few times because the menubar renders differently across themes.
 */
async function clickFileMenuAction(page, actionLabelRegex) {
  const fileMenuCandidates = [
    page.getByRole('menuitem', { name: /^file$/i }).first(),
    page.locator('.geMenubar a, .geMenubar div').filter({ hasText: /^file$/i }).first(),
  ];

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      let opened = false;
      for (const menu of fileMenuCandidates) {
        if (await menu.count().catch(() => 0)) {
          await menu.click({ force: true, timeout: 4_000 });
          opened = true;
          break;
        }
      }
      if (!opened) await page.keyboard.press('Alt+F').catch(() => {});

      const popup = page.locator('.mxPopupMenu').last();
      await popup.waitFor({ state: 'visible', timeout: 6_000 });

      const item = popup
        .locator('.mxPopupMenuItem, tr, td, a, div')
        .filter({ hasText: actionLabelRegex })
        .first();

      if (await item.count().catch(() => 0)) {
        await item.click({ force: true, timeout: 4_000 });
        return;
      }
    } catch {
      await closeDialogs(page);
      await page.waitForTimeout(300);
    }
  }
  throw new Error(`Could not click File menu action matching ${actionLabelRegex}`);
}

/**
 * Pre-populate the Nextcloud session cache so the dialogs' session banner
 * auto-authenticates instead of showing the Login Flow v2 popup.
 * Call BEFORE opening Save / My Files when you want the "Connected as" state.
 */
async function injectNextcloudSession(page) {
  await page.evaluate(
    ({ user, pass, url }) => {
      window._nextcloudSessionCache = window._nextcloudSessionCache || {};
      window._nextcloudSessionCache.username    = user;
      window._nextcloudSessionCache.password    = pass;
      window._nextcloudSessionCache.baseUrl     = url;
      window._nextcloudSessionCache.displayName = user;
    },
    { user: NC_USER, pass: NC_PASS, url: NC_URL }
  );
}

module.exports = {
  // env
  NC_URL, NC_USER, NC_PASS, NC_DAV_URL,
  // app + graph
  loadApp, captureUi, insertDpdNode, insertViolationPair,
  cellScreenCenter, hideAppDialog, waitDpdReady, setHighlights,
  // dialogs / menus
  closeDialogs, clickFileMenuAction, injectNextcloudSession,
};

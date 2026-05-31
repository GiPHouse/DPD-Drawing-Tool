# E2E tests — DPD Drawing Tool

Playwright end-to-end tests for the **custom NOLAI features** layered on top of
stock [draw.io](https://github.com/jgraph/drawio). The suite was rewritten from
scratch (task199) to be minimal and fast: the default run drives every custom
feature through the UI in **well under a minute**, with no live Nextcloud
backend required.

## Layout

| File | Purpose |
|------|---------|
| `specs/custom-features.spec.js` | **Fast suite** — one test per custom feature. Chromium-only, no backend. This is what `npm test` runs. |
| `specs/nextcloud-integration.spec.js` | **Full-stack round-trips** — real WebDAV/OCS save, load, delete, share, version + infra/CORS checks. Skipped unless `INTEGRATION=1`. |
| `helpers/index.js` | Shared helpers: app loading, graph-model shape insertion, File-menu and Nextcloud-session utilities. |
| `playwright.config.js` | Chromium by default; `CROSS_BROWSER=1` also runs Firefox. |

## Features covered (fast suite)

Each maps to exactly one test in `custom-features.spec.js`:

1. DPD plugin initialises (`DPD Plugin Loaded` console log)
2. Clean startup (no console errors)
3. NOLAI logo branding (visible, links to `ru.nl/en/nolai`)
4. Stock draw.io UI suppression (`Edit Data` removed)
5. DPD violations console panel (empty state + `0 violations`)
6. Highlights / clear controls render
7. Edit-lock banner hidden until highlights active
8. Process annotation dialog auto-opens with its fields
9. Data-store annotation dialog auto-opens with its field
10. DPD right-click context menu (`Edit Properties…`)
11. DPD rule-violation highlighting (R-S2 detected, count updates, editing locked)
12. Nextcloud **Save** dialog opens
13. Nextcloud **My Files** dialog opens

The backend-dependent features (real save/load/delete/share/version round-trips)
are verified end-to-end in `nextcloud-integration.spec.js`.

## How shapes are created (and why)

DPD shapes are inserted through the live `mxGraph` model rather than by dragging
sidebar items. A model insert fires the exact same `CHANGE` listener in
`plugins/dpd.js` that a drag does — so the auto-annotation dialogs and the rule
engine are exercised identically — but it is deterministic and fast.
`helpers/captureUi()` grabs the `EditorUi` by calling the post-load
`window.Draw.loadPlugin(cb)`, which invokes `cb(ui)` immediately. No application
code is modified.

The rule-violation test uses two `external_entity` nodes joined by an edge
(rule **R-S2**) precisely because external entities do *not* trigger an
auto-annotation dialog, keeping the test free of dialog interference before the
Highlights validation runs.

## Running

Requires the dev stack so the app is served at `https://localhost:5443`
(`bash start.sh` from the repo root). Then:

```bash
cd tests/e2e
npm install
npx playwright install --with-deps chromium

npm test               # fast suite (chromium, <1 min)
npm run test:integration   # add the full-stack round-trips (needs Nextcloud)
npm run test:all           # integration + Firefox (run `npx playwright install firefox` first)
npm run test:report        # open the last HTML report
```

### Scope notes

- **Cross-user file sharing is intentionally not automated.** Verifying a share
  end-to-end requires two Authentik accounts (sign in as user A, share to user
  B), which Playwright cannot drive in a single session. The integration suite
  covers the sharing *UI* (the Sharing tab + "Share with people" controls
  rendering for a selected file); the actual cross-account grant is left to
  manual testing.
- `test:all` also runs Firefox, which must be installed separately
  (`npx playwright install firefox`). The default/fast runs use Chromium only.

### Environment overrides (defaults match `.env.example`)

| Variable | Default |
|----------|---------|
| `DRAWIO_URL` | `https://localhost:5443` |
| `NEXTCLOUD_URL` | `https://localhost` |
| `NEXTCLOUD_ADMIN_USER` | `admin` |
| `NEXTCLOUD_ADMIN_PASSWORD` | `admin` |
| `INTEGRATION` | unset (set to `1` to run the round-trip suite) |
| `CROSS_BROWSER` | unset (set to `1` to also run Firefox) |

# Testing Guide — DPD Drawing Tool

This document is the single source of truth for the testing strategy of the DPD Drawing Tool, a custom draw.io implementation built for [NOLAI](https://www.ru.nl/en/nolai). It explains what is tested, how each tool works, why that tool was chosen, and how to run the tests locally and in CI.

---

## Table of Contents

1. [Testing philosophy](#testing-philosophy)
2. [Technology choices](#technology-choices)
3. [Test layers at a glance](#test-layers-at-a-glance)
4. [Directory structure](#directory-structure)
5. [Quick start](#quick-start)
6. [Unit tests (Jest)](#unit-tests-jest)
7. [E2E tests (Playwright)](#e2e-tests-playwright)
8. [Integration tests (Playwright + Docker)](#integration-tests-playwright--docker)
9. [Manual test records](#manual-test-records)
10. [Code coverage](#code-coverage)
11. [GitHub Actions CI pipeline](#github-actions-ci-pipeline)
12. [Adding new tests](#adding-new-tests)
13. [Sprint 2 test stubs](#sprint-2-test-stubs)

---

## Testing philosophy

The project follows a **test pyramid** approach: many fast, isolated unit tests at the base; fewer, slower browser tests in the middle; and a small number of full-stack integration tests at the top. This keeps local feedback quick (unit tests finish in under 2 seconds) while still verifying real browser and server behaviour where it matters.

The order of confidence levels, from highest to lowest, is:

1. A unit test passing means the plugin logic is correct in isolation.
2. A Playwright UI test passing means the browser renders the feature as designed.
3. A Playwright integration test passing means the entire stack — draw.io, Nextcloud, and Caddy — works end to end.

Whenever a bug is fixed or a new DPD rule is added, a corresponding unit test is expected to accompany it. E2E tests are written in advance as stubs (using `test.skip`) and activated once the feature is merged, so the test suite always reflects the current state of the product.

---

## Technology choices

### Why Jest for unit tests?

[Jest](https://jestjs.io/) is the industry-standard JavaScript testing framework, maintained by Meta. It was chosen for this project because:

**jsdom environment.** `jest-environment-jsdom` provides a full DOM environment inside Node.js with no browser needed. The draw.io plugin runs in a browser `window` context, and jsdom simulates that faithfully. This means unit tests start in milliseconds rather than the several seconds a real browser takes to launch.

**Built-in mocking.** Jest's `jest.fn()`, `jest.spyOn()`, and manual mock system make it straightforward to replace every draw.io global (`mxEvent`, `mxGraph`, `Draw`) with lightweight fakes. The tests never touch the real draw.io source, which is a 150 MB compiled bundle containing thousands of unrelated classes.

**Code coverage out of the box.** Jest ships with Istanbul integration. Running `npm run test:coverage` produces statement, branch, function, and line coverage with no extra tooling. As of Sprint 1, `dpd.js` achieves **93.5% statement coverage, 93.2% branch coverage, and 100% function coverage**.

**Watch mode.** `npm run test:watch` re-runs only the tests affected by a file change, making test-driven development fast. Changes to `dpd.js` or its test file trigger an instant re-run; changes to unrelated files do not.

**Snapshot testing** (available for future use). If the plugin ever serialises XML or JSON structures, Jest snapshots can pin them to a known-good value with a single assertion.

The version pinned is **Jest 29**, the current LTS major. It runs with `babel-jest` (transpilation) and `babel-plugin-istanbul` (source instrumentation), with `jest-environment-jsdom` providing the DOM.

#### The custom transformer: `jest.transform.js`

The plugin source (`dpd.js`) lives under `drawio app/src/main/webapp/plugins/`, which is outside the `tests/unit/` directory where Jest is invoked. This creates a subtle problem with code coverage.

`babel-jest` passes Jest's `config.cwd` (the directory Jest was launched from — `tests/unit/`) to `babel-plugin-istanbul` as its working directory. Istanbul then computes every file's path *relative to that `cwd`*. Because `dpd.js` is two levels above `tests/unit/`, its relative path starts with `../..`, which does not match Istanbul's default `**` include glob — so Istanbul silently skips instrumentation and reports zero coverage.

`tests/unit/jest.transform.js` is a thin wrapper around `babel-jest` that fixes this by replacing `config.cwd` with the repository root before delegating:

```js
process(sourceText, sourcePath, options) {
  return babelJest.process(sourceText, sourcePath, {
    ...options,
    config: { ...options.config, cwd: repoRoot },  // repo root instead of tests/unit
  });
}
```

This is wired in via `jest.config.js`:

```js
transform: {
  '^.+\\.[jt]sx?$': '<rootDir>/tests/unit/jest.transform.js',
},
```

### Why Playwright for E2E and integration tests?

[Playwright](https://playwright.dev/) is an end-to-end browser automation library maintained by Microsoft. It was chosen over alternatives (Cypress, Selenium) for the following reasons:

**Cross-browser with one API.** Playwright controls Chromium, Firefox, and WebKit from the same test code. draw.io targets modern browsers, and the NOLAI requirement specifies both Chrome and Firefox compatibility. A single `npx playwright test` command exercises both without any additional configuration.

**Reliable async/await model.** Playwright uses native `async/await` throughout. Every `await expect(locator).toBeVisible()` assertion has auto-retry built in, polling up to the configured `expect.timeout` (10 seconds) before failing. This eliminates the manual `waitForTimeout` calls and arbitrary sleeps that make Selenium suites fragile.

**Docker-friendly.** Playwright runs headless inside the same Docker environment as the application. The `playwright install --with-deps` command installs browser binaries and all OS-level dependencies in one step, making it fully reproducible across machines and CI environments.

**Network interception.** Playwright's `page.route()` API can intercept and mock HTTP requests. The integration tests use the `request` fixture to verify file existence on Nextcloud via WebDAV `HEAD` requests without navigating the Nextcloud UI — faster and more reliable than UI-based verification.

**First-class trace and screenshot capture.** On failure, Playwright saves a screenshot automatically (`screenshot: 'only-on-failure'`) and records a full interaction trace on the first CI retry (`trace: 'on-first-retry'`). These artifacts are uploaded to GitHub Actions and can be replayed in the Playwright Trace Viewer, which dramatically reduces the time spent debugging failures that only occur in CI.

The version pinned is **`@playwright/test` ^1.44**, which includes the Locator API, Codegen, and the HTML reporter.

---

## Test layers at a glance

| Layer | Tool | What it covers | Browser / server needed | Runs in CI on |
|---|---|---|---|---|
| Unit | Jest 29 | DPD plugin logic (`dpd.js`) in isolation | No | Every push |
| E2E UI | Playwright | Plugin init, NOLAI customisations, canvas events | draw.io Docker only | Every push |
| Integration | Playwright | Nextcloud file operations (save, load, delete, share) | Full Docker stack | PRs → `main` and pushes to `main` |

---

## Directory structure

```
.
├── README.md                          # Project overview and deployment guide
├── TESTING.md                         # This file
├── setup_merged.sh                    # One-command full-stack deployment
├── .gitignore
│
├── docs/
│   ├── comment_conventions.txt        # Team code comment style guide
│   └── NOLAI Figma Prototype.pdf      # UI design reference
│
├── drawio app/                        # Customised draw.io build
│   ├── Dockerfile
│   └── src/main/webapp/
│       └── plugins/
│           └── dpd.js                 # The DPD plugin (primary source under test)
│
└── tests/
    │
    ├── unit/                          # Layer 1 — Jest unit tests
    │   ├── package.json               # Jest + dependencies
    │   ├── jest.config.js             # Jest configuration (rootDir = repo root)
    │   ├── jest.transform.js          # babel-jest wrapper fixing cwd for Istanbul
    │   ├── setup.js                   # mxGraph globals + Draw.loadPlugin shim
    │   └── dpd.plugin.test.js         # All unit tests for dpd.js
    │
    ├── e2e/                           # Layers 2 & 3 — Playwright tests
    │   ├── package.json
    │   ├── playwright.config.js       # Projects (Chromium, Firefox), timeouts, reporters
    │   └── specs/
    │       ├── plugin-init.spec.js    # Plugin init + NOLAI UI customisations
    │       ├── dpd-rules.spec.js      # DPD rule enforcement on the canvas
    │       └── file-operations.spec.js # Nextcloud save / load / delete / share
    │
    ├── manual/                        # Human-verified test records (historical reference)
    │   ├── PLUGIN_DEMO_TEST.md        # Manual walk-through of plugin events
    │   └── UI_LOGO_TEST.md            # Manual walk-through of logo + UI customisations
    │
    └── nextcloudCallTests.js          # Inline browser console tests for WebDAV helpers
```

---

## Quick start

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Docker** — required for E2E and integration tests
- **Docker Compose** — required for integration tests

### Run unit tests

All commands run from the repo root — use `cd tests/unit` to enter the right directory, then `cd ../..` to return when done.

```bash
cd tests/unit
npm install
npm test
cd ../..
```

To run with file watching (re-runs on save):

```bash
cd tests/unit
npm run test:watch
```

### Run unit tests with coverage

```bash
cd tests/unit
npm install
npm run test:coverage
# Open tests/unit/coverage/index.html for the line-by-line HTML report
cd ../..
```

### Run E2E UI tests

First, build and start the draw.io container. The build command uses a path argument so you stay in the repo root throughout:

```bash
# From the repo root
docker build -t dpd-drawio "drawio app/"
docker run -d --name drawio-app -p 5500:8080 dpd-drawio
```

Then install dependencies and run the UI specs:

```bash
cd tests/e2e
npm install
npx playwright install --with-deps chromium firefox
npx playwright test specs/plugin-init.spec.js specs/dpd-rules.spec.js
cd ../..
```

Open the HTML report (run from inside `tests/e2e`):

```bash
cd tests/e2e
npx playwright show-report
cd ../..
```

Stop the container when done:

```bash
docker stop drawio-app && docker rm drawio-app
```

### Run integration tests (full stack)

```bash
# From the repo root — start the full stack
bash setup_merged.sh

# Then move into the e2e directory and run the integration spec
cd tests/e2e
INTEGRATION=1 npx playwright test specs/file-operations.spec.js --project=chromium
cd ../..
```

---

## Unit tests (Jest)

### How the test environment works

Jest runs each test file in a worker process with a fresh `jsdom` DOM environment. Before any test file loads, `setup.js` (configured via `setupFilesAfterEnv`) runs and sets the following globals on `window` / `global`:

| Global | What it provides |
|---|---|
| `mxEvent` | Object with a `CHANGE` constant that the plugin registers listeners against |
| `createMockModel()` | Factory returning a mock graph model with `addListener`, `isVertex`, `isEdge`, `getTerminal`, and a `fireChange(changes)` helper |
| `createMockGraph(model)` | Factory wrapping a model in a minimal `{ model }` graph object |
| `createMockCell({ isVertex, isEdge, id })` | Factory returning a mock cell with `getAttribute`/`setAttribute` spies |
| `Draw.loadPlugin(fn)` | Captures the plugin function passed by the plugin file at module level |
| `Draw.runPlugin(ui)` | Executes the captured plugin function with a controlled `ui` object |
| `alert` | `jest.fn()` — records calls without opening a browser dialog |

### Loading the plugin in a test

Because `dpd.js` calls `Draw.loadPlugin(function(ui) { ... })` at module level (not as an export), tests use this pattern:

```js
function loadPlugin() {
  jest.resetModules();   // clear module registry so each test gets a fresh instance
  require('../../drawio app/src/main/webapp/plugins/dpd.js');
  const graph = createMockGraph(createMockModel());
  Draw.runPlugin({ editor: { graph } });
  return graph;
}
```

`jest.resetModules()` ensures state (such as the set of already-logged connections) does not leak between tests.

### Firing synthetic graph events

The plugin listens to `mxEvent.CHANGE` on the graph model. Tests trigger this via `model.fireChange(changes)`:

```js
// Vertex added
model.fireChange([{
  constructor: { name: 'mxChildChange' },
  child: createMockCell({ isVertex: true }),
  previous: null,  // null = no previous parent = new cell
}]);

// Vertex moved
model.fireChange([{
  constructor: { name: 'mxGeometryChange' },
  cell: createMockCell({ isVertex: true }),
  previous: { x: 0, y: 0, width: 100, height: 50 },
  geometry: { x: 50, y: 80, width: 100, height: 50 },
}]);
```

The three change types the plugin currently handles:

| `constructor.name` | Triggered by | Key fields |
|---|---|---|
| `mxChildChange` | Cell added or removed | `child` (cell), `previous` (old parent — `null` means new) |
| `mxGeometryChange` | Cell moved or resized | `cell`, `previous` (old geometry), `geometry` (new geometry) |
| `mxTerminalChange` | Edge endpoint connected | `cell` (the edge) |

### Running a single test file

```bash
cd tests/unit
npx jest dpd.plugin.test.js --verbose
```

---

## E2E tests (Playwright)

### How the configuration works

`tests/e2e/playwright.config.js` sets the key Playwright options:

- **`baseURL`** — `http://localhost:5500` by default; override with `DRAWIO_URL`.
- **`fullyParallel: false, workers: 1`** — sequential execution prevents Nextcloud race conditions on shared file state.
- **`retries: process.env.CI ? 1 : 0`** — one automatic retry in CI to absorb Docker startup timing; zero locally so failures surface immediately.
- **`timeout: 30_000`** — draw.io takes several seconds to hydrate on first load.
- **Projects: `chromium` and `firefox`** — the entire suite runs against both browsers.

### Handling the startup alert

The plugin currently calls `alert()` on load (issue [#115](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/115)). All specs dismiss it automatically:

```js
page.on('dialog', (dialog) => dialog.dismiss());
```

Once issue #115 replaces `alert()` with a non-blocking component, remove this line from all specs.

### Selectors and `data-testid`

Using `data-testid` attributes is strongly preferred over CSS class selectors or text content. The pattern:

1. Add `data-testid="my-feature"` to the element in the draw.io source.
2. Update the `// TODO` in the spec to `page.getByTestId('my-feature')`.

### Skipped tests

```js
test.skip(true, 'Awaiting issue #112 — DPD rule enforcement UI');
```

Find all skipped tests:

```bash
grep -r "test.skip" tests/e2e/specs/
```

---

## Integration tests (Playwright + Docker)

### What they cover

`file-operations.spec.js` exercises the complete file management workflow against a real Nextcloud instance: saving a diagram, listing files, loading, deleting, sharing, and restoring a previous version.

### Skipping locally

```js
test.skip(
  !process.env.CI && !process.env.INTEGRATION,
  'Skipped locally — run with INTEGRATION=1 or in CI'
);
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DRAWIO_URL` | `http://localhost:5500` | draw.io application URL |
| `NEXTCLOUD_URL` | `https://localhost` | Nextcloud instance URL |
| `NEXTCLOUD_USER` | `admin` | Nextcloud username |
| `NEXTCLOUD_PASS` | `admin` | Nextcloud password |
| `INTEGRATION` | _(unset)_ | Set to `1` to run integration tests locally |

### WebDAV verification

After a save test, the test confirms the file exists via a WebDAV `HEAD` request using Playwright's `request` fixture, rather than navigating the Nextcloud UI:

```js
const response = await request.head(
  `${process.env.NEXTCLOUD_URL}/remote.php/dav/files/admin/test-file.drawio`,
  { headers: { Authorization: 'Basic ' + btoa('admin:admin') } }
);
expect(response.status()).toBe(200);
```

---

## Manual test records

Before the automated E2E suite existed, the team performed and documented manual tests. These records are preserved in `tests/manual/` as historical reference:

- **`PLUGIN_DEMO_TEST.md`** — Manual walk-through of vertex add, move, resize, delete, and edge creation events, confirming that `dpd.js` logs the correct messages to the console. All 8 cases: PASS.
- **`UI_LOGO_TEST.md`** — Manual verification of the NOLAI logo display, browser resize behaviour, cross-browser rendering (Chrome, Firefox), and suppression of "Edit Data" and "Clear Default Style". All 8 cases: PASS.

These scenarios are now automated in `plugin-init.spec.js` and `dpd-rules.spec.js`.

---

## Code coverage

Coverage is generated by Istanbul (via `babel-plugin-istanbul`) and reported by Jest.

### Running coverage

```bash
cd tests/unit
npm run test:coverage
# HTML report: tests/unit/coverage/index.html
```

### Current results (Sprint 1)

```
dpd.js  |  93.5% stmts  |  93.2% branch  |  100% funcs  |  95.5% lines
```

Lines 22–23 (the startup `alert()` call) are the only uncovered lines. They will be covered once issue #115 replaces `alert()` with a testable notification component.

### How coverage works in this project

`jest.config.js` sets `rootDir` to the repository root so that `collectCoverageFrom` patterns are evaluated as paths relative to the repo root. Jest's internal `shouldInstrument()` function uses `path.relative(rootDir, file)` before matching against these patterns, meaning absolute paths would never match — a common source of silent zero-coverage results.

The custom `jest.transform.js` solves a second problem: `babel-jest` passes `config.cwd` (= `process.cwd()` = `tests/unit/`) to `babel-plugin-istanbul`. Istanbul computes each file's path relative to that `cwd`, and skips any file whose relative path starts with `..`. The wrapper overrides `config.cwd` to `repoRoot` before delegating to `babel-jest`, ensuring all files within the repository are instrumented correctly.

---

## GitHub Actions CI pipeline

The pipeline is defined in `.github/workflows/ci.yml` and contains three jobs.

### Job 1 — `unit-tests`

Runs on every push. Installs Node 20, runs `npm install` and `npm run test:coverage` inside `tests/unit/`, and uploads the coverage HTML report as a build artifact (retained 14 days).

### Job 2 — `e2e-ui-tests`

Runs after `unit-tests` passes. Builds the draw.io Docker image, waits for Tomcat to be healthy on port 5500, then runs `plugin-init.spec.js` and `dpd-rules.spec.js` in both Chromium and Firefox. The Playwright HTML report is uploaded on failure.

### Job 3 — `integration-tests`

Runs only on PRs targeting `main` and direct pushes to `main`. Executes `setup_merged.sh` to start the full Docker Compose stack, waits for both services to be healthy, runs `file-operations.spec.js` in Chromium, and tears the stack down on completion.

```
Every push
│
├── unit-tests (~2 s)
│   └── [on pass] e2e-ui-tests (~3–5 min)
│
└── [PRs → main / push to main only]
    └── integration-tests (~10–15 min)
```

---

## Adding new tests

### Adding a unit test for a new DPD rule

1. Open `tests/unit/dpd.plugin.test.js` and find the `DPD rule enforcement (stubs)` describe block.
2. Replace the relevant `it.todo` stub with a concrete test using the mock factories from `setup.js`.
3. If the rule depends on cell attributes, configure the mock: `cell.getAttribute = jest.fn((key) => ...)`.
4. Run `npm test` to confirm the test passes before pushing.

### Adding a Playwright test for a new UI feature

1. Add `data-testid="..."` attributes to the new element in the draw.io source.
2. Open (or create) the relevant spec file in `tests/e2e/specs/`.
3. Follow the `loadApp` + locator + assertion pattern from existing specs.
4. If the feature is not yet merged, scaffold it as `test.skip(true, 'Awaiting issue #XXX')`.

### Adding a new spec file

Create `tests/e2e/specs/my-feature.spec.js`. Playwright discovers spec files automatically via `testDir: './specs'` — no config change needed. If the spec requires the full Nextcloud stack, add it to the `integration-tests` CI job; otherwise it runs in `e2e-ui-tests`.

---

## Sprint 2 test stubs

The following tests are scaffolded but skipped, waiting for the corresponding Sprint 2 issues to be merged:

| Test file | Description | Issue |
|---|---|---|
| `dpd-rules.spec.js` | Invalid connection triggers rule-violation alert | [#112](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/112), [#113](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/113) |
| `dpd-rules.spec.js` | Valid connection shows no alert | [#113](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/113) |
| `dpd-rules.spec.js` | Clicking a shape opens the attribute panel | [#120](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/120) |
| `dpd-rules.spec.js` | Attribute panel shows correct DPD options | [#120](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/120) |
| `file-operations.spec.js` | Save dialog opens | [#98](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/98) |
| `file-operations.spec.js` | Saved file appears in Nextcloud | [#98](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/98) |
| `file-operations.spec.js` | Load dialog opens | [#100](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/100) |
| `file-operations.spec.js` | Delete with confirmation prompt | [#108](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/108) |
| `file-operations.spec.js` | Version history lists saved versions | [#107](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/107) |
| `file-operations.spec.js` | Share dialog accepts a recipient | [#99](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/99) |
| `dpd.plugin.test.js` | Rejects incompatible DPD type connection | [#110](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/110), [#113](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/113) |
| `dpd.plugin.test.js` | Allows valid DPD type connection | [#110](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/110) |
| `dpd.plugin.test.js` | Alert fires when required attribute is missing | [#115](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/115) |
| `dpd.plugin.test.js` | No alert when all required attributes present | [#115](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/115) |
| `dpd.plugin.test.js` | Cardinality rule enforcement | [#113](https://github.com/GiPHouse/DPD-Drawing-Tool/issues/113) |

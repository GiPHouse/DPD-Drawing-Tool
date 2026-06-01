// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for the DPD Drawing Tool E2E suite.
 *
 * The draw.io app must be running at https://localhost:5443 (Caddy reverse
 * proxy in the dev Docker Compose stack). Override with DRAWIO_URL /
 * NEXTCLOUD_URL environment variables.
 *
 * SPEED vs. ISOLATION
 * ───────────────────
 * Two projects keep the trade-off clean:
 *   • "fast"        — specs/custom-features.spec.js. Pure-UI tests on isolated
 *                     pages with no shared backend, so they run fully parallel
 *                     and finish in seconds.
 *   • "integration" — specs/nextcloud-integration.spec.js. These hit ONE shared
 *                     Nextcloud instance over WebDAV/OCS; running them in
 *                     parallel causes real races (save-dialog re-renders,
 *                     delete-before-readback). fullyParallel:false makes this
 *                     project run its tests serially, eliminating contention.
 *
 * Chromium only by default; set CROSS_BROWSER=1 to add Firefox variants.
 * The integration project is gated behind INTEGRATION=1 inside the spec.
 */

const CHROME = {
  ...devices['Desktop Chrome'],
  // On headless Linux (CI/Docker) Chromium floods stdout with GPU/sandbox
  // messages before it is ready; Playwright accumulates that into one string
  // and can crash with "RangeError: Invalid string length". These flags
  // suppress the noise and are required when running as root in a container
  // (--no-sandbox) or with limited /dev/shm (--disable-dev-shm-usage).
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
};

const FAST_MATCH = /custom-features\.spec\.js/;
const INTEGRATION_MATCH = /nextcloud-integration\.spec\.js/;

const projects = [
  // Fast UI suite — parallel.
  { name: 'fast', testMatch: FAST_MATCH, fullyParallel: true, use: { ...CHROME } },
  // Nextcloud round-trips — serial to avoid shared-backend races.
  { name: 'integration', testMatch: INTEGRATION_MATCH, fullyParallel: false, use: { ...CHROME } },
];

// Opt-in cross-browser coverage (run `npx playwright install firefox` first).
if (process.env.CROSS_BROWSER) {
  const FF = { ...devices['Desktop Firefox'] };
  projects.push(
    { name: 'fast-firefox', testMatch: FAST_MATCH, fullyParallel: true, use: { ...FF } },
    { name: 'integration-firefox', testMatch: INTEGRATION_MATCH, fullyParallel: false, use: { ...FF } }
  );
}

module.exports = defineConfig({
  testDir: './specs',

  // Default parallel for the fast project; the integration project overrides
  // this to false (above) so its tests run one at a time.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  // Retry once on CI to absorb Docker startup timing jitter.
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.DRAWIO_URL || 'https://localhost:5443',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },

  projects,

  // draw.io can be slow on first load; keep a generous per-test ceiling but
  // most tests finish in a few seconds.
  timeout: 30_000,
  expect: { timeout: 10_000 },
});

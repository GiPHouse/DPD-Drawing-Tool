// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for the DPD Drawing Tool E2E test suite.
 *
 * The draw.io app is expected to be running at https://localhost:5443
 * through the Caddy reverse proxy when using the Docker Compose stack.
 *
 * Set DRAWIO_URL and NEXTCLOUD_URL environment variables to override.
 */
module.exports = defineConfig({
  testDir: './specs',

  // Run all tests in parallel inside a file; tests files run sequentially
  // to avoid Nextcloud race conditions on file operations.
  fullyParallel: false,
  workers: 1,

  // Retry once on CI to reduce flakiness from Docker startup timing
  retries: process.env.CI ? 1 : 0,

  // HTML reporter shows screenshots and traces on failure
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.DRAWIO_URL || 'https://localhost:5443',
    ignoreHTTPSErrors: true,

    // Capture trace on first retry to help debug CI failures
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Automatically dismiss alert() dialogs (the plugin startup alert)
    // Each spec can override this if it needs to assert alert content.
    // NOTE: Remove this line once issue #115 (Custom Alert Messages) replaces alert().
    acceptDownloads: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // On headless Linux (CI/Docker), Chromium emits a large volume of
        // GPU-initialisation and sandbox-setup messages to stdout before it
        // is ready. Playwright's spawnAsync utility accumulates that output
        // into a single string; if the string grows past the JavaScript
        // maximum string length (~1 GB) the process crashes with:
        //   RangeError: Invalid string length
        // The flags below suppress the sources of that noise:
        //   --no-sandbox / --disable-setuid-sandbox : required when running
        //     as root inside a Docker container.
        //   --disable-dev-shm-usage : avoids /dev/shm exhaustion in
        //     memory-constrained CI runners.
        //   --disable-gpu : prevents the GPU process from starting and
        //     flooding stdout with driver-not-found errors.
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Global test timeout — draw.io can be slow on first load
  timeout: 30_000,
  expect: { timeout: 10_000 },
});

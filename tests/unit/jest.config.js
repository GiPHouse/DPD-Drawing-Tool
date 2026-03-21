const path = require('path');

// Root of the repository (two levels up from tests/unit).
// Setting rootDir here means collectCoverageFrom patterns are evaluated as
// paths relative to the repo root, which avoids the absolute-path trap:
// Jest's shouldInstrument() converts filenames to path.relative(rootDir, file)
// before matching them against collectCoverageFrom — so absolute patterns
// never match.  Relative patterns from the repo root do.
const repoRoot = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: repoRoot,
  testEnvironment: 'jsdom',

  // Keep test files and the plugin source in Jest's file-system index.
  roots: [
    '<rootDir>/tests/unit',
    // path.join handles the space in "drawio app" reliably
    path.join(repoRoot, 'drawio app', 'src', 'main', 'webapp', 'plugins'),
  ],

  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],

  // Relative to rootDir — what shouldInstrument() actually compares against.
  collectCoverageFrom: [
    'drawio app/src/main/webapp/plugins/dpd.js',
  ],

  // Use the custom transformer that fixes babel-plugin-istanbul's cwd so it
  // correctly instruments source files that live outside tests/unit.
  transform: {
    '^.+\\.[jt]sx?$': '<rootDir>/tests/unit/jest.transform.js',
  },

  collectCoverage: true,
  coverageProvider: 'babel',
  coverageReporters: ['text', 'lcov', 'html'],
};

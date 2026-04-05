/**
 * Jest configuration for the DPD plugin unit tests.
 *
 * rootDir is set to the repository root so that collectCoverageFrom paths
 * resolve correctly — Jest computes coverage file paths relative to rootDir,
 * and using an absolute path here avoids a known mismatch in babel-plugin-istanbul.
 */

const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: repoRoot,
  testEnvironment: 'jsdom',

  // Include both the test directory and the source directories so Jest can
  // locate plugin files when they are require()d inside tests.
  roots: [
    '<rootDir>/tests/unit',
    path.join(repoRoot, 'drawio app', 'src', 'main', 'webapp', 'plugins'),
    path.join(repoRoot, 'drawio app', 'src', 'main', 'webapp', 'js', 'diagramly'),
  ],

  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],

  // Source files measured for coverage. Paths are relative to rootDir.
  collectCoverageFrom: [
    'drawio app/src/main/webapp/plugins/dpd.js',
    'drawio app/src/main/webapp/js/diagramly/DPDConsole.js',
  ],

  // Custom transformer that corrects babel-plugin-istanbul's cwd so it
  // instruments source files that live outside the tests/unit directory.
  transform: {
    '^.+\\.[jt]sx?$': '<rootDir>/tests/unit/jest.transform.js',
  },

  collectCoverage: true,
  coverageProvider: 'babel',
  coverageReporters: ['text', 'lcov', 'html'],
};

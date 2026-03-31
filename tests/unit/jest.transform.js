/**
 * Custom Jest transformer that fixes Istanbul instrumentation for source files
 * that live outside the `tests/unit` directory.
 *
 * Problem: babel-jest passes `config.cwd` (= process.cwd() = tests/unit) as
 * the `cwd` option to babel-plugin-istanbul.  Istanbul then computes the path
 * of each file *relative to that cwd*.  Because dpd.js is two levels above
 * tests/unit its relative path starts with "../..", which does not match the
 * default "**" include glob, so Istanbul silently skips instrumentation.
 *
 * Fix: replace `config.cwd` with `config.rootDir` (the repository root) before
 * delegating to babel-jest.  Every source file is inside rootDir, so all
 * relative paths remain within the "**" glob and are correctly instrumented.
 */

const babelJestModule = require('babel-jest');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

// babel-jest exposes a createTransformer factory; instantiate with defaults.
const babelJest = (babelJestModule.default || babelJestModule).createTransformer({});

const transformer = {
  process(sourceText, sourcePath, options) {
    return babelJest.process(sourceText, sourcePath, {
      ...options,
      config: { ...options.config, cwd: repoRoot },
    });
  },

  processAsync(sourceText, sourcePath, options) {
    return babelJest.processAsync(sourceText, sourcePath, {
      ...options,
      config: { ...options.config, cwd: repoRoot },
    });
  },

  getCacheKey(sourceText, sourcePath, options) {
    // Include repoRoot in the cache key so the fix doesn't collide with the
    // old uninstrumented cache entries.
    const baseKey = babelJest.getCacheKey(sourceText, sourcePath, {
      ...options,
      config: { ...options.config, cwd: repoRoot },
    });
    return baseKey + repoRoot;
  },

  getCacheKeyAsync(sourceText, sourcePath, options) {
    return Promise.resolve(
      transformer.getCacheKey(sourceText, sourcePath, options)
    );
  },

  // Tell Jest that this transformer handles its own Istanbul instrumentation
  // (just like babel-jest itself does).
  canInstrument: true,
};

module.exports = transformer;

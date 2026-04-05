/**
 * Unit tests for DPDConsole (js/diagramly/DPDConsole.js)
 *
 * DPDConsole is a browser-global constructor that uses jsdom for DOM operations
 * and mxUtils.bind for event binding. Both are provided by setup.js.
 *
 * DPDConsole.js declares `var DPDConsole = function(...) {}` at the top level.
 * In Node's module wrapper that var is file-local and not exported, so we load
 * the source as a string and execute it with `new Function(...)` to capture the
 * local binding and return it — avoiding any changes to the source file itself.
 */

const fs   = require('fs');
const path = require('path');

// Read the source file, append a return statement, and execute it as a
// self-contained function so the DPDConsole constructor is available here.
const DPD_CONSOLE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../drawio app/src/main/webapp/js/diagramly/DPDConsole.js'),
  'utf8',
);
// eslint-disable-next-line no-new-func
const DPDConsole = new Function(DPD_CONSOLE_SRC + '\n; return DPDConsole;')();

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a minimal EditorUi stub. DPDConsole reads editorUi.showTimestamps
 * to decide whether to render timestamp lines on violation entries.
 */
function makeEditorUi({ showTimestamps = true } = {}) {
  return { showTimestamps };
}

/**
 * Creates a fresh DPDConsole instance mounted in its own container div.
 * DPDConsole appends three children to the container: header, logArea,
 * and footer.
 */
function makeDPDConsole(editorUiOpts = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editorUi = makeEditorUi(editorUiOpts);
  const console_  = new DPDConsole(editorUi, container);
  return { console: console_, container, editorUi };
}

// ── Constructor / init ────────────────────────────────────────────────────────

describe('DPDConsole — constructor and init', () => {
  it('initialises violations as an empty array', () => {
    const { console: c } = makeDPDConsole();
    expect(c.violations).toEqual([]);
  });

  it('initialises indexCounter to 0', () => {
    const { console: c } = makeDPDConsole();
    expect(c.indexCounter).toBe(0);
  });

  it('initialises maxViolations to 50', () => {
    const { console: c } = makeDPDConsole();
    expect(c.maxViolations).toBe(50);
  });

  it('initialises onClear to null', () => {
    const { console: c } = makeDPDConsole();
    expect(c.onClear).toBeNull();
  });

  it('initialises onToggleHighlights to null', () => {
    const { console: c } = makeDPDConsole();
    expect(c.onToggleHighlights).toBeNull();
  });

  it('stores the editorUi reference', () => {
    const { console: c, editorUi } = makeDPDConsole();
    expect(c.editorUi).toBe(editorUi);
  });

  it('stores the container reference', () => {
    const { console: c, container } = makeDPDConsole();
    expect(c.container).toBe(container);
  });

  it('creates a header element inside the container', () => {
    const { container } = makeDPDConsole();
    expect(container.firstChild).not.toBeNull();
  });

  it('creates a logArea element (scrollable violation list)', () => {
    const { console: c } = makeDPDConsole();
    expect(c.logArea).toBeDefined();
    expect(c.logArea.tagName).toBe('DIV');
  });

  it('creates a footer element with statsText', () => {
    const { console: c } = makeDPDConsole();
    expect(c.footer).toBeDefined();
    expect(c.statsText).toBeDefined();
  });

  it('renders the "No violations detected" empty-state message on load', () => {
    const { console: c } = makeDPDConsole();
    const emptyMsg = c.logArea.querySelector('#dpdEmptyMessage');
    expect(emptyMsg).not.toBeNull();
    expect(emptyMsg.textContent).toContain('No violations detected');
  });

  it('shows "0 violations" in the footer on load', () => {
    const { console: c } = makeDPDConsole();
    expect(c.statsText.textContent).toBe('0 violations');
  });

  it('creates a Highlights toggle button (toggleBtn)', () => {
    const { console: c } = makeDPDConsole();
    expect(c.toggleBtn).toBeDefined();
    expect(c.toggleBtn.tagName).toBe('BUTTON');
    expect(c.toggleBtn.textContent).toBe('Highlights');
  });
});

// ── addViolation() ────────────────────────────────────────────────────────────

describe('DPDConsole — addViolation()', () => {
  it('pushes a violation object into the violations array', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'Test message', 'error', {});
    expect(c.violations).toHaveLength(1);
  });

  it('stores the correct rule name, message and severity', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-I4', 'Identifiable but not universally linkable', 'warning', {});
    const v = c.violations[0];
    expect(v.ruleName).toBe('R-I4');
    expect(v.message).toBe('Identifiable but not universally linkable');
    expect(v.severity).toBe('warning');
  });

  it('defaults severity to "error" when not provided', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg');
    expect(c.violations[0].severity).toBe('error');
  });

  it('increments indexCounter with each violation', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'a', 'error', {});
    c.addViolation('R-S2', 'b', 'error', {});
    c.addViolation('R-S3', 'c', 'error', {});
    expect(c.indexCounter).toBe(3);
    expect(c.violations[2].index).toBe(3);
  });

  it('hides the empty-state message after the first violation is added', () => {
    const { console: c } = makeDPDConsole();
    const emptyMsg = c.logArea.querySelector('#dpdEmptyMessage');
    expect(emptyMsg.style.display).not.toBe('none');

    c.addViolation('R-S1', 'msg', 'error', {});

    expect(emptyMsg.style.display).toBe('none');
  });

  it('creates a DOM entry element in logArea for each violation', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'First', 'error', {});
    c.addViolation('R-S2', 'Second', 'error', {});

    const entries = c.logArea.querySelectorAll('.dpdViolationEntry');
    expect(entries).toHaveLength(2);
  });

  it('updates footer stats after adding a violation', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    expect(c.statsText.textContent).toContain('1 violation');
  });

  it('caps the violations array at maxViolations, evicting the oldest entry', () => {
    const { console: c } = makeDPDConsole();
    c.maxViolations = 3;

    c.addViolation('R-S1', 'first',  'error', {});
    c.addViolation('R-S2', 'second', 'error', {});
    c.addViolation('R-S3', 'third',  'error', {});
    c.addViolation('R-I1', 'fourth', 'error', {});

    // When the cap is exceeded, violations.shift() removes the oldest entry,
    // keeping the array length at maxViolations.
    expect(c.violations).toHaveLength(3);
    expect(c.violations[0].ruleName).toBe('R-S2');
  });

  it('stores the details object on the violation', () => {
    const { console: c } = makeDPDConsole();
    const details = { sourceType: 'data_store', targetType: 'data_store' };
    c.addViolation('R-S1', 'msg', 'error', details);
    expect(c.violations[0].details).toEqual(details);
  });

  it('stores a Date object as the violation timestamp', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    expect(c.violations[0].timestamp).toBeInstanceOf(Date);
  });
});

// ── createViolationEntry DOM structure ────────────────────────────────────────

describe('DPDConsole — createViolationEntry DOM structure', () => {
  it('uses a red left border for error violations', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    expect(entry.style.borderLeft).toContain('#ff4444');
  });

  it('uses an orange left border for warning violations', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-I4', 'msg', 'warning', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    expect(entry.style.borderLeft).toContain('#ffaa00');
  });

  it('renders the violation index badge (e.g. "#1")', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    expect(entry.textContent).toContain('#1');
  });

  it('renders the rule name in the entry', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-P2', 'msg', 'error', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    expect(entry.textContent).toContain('R-P2');
  });

  it('renders the violation message in the entry', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'Data stores cannot connect directly', 'error', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    expect(entry.textContent).toContain('Data stores cannot connect directly');
  });

  it('renders a timestamp when editorUi.showTimestamps is not false', () => {
    const { console: c } = makeDPDConsole({ showTimestamps: true });
    c.addViolation('R-S1', 'msg', 'error', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    // toLocaleTimeString output is locale-dependent but always contains
    // at least two colons (HH:MM:SS), which is a reliable proxy for its presence.
    const colonCount = entry.textContent.split('').filter((ch) => ch === ':').length;
    expect(colonCount).toBeGreaterThanOrEqual(2);
  });

  it('does NOT render a timestamp when editorUi.showTimestamps is false', () => {
    const { console: c } = makeDPDConsole({ showTimestamps: false });
    c.addViolation('R-S1', 'msg', 'error', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    // Without a timestamp the entry text (badge + rule + message) contains
    // fewer than two colons.
    const colonCount = entry.textContent.split('').filter((ch) => ch === ':').length;
    expect(colonCount).toBeLessThan(2);
  });

  it('renders a "▶ details" toggle button when details are provided', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', { sourceType: 'data_store', targetType: 'data_store' });
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    expect(entry.textContent).toContain('▶ details');
  });

  it('does NOT render a details toggle when details object is empty', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    const entry = c.logArea.querySelector('.dpdViolationEntry');
    expect(entry.textContent).not.toContain('▶ details');
  });

  it('expands the details panel when the toggle is clicked', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', { sourceType: 'data_store' });
    const entry = c.logArea.querySelector('.dpdViolationEntry');

    const detailsBtn = Array.from(entry.querySelectorAll('div')).find(
      (el) => el.textContent === '▶ details',
    );
    expect(detailsBtn).not.toBeNull();

    detailsBtn.click();

    // Clicking the toggle rotates the arrow from ▶ to ▼ and makes the
    // details div visible.
    expect(detailsBtn.textContent).toBe('▼ details');
  });
});

// ── updateStats() ─────────────────────────────────────────────────────────────

describe('DPDConsole — updateStats()', () => {
  it('shows "0 violations" when the list is empty', () => {
    const { console: c } = makeDPDConsole();
    c.updateStats();
    expect(c.statsText.textContent).toBe('0 violations');
  });

  it('uses the singular "1 violation" when there is exactly one violation', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    expect(c.statsText.textContent).toContain('1 violation');
    expect(c.statsText.textContent).not.toContain('1 violations');
  });

  it('uses the plural "2 violations" when there are two violations', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.addViolation('R-S2', 'msg', 'error', {});
    expect(c.statsText.textContent).toContain('2 violations');
  });

  it('includes the error count in the breakdown', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.addViolation('R-S2', 'msg', 'error', {});
    expect(c.statsText.textContent).toContain('2 errors');
  });

  it('includes the warning count in the breakdown', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S4', 'msg', 'warning', {});
    expect(c.statsText.textContent).toContain('1 warning');
  });

  it('shows both error and warning counts when both are present', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.addViolation('R-S4', 'msg', 'warning', {});
    const text = c.statsText.textContent;
    expect(text).toContain('1 error');
    expect(text).toContain('1 warning');
  });

  it('includes "error" in the breakdown even when there are no warnings', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    expect(c.statsText.textContent).toContain('error');
  });
});

// ── clear() ───────────────────────────────────────────────────────────────────

describe('DPDConsole — clear()', () => {
  it('resets the violations array to empty', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.clear();
    expect(c.violations).toEqual([]);
  });

  it('resets the indexCounter to 0', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.addViolation('R-S2', 'msg', 'error', {});
    c.clear();
    expect(c.indexCounter).toBe(0);
  });

  it('re-adds the empty-state message to logArea', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.clear();
    const emptyMsg = c.logArea.querySelector('#dpdEmptyMessage');
    expect(emptyMsg).not.toBeNull();
    expect(emptyMsg.textContent).toContain('No violations detected');
  });

  it('removes all violation entries from logArea', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.addViolation('R-S2', 'msg', 'error', {});
    c.clear();
    const entries = c.logArea.querySelectorAll('.dpdViolationEntry');
    expect(entries).toHaveLength(0);
  });

  it('resets footer to "0 violations"', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.clear();
    expect(c.statsText.textContent).toBe('0 violations');
  });

  it('resets the Highlights button to the inactive state', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(true);
    expect(c.toggleBtn._active).toBe(true);

    c.clear();

    // clear() calls setHighlightToggleState(false), restoring the default
    // button appearance and clearing the _active flag.
    expect(c.toggleBtn._active).toBe(false);
  });

  it('fires the onClear callback when defined', () => {
    const { console: c } = makeDPDConsole();
    const onClear = jest.fn();
    c.onClear = onClear;

    c.clear();

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onClear is null', () => {
    const { console: c } = makeDPDConsole();
    c.onClear = null;
    expect(() => c.clear()).not.toThrow();
  });

  it('resets the index counter so the next violation after clear() gets index #1', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});
    c.addViolation('R-S2', 'msg', 'error', {});
    c.clear();
    c.addViolation('R-I1', 'msg', 'error', {});

    expect(c.violations[0].index).toBe(1);
    const badge = c.logArea.querySelector('.dpdViolationEntry');
    expect(badge.textContent).toContain('#1');
  });
});

// ── setHighlightToggleState() ─────────────────────────────────────────────────

describe('DPDConsole — setHighlightToggleState()', () => {
  it('marks the button as active (_active = true) when called with true', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(true);
    expect(c.toggleBtn._active).toBe(true);
  });

  it('marks the button as inactive (_active = false) when called with false', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(true);
    c.setHighlightToggleState(false);
    expect(c.toggleBtn._active).toBe(false);
  });

  it('sets the button background to orange (rgb(255, 136, 0)) when active', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(true);
    expect(c.toggleBtn.style.background).toBe('rgb(255, 136, 0)');
  });

  it('resets the button background to "none" when inactive', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(true);
    c.setHighlightToggleState(false);
    expect(c.toggleBtn.style.background).toBe('none');
  });

  it('sets opacity to "1" when active', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(true);
    expect(c.toggleBtn.style.opacity).toBe('1');
  });

  it('sets opacity to "0.45" when inactive', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(false);
    expect(c.toggleBtn.style.opacity).toBe('0.45');
  });

  it('updates the button title to include "locked" when active', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(true);
    expect(c.toggleBtn.title).toContain('locked');
  });

  it('sets a non-empty button title when inactive', () => {
    const { console: c } = makeDPDConsole();
    c.setHighlightToggleState(false);
    expect(c.toggleBtn.title.length).toBeGreaterThan(0);
  });

  it('does not throw when toggleBtn is null', () => {
    const { console: c } = makeDPDConsole();
    c.toggleBtn = null;
    expect(() => c.setHighlightToggleState(true)).not.toThrow();
  });
});

// ── onToggleHighlights callback ───────────────────────────────────────────────

describe('DPDConsole — onToggleHighlights callback', () => {
  it('calls onToggleHighlights when the Highlights button is clicked', () => {
    const { console: c } = makeDPDConsole();
    const handler = jest.fn();
    c.onToggleHighlights = handler;

    c.toggleBtn.click();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onToggleHighlights is null and the button is clicked', () => {
    const { console: c } = makeDPDConsole();
    c.onToggleHighlights = null;
    expect(() => c.toggleBtn.click()).not.toThrow();
  });

  it('does not throw when onToggleHighlights is a non-function and the button is clicked', () => {
    const { console: c } = makeDPDConsole();
    c.onToggleHighlights = 'not a function';
    expect(() => c.toggleBtn.click()).not.toThrow();
  });
});

// ── Header clear button (✕) ───────────────────────────────────────────────────

describe('DPDConsole — header clear button (✕)', () => {
  // The clear button is the last button in the header controls area; its text
  // content is '✕'.
  function getClearButton(container) {
    return Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === '✕',
    );
  }

  it('clicking the clear button resets the violations list', () => {
    const { console: c, container } = makeDPDConsole();
    c.addViolation('R-S1', 'msg', 'error', {});

    const clearBtn = getClearButton(container);
    expect(clearBtn).not.toBeNull();
    clearBtn.click();

    expect(c.violations).toEqual([]);
  });

  it('clicking the clear button fires the onClear callback', () => {
    const { console: c, container } = makeDPDConsole();
    const onClear = jest.fn();
    c.onClear = onClear;

    const clearBtn = getClearButton(container);
    clearBtn.click();

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

// ── Multi-violation edge cases ────────────────────────────────────────────────

describe('DPDConsole — multi-violation edge cases', () => {
  it('sequential violations receive sequential index numbers', () => {
    const { console: c } = makeDPDConsole();
    for (let i = 0; i < 5; i++) {
      c.addViolation('R-S1', 'msg ' + i, 'error', {});
    }
    const indices = c.violations.map((v) => v.index);
    expect(indices).toEqual([1, 2, 3, 4, 5]);
  });

  it('correctly counts mixed-severity violations in the footer stats', () => {
    const { console: c } = makeDPDConsole();
    c.addViolation('R-S1', 'e1', 'error',   {});
    c.addViolation('R-S2', 'e2', 'error',   {});
    c.addViolation('R-S4', 'w1', 'warning', {});
    c.addViolation('R-I4', 'w2', 'warning', {});

    const text = c.statsText.textContent;
    expect(text).toContain('4 violations');
    expect(text).toContain('2 errors');
    expect(text).toContain('2 warnings');
  });
});

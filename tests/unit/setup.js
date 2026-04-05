/**
 * Global test setup for the DPD plugin unit tests.
 *
 * Injects browser globals that dpd.js and DPDConsole.js depend on, replacing
 * them with jest-controlled stubs so the plugin can be loaded and exercised
 * in the Node/jsdom environment without a real browser.
 *
 * Run: cd tests/unit && npm install && npm test
 */

// mxEvent constants referenced by the plugin's listener registrations.
global.mxEvent = {
  CHANGE:      'CHANGE',
  CELLS_ADDED: 'CELLS_ADDED',
  CELLS_MOVED: 'CELLS_MOVED',
};

// DPDConsole uses mxUtils.bind as a cross-browser alternative to Function.bind.
global.mxUtils = {
  bind: (ctx, fn) => fn.bind(ctx),
};

// Overlay types used by highlightViolatingEdges to render numbered badges on edges.
global.mxCellOverlay = jest.fn(function(image, tooltip, align, verticalAlign, offset) {
  this.image          = image;
  this.tooltip        = tooltip;
  this.align          = align;
  this.verticalAlign  = verticalAlign;
  this.offset         = offset;
});

global.mxImage = jest.fn(function(src, width, height) {
  this.src    = src;
  this.width  = width;
  this.height = height;
});

global.mxPoint = jest.fn(function(x, y) {
  this.x = x;
  this.y = y;
});

// Alignment constants passed to mxCellOverlay for badge positioning.
global.mxConstants = {
  ALIGN_CENTER: 'center',
  ALIGN_MIDDLE: 'middle',
};

// Creates a minimal graph cell. isVertex and isEdge are separate flags because
// mxGraph uses duck-typing rather than instanceof checks.
global.createMockCell = ({ isVertex = false, isEdge = false, id = 1 } = {}) => ({
  id,
  _isVertex: isVertex,
  _isEdge:   isEdge,
  parent:    null,
  _children: [],
  value:     null,
  style:     '',
  getAttribute: jest.fn(() => null),
  setAttribute: jest.fn(),
});

// Creates a minimal graph model. fireChange() is a test helper that dispatches
// a synthetic CHANGE event to listeners registered via addListener().
global.createMockModel = () => {
  const listeners = {};
  const root = { id: '0', _children: [], parent: null };

  return {
    _listeners: listeners,
    _root: root,
    addListener: jest.fn((event, callback) => { listeners[event] = callback; }),
    isVertex:      jest.fn((cell) => cell && cell._isVertex === true),
    isEdge:        jest.fn((cell) => cell && cell._isEdge === true),
    getTerminal:   jest.fn((edge, isSource) => isSource ? edge._source : edge._target),
    getValue:      jest.fn((cell) => cell ? cell.value : null),
    setValue:      jest.fn((cell, value) => { if (cell) cell.value = value; }),
    getParent:     jest.fn((cell) => cell ? cell.parent : null),
    getRoot:       jest.fn(() => root),
    getChildCount: jest.fn((cell) => cell && cell._children ? cell._children.length : 0),
    getChildAt:    jest.fn((cell, i) => cell && cell._children ? cell._children[i] : null),
    beginUpdate:   jest.fn(),
    endUpdate:     jest.fn(),

    fireChange(changes) {
      const cb = listeners[mxEvent.CHANGE];
      if (cb) cb({}, { getProperty: (k) => k === 'edit' ? { changes } : null });
    },
  };
};

// Creates a minimal graph. Includes all methods that dpd.js calls during
// validation and highlighting.
global.createMockGraph = (model) => ({
  getModel:           jest.fn(() => model),
  isValidConnection:  jest.fn(() => true),
  addListener:        jest.fn(),
  setEnabled:         jest.fn(),
  setCellStyle:       jest.fn(),
  removeCellOverlays: jest.fn(),
  addCellOverlay:     jest.fn(),
  popupMenuHandler: { factoryMethod: jest.fn(() => null) },
});

// Stubs the DPD console panel that EditorUi creates before the plugin loads.
// Tests can assert which violations were reported via addViolation.mock.calls.
global.createMockDPDConsole = () => ({
  addViolation:            jest.fn(),
  clear:                   jest.fn(),
  setHighlightToggleState: jest.fn(),
  _clearHookSet:  false,
  onClear:        null,
  onToggleHighlights: null,
});

// Captures the plugin function passed to Draw.loadPlugin so tests can invoke
// it against a controlled ui object.
global.Draw = {
  _pluginFn: null,
  loadPlugin: jest.fn((fn) => { Draw._pluginFn = fn; }),
  runPlugin(ui) {
    if (!Draw._pluginFn) throw new Error('No plugin loaded — did you require the plugin file?');
    Draw._pluginFn(ui);
  },
};

// Suppress any residual alert() calls so they do not interrupt the test runner.
global.alert = jest.fn();

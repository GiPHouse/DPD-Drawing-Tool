/**
 * Global test setup — injects mxGraph globals and the Draw.loadPlugin shim
 * so plugin files can be required in a Node/Jest environment without a browser.
 */

// ── mxEvent ──────────────────────────────────────────────────────────────────
global.mxEvent = {
  CHANGE: 'CHANGE',
};

// ── Minimal mxGraph cell factory ─────────────────────────────────────────────
global.createMockCell = ({ isVertex = false, isEdge = false, id = 1 } = {}) => ({
  id,
  _isVertex: isVertex,
  _isEdge: isEdge,
  parent: null,
  _children: [],
  value: null,
  style: '',
  getAttribute: jest.fn((key) => null),
  setAttribute: jest.fn(),
});

// ── Minimal mxGraph model factory ────────────────────────────────────────────
global.createMockModel = () => {
  const listeners = {};
  const root = {
    id: '0',
    _children: [],
    parent: null,
  };

  return {
    _listeners: listeners,
    _root: root,
    addListener: jest.fn((event, callback) => {
      listeners[event] = callback;
    }),
    isVertex: jest.fn((cell) => cell && cell._isVertex === true),
    isEdge: jest.fn((cell) => cell && cell._isEdge === true),
    getTerminal: jest.fn((edge, isSource) => isSource ? edge._source : edge._target),
    getValue: jest.fn((cell) => (cell ? cell.value : null)),
    setValue: jest.fn((cell, value) => {
      if (cell) cell.value = value;
    }),
    getParent: jest.fn((cell) => (cell ? cell.parent : null)),
    getRoot: jest.fn(() => root),
    getChildCount: jest.fn((cell) => ((cell && cell._children) ? cell._children.length : 0)),
    getChildAt: jest.fn((cell, index) => ((cell && cell._children) ? cell._children[index] : null)),
    beginUpdate: jest.fn(),
    endUpdate: jest.fn(),

    // Helper used in tests to fire a synthetic CHANGE event
    fireChange: function (changes) {
      const callback = listeners[mxEvent.CHANGE];
      if (callback) {
        const evt = {
          getProperty: (key) => key === 'edit' ? { changes } : null,
        };
        callback({}, evt);
      }
    },
  };
};

// ── Minimal graph factory ─────────────────────────────────────────────────────
global.createMockGraph = (model) => ({
  getModel: jest.fn(() => model),
  isValidConnection: jest.fn(() => true),
  popupMenuHandler: {
    factoryMethod: jest.fn(() => null),
  },
});

// ── Draw.loadPlugin shim ──────────────────────────────────────────────────────
// Captures the plugin function so tests can call it with a controlled ui object.
global.Draw = {
  _pluginFn: null,
  loadPlugin: jest.fn((fn) => {
    Draw._pluginFn = fn;
  }),
  // Helper: run the plugin against a mock ui and return the model so tests
  // can fire events.
  runPlugin: function (ui) {
    if (!Draw._pluginFn) throw new Error('No plugin loaded — did you require the plugin file?');
    Draw._pluginFn(ui);
  },
};

// ── Silence alert() — the plugin currently calls alert() on load ──────────────
global.alert = jest.fn();

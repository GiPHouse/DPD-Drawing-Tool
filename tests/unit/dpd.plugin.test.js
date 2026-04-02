/**
 * Unit tests for the DPD Draw.io plugin (dpd.js)
 *
 * These tests exercise the plugin's model event handling logic in isolation by
 * mocking the mxGraph objects (graph, model, cells) defined in setup.js.
 *
 * To run:
 *   cd tests/unit && npm install && npm test
 *
 * Coverage goals:
 *   - Vertex lifecycle: add / move / resize / remove
 *   - Edge connection (valid and invalid)
 *   - Duplicate-connection guard (loggedEdges WeakSet)
 *   - DPD rule stubs (expand as Sprint 2 rule logic is implemented)
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build and initialise the plugin, returning the model so tests can fire events.
 */
function loadPlugin() {
  // Re-require each time so the plugin closure is fresh
  jest.resetModules();
  Draw._pluginFn = null;

  require('../../drawio app/src/main/webapp/plugins/dpd.js');

  const model = createMockModel();
  const graph = createMockGraph(model);
  const ui   = { editor: { graph } };

  Draw.runPlugin(ui);
  return model;
}

// ── Change-object factories ───────────────────────────────────────────────────

const makeChildChange = ({ child, previous = null } = {}) => ({
  constructor: { name: 'mxChildChange' },
  child,
  previous,
});

const makeGeometryChange = ({ cell, oldGeo, newGeo }) => ({
  constructor: { name: 'mxGeometryChange' },
  cell,
  previous: oldGeo,
  geometry: newGeo,
});

const makeTerminalChange = ({ cell } = {}) => ({
  constructor: { name: 'mxTerminalChange' },
  cell,
});

const geo = (x, y, w, h) => ({ x, y, width: w, height: h });

// ── Plugin initialisation ─────────────────────────────────────────────────────

describe('Plugin initialisation', () => {
  it('registers a listener for mxEvent.CHANGE', () => {
    const model = loadPlugin();
    expect(model.addListener).toHaveBeenCalledWith(mxEvent.CHANGE, expect.any(Function));
  });

  it('logs DPD plugin startup messages to the console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    loadPlugin();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[DPD] Plugin loading'));
    spy.mockRestore();
  });
});

// ── Edge connection ───────────────────────────────────────────────────────────

describe('Connection created', () => {
  it('schedules edge annotation when both endpoints exist', () => {
    const model  = loadPlugin();
    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => 0);

    const source = createMockCell({ isVertex: true, id: 1 });
    const target = createMockCell({ isVertex: true, id: 2 });
    const edge   = createMockCell({ isEdge: true,   id: 3 });
    edge._source = source;
    edge._target = target;

    model.fireChange([makeTerminalChange({ cell: edge })]);

    const hasAnnotationSchedule = timeoutSpy.mock.calls.some(([, delay]) => delay === 150);
    expect(hasAnnotationSchedule).toBe(true);
    timeoutSpy.mockRestore();
  });

  it('does NOT log a connection when source is missing', () => {
    const model  = loadPlugin();
    const spy    = jest.spyOn(console, 'log').mockImplementation(() => {});

    const target = createMockCell({ isVertex: true, id: 2 });
    const edge   = createMockCell({ isEdge: true,   id: 3 });
    edge._source = null;
    edge._target = target;

    model.fireChange([makeTerminalChange({ cell: edge })]);

    expect(spy).not.toHaveBeenCalledWith('Connection created: ', expect.anything());
    spy.mockRestore();
  });

  it('does NOT log a connection when target is missing', () => {
    const model  = loadPlugin();
    const spy    = jest.spyOn(console, 'log').mockImplementation(() => {});

    const source = createMockCell({ isVertex: true, id: 1 });
    const edge   = createMockCell({ isEdge: true,   id: 3 });
    edge._source = source;
    edge._target = null;

    model.fireChange([makeTerminalChange({ cell: edge })]);

    expect(spy).not.toHaveBeenCalledWith('Connection created: ', expect.anything());
    spy.mockRestore();
  });
});

// ── DPD Rule Enforcement stubs ────────────────────────────────────────────────
// These are placeholder tests intended to grow as Sprint 2 rule logic is
// implemented in dpd.js (issues #110, #112, #113).
//
// Pattern to follow:
//   1. Give cells the appropriate XML attributes (via cell.getAttribute mock).
//   2. Fire a connection or change event.
//   3. Assert the correct alert / console.warn / custom UI notification fires.

// ── Semantic DPD rules: comprehensive coverage ────────────────────────────────

function makeSemanticValue(attrs = {}) {
  const store = { ...attrs };
  return {
    getAttribute: jest.fn((key) => (store[key] !== undefined ? store[key] : null)),
    setAttribute: jest.fn((key, value) => {
      store[key] = value;
    }),
    cloneNode: jest.fn(() => makeSemanticValue(store)),
  };
}

function makeSemanticNode({ id, type, attrs = {} }) {
  const cell = createMockCell({ isVertex: true, id });
  cell.value = makeSemanticValue({ 'data-type': type, ...attrs });
  return cell;
}

function makeSemanticEdge({ id, source, target, attrs = {} }) {
  const edge = createMockCell({ isEdge: true, id });
  edge._source = source;
  edge._target = target;
  edge.value = makeSemanticValue(attrs);
  return edge;
}

function mountSemanticCells(model, cells) {
  model._root._children = cells;
  cells.forEach((cell) => {
    cell.parent = model._root;
  });
}

function loadSemanticPlugin() {
  jest.resetModules();
  Draw._pluginFn = null;
  document.body.innerHTML = '';

  require('../../drawio app/src/main/webapp/plugins/dpd.js');

  const model = createMockModel();
  const graph = createMockGraph(model);
  const ui = {
    editor: { graph },
    showDialog: jest.fn(),
    hideDialog: jest.fn(),
  };

  Draw.runPlugin(ui);
  jest.advanceTimersByTime(1600);

  return { model, graph, ui };
}

function runSemanticValidationFromButton() {
  const button = document.getElementById('dpd-validate-btn');
  expect(button).toBeTruthy();
  button.click();
}

function getSemanticValidationDialogText(ui) {
  expect(ui.showDialog).toHaveBeenCalled();
  const dialog = ui.showDialog.mock.calls[ui.showDialog.mock.calls.length - 1][0];
  return dialog.textContent;
}

describe('DPD semantic rules', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.alert.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Structural connection validation (R-S1..R-S3)', () => {
    it('blocks data_store to data_store (R-S1)', () => {
      const { graph } = loadSemanticPlugin();
      const storeA = makeSemanticNode({ id: 1, type: 'data_store' });
      const storeB = makeSemanticNode({ id: 2, type: 'data_store' });

      const allowed = graph.isValidConnection(storeA, storeB);

      expect(allowed).toBe(false);
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('R-S1 Error'));
    });

    it('blocks external_entity to external_entity (R-S2)', () => {
      const { graph } = loadSemanticPlugin();
      const extA = makeSemanticNode({ id: 10, type: 'external_entity' });
      const extB = makeSemanticNode({ id: 11, type: 'external_entity' });

      const allowed = graph.isValidConnection(extA, extB);

      expect(allowed).toBe(false);
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('R-S2 Error'));
    });

    it('blocks data_store to external_entity (R-S3)', () => {
      const { graph } = loadSemanticPlugin();
      const store = makeSemanticNode({ id: 12, type: 'data_store' });
      const external = makeSemanticNode({ id: 13, type: 'external_entity' });

      const allowed = graph.isValidConnection(store, external);

      expect(allowed).toBe(false);
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('R-S3 Error'));
    });

    it('allows process to data_store connections', () => {
      const { graph } = loadSemanticPlugin();
      const process = makeSemanticNode({ id: 20, type: 'process' });
      const store = makeSemanticNode({ id: 21, type: 'data_store' });

      const allowed = graph.isValidConnection(process, store);

      expect(allowed).toBe(true);
      expect(global.alert).not.toHaveBeenCalled();
    });
  });

  describe('Full graph semantic validation (R-S4, R-I*, R-L*, R-P*)', () => {
    it('reports missing identifiability annotation (R-S4)', () => {
      const { model, ui } = loadSemanticPlugin();
      const processA = makeSemanticNode({ id: 30, type: 'process' });
      const processB = makeSemanticNode({ id: 31, type: 'process' });
      const edge = makeSemanticEdge({
        id: 32,
        source: processA,
        target: processB,
        attrs: { linkability: 'locally_linkable', pseudonymity: 'none' },
      });

      mountSemanticCells(model, [processA, processB, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-S4');
    });

    it('reports process input identifiability constraint violation (R-I1)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({ id: 40, type: 'external_entity' });
      const target = makeSemanticNode({
        id: 41,
        type: 'process',
        attrs: { accepts_max_identifiability: 'de_identified' },
      });
      const edge = makeSemanticEdge({
        id: 42,
        source,
        target,
        attrs: {
          identifiability: 'directly_identifiable',
          linkability: 'universally_linkable',
          pseudonymity: 'none',
        },
      });

      mountSemanticCells(model, [source, target, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-I1');
    });

    it('reports process output identifiability constraint violation (R-I2)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({
        id: 43,
        type: 'process',
        attrs: { outputs_max_identifiability: 'de_identified' },
      });
      const target = makeSemanticNode({ id: 44, type: 'external_entity' });
      const edge = makeSemanticEdge({
        id: 45,
        source,
        target,
        attrs: {
          identifiability: 'directly_identifiable',
          linkability: 'universally_linkable',
          pseudonymity: 'none',
        },
      });

      mountSemanticCells(model, [source, target, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-I2');
    });

    it('reports data store identifiability constraint violation (R-I3)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({ id: 46, type: 'process' });
      const store = makeSemanticNode({
        id: 47,
        type: 'data_store',
        attrs: { stores_max_identifiability: 'de_identified' },
      });
      const edge = makeSemanticEdge({
        id: 48,
        source,
        target: store,
        attrs: {
          identifiability: 'directly_identifiable',
          linkability: 'universally_linkable',
          pseudonymity: 'none',
        },
      });

      mountSemanticCells(model, [source, store, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-I3');
    });

    it('reports identifiable data with weak linkability (R-I4)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({ id: 49, type: 'process' });
      const target = makeSemanticNode({ id: 53, type: 'process' });
      const edge = makeSemanticEdge({
        id: 54,
        source,
        target,
        attrs: {
          identifiability: 'indirectly_identifiable',
          linkability: 'locally_linkable',
          pseudonymity: 'none',
        },
      });

      mountSemanticCells(model, [source, target, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-I4');
    });

    it('reports process input linkability constraint violation (R-L1)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({ id: 55, type: 'external_entity' });
      const target = makeSemanticNode({
        id: 56,
        type: 'process',
        attrs: { accepts_max_linkability: 'locally_linkable' },
      });
      const edge = makeSemanticEdge({
        id: 57,
        source,
        target,
        attrs: {
          identifiability: 'de_identified',
          linkability: 'universally_linkable',
          pseudonymity: 'none',
        },
      });

      mountSemanticCells(model, [source, target, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-L1');
    });

    it('reports de-identified but universally linkable warning (R-L2)', () => {
      const { model, ui } = loadSemanticPlugin();
      const processA = makeSemanticNode({ id: 50, type: 'process' });
      const processB = makeSemanticNode({ id: 51, type: 'process' });
      const edge = makeSemanticEdge({
        id: 52,
        source: processA,
        target: processB,
        attrs: {
          identifiability: 'de_identified',
          linkability: 'universally_linkable',
          pseudonymity: 'none',
        },
      });

      mountSemanticCells(model, [processA, processB, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-L2');
    });

    it('reports pseudonymous data with non-local linkability (R-P2)', () => {
      const { model, ui } = loadSemanticPlugin();
      const processA = makeSemanticNode({ id: 60, type: 'process' });
      const processB = makeSemanticNode({ id: 61, type: 'process' });
      const edge = makeSemanticEdge({
        id: 62,
        source: processA,
        target: processB,
        attrs: {
          identifiability: 'de_identified',
          linkability: 'universally_linkable',
          pseudonymity: 'strict_pseudonymous',
        },
      });

      mountSemanticCells(model, [processA, processB, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-P2');
    });

    it('reports directly identifiable pseudonymous data (R-P1)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({ id: 63, type: 'process' });
      const target = makeSemanticNode({ id: 64, type: 'process' });
      const edge = makeSemanticEdge({
        id: 65,
        source,
        target,
        attrs: {
          identifiability: 'directly_identifiable',
          linkability: 'locally_linkable',
          pseudonymity: 'soft_pseudonymous',
        },
      });

      mountSemanticCells(model, [source, target, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-P1');
    });

    it('reports strict pseudonymous data that is not de-identified (R-P3)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({ id: 66, type: 'process' });
      const target = makeSemanticNode({ id: 67, type: 'process' });
      const edge = makeSemanticEdge({
        id: 68,
        source,
        target,
        attrs: {
          identifiability: 'indirectly_identifiable',
          linkability: 'locally_linkable',
          pseudonymity: 'strict_pseudonymous',
        },
      });

      mountSemanticCells(model, [source, target, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-P3');
    });

    it('reports soft pseudonymous data with wrong identifiability (R-P4)', () => {
      const { model, ui } = loadSemanticPlugin();
      const source = makeSemanticNode({ id: 69, type: 'process' });
      const target = makeSemanticNode({ id: 75, type: 'process' });
      const edge = makeSemanticEdge({
        id: 76,
        source,
        target,
        attrs: {
          identifiability: 'de_identified',
          linkability: 'locally_linkable',
          pseudonymity: 'soft_pseudonymous',
        },
      });

      mountSemanticCells(model, [source, target, edge]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-P4');
    });

    it('reports identifiability decrease across a data store (R-I5)', () => {
      const { model, ui } = loadSemanticPlugin();
      const inProcess = makeSemanticNode({ id: 70, type: 'process' });
      const outProcess = makeSemanticNode({ id: 71, type: 'process' });
      const store = makeSemanticNode({ id: 72, type: 'data_store' });

      const incoming = makeSemanticEdge({
        id: 73,
        source: inProcess,
        target: store,
        attrs: {
          identifiability: 'directly_identifiable',
          linkability: 'universally_linkable',
          pseudonymity: 'none',
        },
      });

      const outgoing = makeSemanticEdge({
        id: 74,
        source: store,
        target: outProcess,
        attrs: {
          identifiability: 'de_identified',
          linkability: 'unlinkable',
          pseudonymity: 'none',
        },
      });

      mountSemanticCells(model, [inProcess, outProcess, store, incoming, outgoing]);
      runSemanticValidationFromButton();

      const text = getSemanticValidationDialogText(ui);
      expect(text).toContain('R-I5');
    });
  });
});

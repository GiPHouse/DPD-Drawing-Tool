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

describe('DPD rule enforcement (stubs — expand in Sprint 2)', () => {
  it.todo('rejects a connection between two shapes of incompatible DPD types');
  it.todo('allows a valid connection between compatible DPD shapes');
  it.todo('shows a custom alert when a required attribute is missing on a shape');
  it.todo('does not show an alert when all required attributes are present');
  it.todo('enforces cardinality: a shape cannot have more connections than its DPD type allows');
});

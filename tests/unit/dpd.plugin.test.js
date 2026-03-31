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

  it('logs "DPD Plugin Loaded" to the console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    loadPlugin();
    expect(spy).toHaveBeenCalledWith('DPD Plugin Loaded');
    spy.mockRestore();
  });

  it('shows the startup alert', () => {
    loadPlugin();
    expect(global.alert).toHaveBeenCalledWith('DPD plugin successfully launched');
  });
});

// ── Vertex lifecycle ──────────────────────────────────────────────────────────

describe('Vertex added', () => {
  it('logs "Vertex added" when a new vertex is inserted (no previous parent)', () => {
    const model = loadPlugin();
    const spy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cell  = createMockCell({ isVertex: true });

    model.fireChange([makeChildChange({ child: cell, previous: null })]);

    expect(spy).toHaveBeenCalledWith('Vertex added: ', cell);
    spy.mockRestore();
  });

  it('does NOT log "Vertex added" for edges', () => {
    const model = loadPlugin();
    const spy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    const edge  = createMockCell({ isEdge: true });

    model.fireChange([makeChildChange({ child: edge, previous: null })]);

    expect(spy).not.toHaveBeenCalledWith('Vertex added: ', edge);
    spy.mockRestore();
  });
});

describe('Vertex removed', () => {
  it('logs "Vertex removed" when a vertex is deleted (has a previous parent)', () => {
    const model  = loadPlugin();
    const spy    = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cell   = createMockCell({ isVertex: true });
    const parent = createMockCell();

    model.fireChange([makeChildChange({ child: cell, previous: parent })]);

    expect(spy).toHaveBeenCalledWith('Vertex removed: ', cell);
    spy.mockRestore();
  });
});

describe('Vertex moved', () => {
  it('logs "Vertex moved" when only position changes', () => {
    const model = loadPlugin();
    const spy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cell  = createMockCell({ isVertex: true });

    model.fireChange([
      makeGeometryChange({
        cell,
        oldGeo: geo(10, 10, 100, 50),
        newGeo: geo(20, 20, 100, 50),   // position changed, size same
      }),
    ]);

    expect(spy).toHaveBeenCalledWith('Vertex moved:', cell);
    spy.mockRestore();
  });

  it('does NOT log "Vertex moved" when only size changes', () => {
    const model = loadPlugin();
    const spy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cell  = createMockCell({ isVertex: true });

    model.fireChange([
      makeGeometryChange({
        cell,
        oldGeo: geo(10, 10, 100, 50),
        newGeo: geo(10, 10, 200, 80),   // size changed, position same
      }),
    ]);

    expect(spy).not.toHaveBeenCalledWith('Vertex moved:', cell);
    spy.mockRestore();
  });
});

describe('Vertex resized', () => {
  it('logs "Vertex resized" when width or height changes', () => {
    const model = loadPlugin();
    const spy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cell  = createMockCell({ isVertex: true });

    model.fireChange([
      makeGeometryChange({
        cell,
        oldGeo: geo(10, 10, 100, 50),
        newGeo: geo(10, 10, 200, 80),
      }),
    ]);

    expect(spy).toHaveBeenCalledWith('Vertex resized:', cell);
    spy.mockRestore();
  });

  it('does NOT log "Vertex resized" when only position changes', () => {
    const model = loadPlugin();
    const spy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cell  = createMockCell({ isVertex: true });

    model.fireChange([
      makeGeometryChange({
        cell,
        oldGeo: geo(10, 10, 100, 50),
        newGeo: geo(30, 30, 100, 50),
      }),
    ]);

    expect(spy).not.toHaveBeenCalledWith('Vertex resized:', cell);
    spy.mockRestore();
  });
});

// ── Edge connection ───────────────────────────────────────────────────────────

describe('Connection created', () => {
  it('logs "Connection created" when both endpoints exist', () => {
    const model  = loadPlugin();
    const spy    = jest.spyOn(console, 'log').mockImplementation(() => {});

    const source = createMockCell({ isVertex: true, id: 1 });
    const target = createMockCell({ isVertex: true, id: 2 });
    const edge   = createMockCell({ isEdge: true,   id: 3 });
    edge._source = source;
    edge._target = target;

    model.fireChange([makeTerminalChange({ cell: edge })]);

    expect(spy).toHaveBeenCalledWith('Connection created: ', { source, target, edge });
    spy.mockRestore();
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

describe('Duplicate connection guard', () => {
  it('only logs a connection once for the same edge object', () => {
    const model  = loadPlugin();
    const spy    = jest.spyOn(console, 'log').mockImplementation(() => {});

    const source = createMockCell({ isVertex: true, id: 1 });
    const target = createMockCell({ isVertex: true, id: 2 });
    const edge   = createMockCell({ isEdge: true,   id: 3 });
    edge._source = source;
    edge._target = target;

    // Fire the same terminal change twice (simulates draw.io internal double-fire)
    model.fireChange([makeTerminalChange({ cell: edge })]);
    model.fireChange([makeTerminalChange({ cell: edge })]);

    const connectionLogs = spy.mock.calls.filter(
      (args) => args[0] === 'Connection created: '
    );
    expect(connectionLogs).toHaveLength(1);
    spy.mockRestore();
  });
});

// ── Geometry change edge cases ────────────────────────────────────────────────

describe('Geometry change edge cases', () => {
  it('skips geometry changes with missing previous or new geometry', () => {
    const model = loadPlugin();
    const spy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cell  = createMockCell({ isVertex: true });

    model.fireChange([
      makeGeometryChange({ cell, oldGeo: null, newGeo: geo(10, 10, 100, 50) }),
    ]);
    model.fireChange([
      makeGeometryChange({ cell, oldGeo: geo(10, 10, 100, 50), newGeo: null }),
    ]);

    expect(spy).not.toHaveBeenCalledWith('Vertex moved:', cell);
    expect(spy).not.toHaveBeenCalledWith('Vertex resized:', cell);
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

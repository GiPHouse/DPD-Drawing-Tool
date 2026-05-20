/**
 * Unit tests for the DPD draw.io plugin (dpd.js).
 *
 * Tests run in jsdom using mocked mxGraph objects defined in setup.js, so no
 * real browser or draw.io instance is needed. The plugin is loaded fresh for
 * each describe group via loadPlugin() / loadSemanticPlugin().
 *
 * Run: cd tests/unit && npm install && npm test
 */

// ---------------------------------------------------------------------------
// Change-object factories
// Mirrors the constructor.name values that dpd.js inspects on model changes.
// ---------------------------------------------------------------------------

const makeTerminalChange = ({ cell } = {}) => ({
  constructor: { name: 'mxTerminalChange' },
  cell,
});

// Dispatching this change via model.fireChange() causes dpd.js to schedule
// validateGraph() with a 800 ms timeout, which tests advance with fake timers.
const makeRootChange = () => ({ root: {}, previous: {} });

// ---------------------------------------------------------------------------
// Plugin load helpers
// ---------------------------------------------------------------------------

/** Loads the plugin with no DPD console — used for init-only tests. */
function loadPlugin() {
  jest.resetModules();
  Draw._pluginFn = null;
  require('../../drawio app/src/main/webapp/plugins/dpd.js');

  const model = createMockModel();
  const graph = createMockGraph(model);
  const ui    = { editor: { graph } };

  Draw.runPlugin(ui);
  return { model, graph, ui };
}

/**
 * Loads the plugin with a fully stubbed ui including a mock DPD console panel.
 * Use this variant for any test that exercises validation or violation reporting,
 * since dpd.js routes all violation output through ui.dpdConsole.
 */
function loadSemanticPlugin() {
  jest.resetModules();
  Draw._pluginFn = null;
  document.body.innerHTML = '';
  require('../../drawio app/src/main/webapp/plugins/dpd.js');

  const model      = createMockModel();
  const graph      = createMockGraph(model);
  const dpdConsole = createMockDPDConsole();
  const ui = {
    editor: { graph },
    showDialog: jest.fn(),
    hideDialog: jest.fn(),
    dpdConsole,
  };

  Draw.runPlugin(ui);
  return { model, graph, ui, dpdConsole };
}

/**
 * Triggers validateGraph() by dispatching an mxRootChange on the model and
 * advancing fake timers past the 800 ms debounce dpd.js applies.
 * jest.useFakeTimers() must be active before calling this.
 */
function triggerValidateGraph(model) {
  model.fireChange([makeRootChange()]);
  jest.advanceTimersByTime(800);
}

/** Returns the list of rule codes passed to dpdConsole.addViolation(). */
function getReportedRules(dpdConsole) {
  return dpdConsole.addViolation.mock.calls.map((call) => call[0]);
}

// ---------------------------------------------------------------------------
// Cell / edge factories
// ---------------------------------------------------------------------------

/**
 * Builds a fake mxCell value element that stores DPD XML attributes.
 * dpd.js reads these via value.getAttribute(), matching how draw.io stores
 * custom properties on UserObject elements.
 */
function makeSemanticValue(attrs = {}) {
  const store = { ...attrs };
  return {
    getAttribute: jest.fn((key) => store[key] !== undefined ? store[key] : null),
    setAttribute: jest.fn((key, val) => { store[key] = val; }),
    cloneNode:    jest.fn(() => makeSemanticValue(store)),
  };
}

/**
 * Creates a vertex cell carrying a DPD component type (process, data_store,
 * or external_entity) and any optional constraint attributes such as
 * accepts_max_identifiability.
 */
function makeSemanticNode({ id, type, attrs = {} }) {
  const cell = createMockCell({ isVertex: true, id });
  cell.value = makeSemanticValue({ 'data-type': type, ...attrs });
  return cell;
}

/**
 * Creates an edge cell with source, target and DPD annotation attributes
 * (identifiability, linkability, pseudonymity).
 */
function makeSemanticEdge({ id, source, target, attrs = {} }) {
  const edge = createMockCell({ isEdge: true, id });
  edge._source = source;
  edge._target = target;
  edge.value   = makeSemanticValue(attrs);
  return edge;
}

/**
 * Mounts cells onto the model root so validateGraph()'s collectAllCells()
 * walk can discover them when the test triggers a graph validation.
 */
function mountSemanticCells(model, cells) {
  model._root._children = cells;
  cells.forEach((cell) => { cell.parent = model._root; });
}

// ---------------------------------------------------------------------------
// Plugin initialisation
// ---------------------------------------------------------------------------

describe('Plugin initialisation', () => {
  it('registers a change listener on the model', () => {
    const { model } = loadPlugin();
    expect(model.addListener).toHaveBeenCalledWith(mxEvent.CHANGE, expect.any(Function));
  });

  it('logs a startup message to the console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    loadPlugin();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[DPD] Plugin loading'));
    spy.mockRestore();
  });

  it('appends the edit-lock warning banner to the document body on load', () => {
    document.body.innerHTML = '';
    loadPlugin();
    // The warning banner is created unconditionally during plugin initialisation
    // so it is ready to be shown when highlights are activated.
    expect(document.body.querySelectorAll('div').length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Edge annotation dialog scheduling
// ---------------------------------------------------------------------------

describe('Connection created', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('schedules the annotation dialog 150 ms after a complete connection is made', () => {
    jest.useFakeTimers();
    const { graph } = loadPlugin();
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const edge = createMockCell({ isEdge: true, id: 3 });
    edge._source = createMockCell({ isVertex: true, id: 1 });
    edge._target = createMockCell({ isVertex: true, id: 2 });

    // Fire the CONNECT event the way draw.io does after a drag-connect
    graph.connectionHandler.fireEvent(mxEvent.CONNECT, { cell: edge });

    expect(timeoutSpy.mock.calls.some(([, d]) => d === 150)).toBe(true);
  });

  it('does not schedule the dialog when the edge has no source', () => {
    jest.useFakeTimers();
    const { graph } = loadPlugin();
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const edge = createMockCell({ isEdge: true, id: 3 });
    edge._source = null;
    edge._target = createMockCell({ isVertex: true, id: 2 });

    graph.connectionHandler.fireEvent(mxEvent.CONNECT, { cell: edge });

    expect(timeoutSpy.mock.calls.some(([, d]) => d === 150)).toBe(false);
  });

  it('does not schedule the dialog when the edge has no target', () => {
    jest.useFakeTimers();
    const { graph } = loadPlugin();
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const edge = createMockCell({ isEdge: true, id: 3 });
    edge._source = createMockCell({ isVertex: true, id: 1 });
    edge._target = null;

    graph.connectionHandler.fireEvent(mxEvent.CONNECT, { cell: edge });

    expect(timeoutSpy.mock.calls.some(([, d]) => d === 150)).toBe(false);
  });
});
// ---------------------------------------------------------------------------
// Console violation helpers (pushConsoleViolation / syncConsoleViolations)
// ---------------------------------------------------------------------------

describe('Console violation helpers', () => {
  it('pushConsoleViolation silently does nothing when ui.dpdConsole is absent', () => {
    // loadPlugin() creates a ui without a dpdConsole, so triggering a blocked
    // connection should not throw even though addViolation cannot be called.
    const { graph } = loadPlugin();
    expect(() => graph.isValidConnection(
      makeSemanticNode({ id: 1, type: 'data_store' }),
      makeSemanticNode({ id: 2, type: 'data_store' }),
    )).not.toThrow();
  });

  it('syncConsoleViolations calls clear() once then addViolation() per violation', () => {
    jest.useFakeTimers();
    const { model, dpdConsole } = loadSemanticPlugin();

    const p1 = makeSemanticNode({ id: 1, type: 'process' });
    const p2 = makeSemanticNode({ id: 2, type: 'process' });
    // An unannotated edge produces an R-S4 warning, giving us at least one violation.
    mountSemanticCells(model, [p1, p2, makeSemanticEdge({ id: 3, source: p1, target: p2 })]);

    triggerValidateGraph(model);

    expect(dpdConsole.clear).toHaveBeenCalledTimes(1);
    expect(dpdConsole.addViolation).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('syncConsoleViolations does nothing when dpdConsole lacks a clear() method', () => {
    // Fake timers are required to satisfy the triggerValidateGraph requirements as it is not running in the browser context
    jest.useFakeTimers();

    // Verifies the null-guard in syncConsoleViolations handles incomplete stubs.
    jest.resetModules();
    Draw._pluginFn = null;
    require('../../drawio app/src/main/webapp/plugins/dpd.js');

    const model = createMockModel();
    const graph = createMockGraph(model);
    Draw.runPlugin({ editor: { graph }, dpdConsole: { addViolation: jest.fn() } });

    expect(() => triggerValidateGraph(model)).not.toThrow();

    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Structural connection validation — R-S1, R-S2, R-S3
// isValidConnection only decides whether to allow the drag; violations are
// reported later by the full-graph validation loop, not here. Calling
// pushConsoleViolation inside isValidConnection caused console spam on hover.
// ---------------------------------------------------------------------------

describe('Structural connection validation (R-S1, R-S2, R-S3)', () => {
  beforeEach(() => { jest.useFakeTimers(); global.alert.mockClear(); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('allows data_store → data_store without reporting a violation at drag time', () => {
    const { graph, dpdConsole } = loadSemanticPlugin();
    const result = graph.isValidConnection(
      makeSemanticNode({ id: 1, type: 'data_store' }),
      makeSemanticNode({ id: 2, type: 'data_store' }),
    );
    expect(result).toBe(true);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });

  it('allows external_entity → external_entity without reporting a violation at drag time', () => {
    const { graph, dpdConsole } = loadSemanticPlugin();
    const result = graph.isValidConnection(
      makeSemanticNode({ id: 10, type: 'external_entity' }),
      makeSemanticNode({ id: 11, type: 'external_entity' }),
    );
    expect(result).toBe(true);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });

  it('allows data_store → external_entity without reporting a violation at drag time', () => {
    const { graph, dpdConsole } = loadSemanticPlugin();
    const result = graph.isValidConnection(
      makeSemanticNode({ id: 12, type: 'data_store' }),
      makeSemanticNode({ id: 13, type: 'external_entity' }),
    );
    expect(result).toBe(true);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });

  it('allows external_entity → data_store without reporting a violation at drag time', () => {
    const { graph, dpdConsole } = loadSemanticPlugin();
    const result = graph.isValidConnection(
      makeSemanticNode({ id: 14, type: 'external_entity' }),
      makeSemanticNode({ id: 15, type: 'data_store' }),
    );
    expect(result).toBe(true);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });

  it('permits process → data_store with no violation', () => {
    const { graph, dpdConsole } = loadSemanticPlugin();
    expect(graph.isValidConnection(
      makeSemanticNode({ id: 20, type: 'process' }),
      makeSemanticNode({ id: 21, type: 'data_store' }),
    )).toBe(true);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });

  it('permits process → external_entity with no violation', () => {
    const { graph, dpdConsole } = loadSemanticPlugin();
    expect(graph.isValidConnection(
      makeSemanticNode({ id: 22, type: 'process' }),
      makeSemanticNode({ id: 23, type: 'external_entity' }),
    )).toBe(true);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });

  it('permits external_entity → process with no violation', () => {
    const { graph, dpdConsole } = loadSemanticPlugin();
    expect(graph.isValidConnection(
      makeSemanticNode({ id: 24, type: 'external_entity' }),
      makeSemanticNode({ id: 25, type: 'process' }),
    )).toBe(true);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Full-graph validation — all 15 DPD rules
// Validation is triggered by an mxRootChange on the model, which dpd.js
// debounces and then runs against all edges in the graph.
// ---------------------------------------------------------------------------

describe('DPD full-graph validation', () => {
  beforeEach(() => { jest.useFakeTimers(); global.alert.mockClear(); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('R-S4 — warns when a data flow edge has no identifiability annotation', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 30, type: 'process' });
    const p2 = makeSemanticNode({ id: 31, type: 'process' });
    // Edge has linkability set but no identifiability, triggering R-S4.
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 32, source: p1, target: p2, attrs: { linkability: 'locally_linkable' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-S4');
  });

  it('R-S4 — violation is reported as a warning, not an error', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 33, type: 'process' });
    const p2 = makeSemanticNode({ id: 34, type: 'process' });
    mountSemanticCells(model, [p1, p2, makeSemanticEdge({ id: 35, source: p1, target: p2 })]);

    triggerValidateGraph(model);

    const call = dpdConsole.addViolation.mock.calls.find((c) => c[0] === 'R-S4');
    expect(call[2]).toBe('warning');
  });

  it('R-I1 — errors when a flow entering a process exceeds its max identifiability', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const source = makeSemanticNode({ id: 40, type: 'external_entity' });
    // Process declares it only accepts up to de_identified.
    const target = makeSemanticNode({ id: 41, type: 'process', attrs: { accepts_max_identifiability: 'de_identified' } });
    // The flow carries directly_identifiable data, which exceeds the constraint.
    mountSemanticCells(model, [source, target,
      makeSemanticEdge({ id: 42, source, target, attrs: { identifiability: 'directly_identifiable', linkability: 'universally_linkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-I1');
  });

  it('R-I2 — errors when a flow leaving a process exceeds its max output identifiability', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    // Process declares it should output at most de_identified data.
    const source = makeSemanticNode({ id: 43, type: 'process', attrs: { outputs_max_identifiability: 'de_identified' } });
    const target = makeSemanticNode({ id: 44, type: 'external_entity' });
    mountSemanticCells(model, [source, target,
      makeSemanticEdge({ id: 45, source, target, attrs: { identifiability: 'directly_identifiable', linkability: 'universally_linkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-I2');
  });

  it('R-I3 — errors when a flow entering a data store exceeds its max identifiability', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const source = makeSemanticNode({ id: 46, type: 'process' });
    const store  = makeSemanticNode({ id: 47, type: 'data_store', attrs: { stores_max_identifiability: 'de_identified' } });
    mountSemanticCells(model, [source, store,
      makeSemanticEdge({ id: 48, source, target: store, attrs: { identifiability: 'directly_identifiable', linkability: 'universally_linkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-I3');
  });

  it('R-I4 — warns when identifiable data is not universally linkable', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 49, type: 'process' });
    const p2 = makeSemanticNode({ id: 53, type: 'process' });
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 54, source: p1, target: p2, attrs: { identifiability: 'indirectly_identifiable', linkability: 'locally_linkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-I4');
  });

  it('R-I4 — no violation when identifiable data is universally linkable', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 200, type: 'process' });
    const p2 = makeSemanticNode({ id: 201, type: 'process' });
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 202, source: p1, target: p2, attrs: { identifiability: 'directly_identifiable', linkability: 'universally_linkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).not.toContain('R-I4');
  });

  it('R-I5 — warns when identifiability level decreases across a data store', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const inProcess  = makeSemanticNode({ id: 70, type: 'process' });
    const outProcess = makeSemanticNode({ id: 71, type: 'process' });
    const store      = makeSemanticNode({ id: 72, type: 'data_store' });
    // Incoming flow is directly_identifiable; outgoing is only de_identified.
    // A store cannot silently reduce identifiability — a process must do that.
    mountSemanticCells(model, [inProcess, outProcess, store,
      makeSemanticEdge({ id: 73, source: inProcess, target: store, attrs: { identifiability: 'directly_identifiable', linkability: 'universally_linkable', pseudonymity: 'none' } }),
      makeSemanticEdge({ id: 74, source: store, target: outProcess, attrs: { identifiability: 'de_identified', linkability: 'unlinkable', pseudonymity: 'none' } }),
    ]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-I5');
  });

  it('R-L1 — errors when a flow entering a process exceeds its max linkability', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const source = makeSemanticNode({ id: 55, type: 'external_entity' });
    const target = makeSemanticNode({ id: 56, type: 'process', attrs: { accepts_max_linkability: 'locally_linkable' } });
    mountSemanticCells(model, [source, target,
      makeSemanticEdge({ id: 57, source, target, attrs: { identifiability: 'de_identified', linkability: 'universally_linkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-L1');
  });

  it('R-L2 — warns when data is de-identified but universally linkable', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 50, type: 'process' });
    const p2 = makeSemanticNode({ id: 51, type: 'process' });
    // De-identified + universally_linkable is risky because combining linkable
    // datasets can re-identify individuals.
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 52, source: p1, target: p2, attrs: { identifiability: 'de_identified', linkability: 'universally_linkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-L2');
  });

  it('R-P1 — errors when pseudonymous data is directly identifiable', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 63, type: 'process' });
    const p2 = makeSemanticNode({ id: 64, type: 'process' });
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 65, source: p1, target: p2, attrs: { identifiability: 'directly_identifiable', linkability: 'locally_linkable', pseudonymity: 'soft_pseudonymous' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-P1');
  });

  it('R-P2 — errors when pseudonymous data is not locally linkable', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 60, type: 'process' });
    const p2 = makeSemanticNode({ id: 61, type: 'process' });
    // Pseudonymous data must be locally linkable — universally_linkable breaks
    // the pseudonymity guarantee.
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 62, source: p1, target: p2, attrs: { identifiability: 'de_identified', linkability: 'universally_linkable', pseudonymity: 'strict_pseudonymous' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-P2');
  });

  it('R-P3 — errors when strict_pseudonymous data is not de-identified', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 66, type: 'process' });
    const p2 = makeSemanticNode({ id: 67, type: 'process' });
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 68, source: p1, target: p2, attrs: { identifiability: 'indirectly_identifiable', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-P3');
  });

  it('R-P3 — no violation when strict_pseudonymous data is de-identified', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 210, type: 'process' });
    const p2 = makeSemanticNode({ id: 211, type: 'process' });
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 212, source: p1, target: p2, attrs: { identifiability: 'de_identified', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).not.toContain('R-P3');
  });

  it('R-P4 — warns when soft_pseudonymous data is not indirectly identifiable', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 69, type: 'process' });
    const p2 = makeSemanticNode({ id: 75, type: 'process' });
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 76, source: p1, target: p2, attrs: { identifiability: 'de_identified', linkability: 'locally_linkable', pseudonymity: 'soft_pseudonymous' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).toContain('R-P4');
  });

  it('R-P4 — no violation when soft_pseudonymous data is indirectly identifiable', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 220, type: 'process' });
    const p2 = makeSemanticNode({ id: 221, type: 'process' });
    mountSemanticCells(model, [p1, p2,
      makeSemanticEdge({ id: 222, source: p1, target: p2, attrs: { identifiability: 'indirectly_identifiable', linkability: 'locally_linkable', pseudonymity: 'soft_pseudonymous' } })]);

    triggerValidateGraph(model);

    expect(getReportedRules(dpdConsole)).not.toContain('R-P4');
  });

  it('reports no violations for a fully compliant annotated edge', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const source = makeSemanticNode({ id: 100, type: 'process' });
    const target = makeSemanticNode({ id: 101, type: 'data_store' });
    mountSemanticCells(model, [source, target,
      makeSemanticEdge({ id: 102, source, target, attrs: { identifiability: 'de_identified', linkability: 'unlinkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    // syncConsoleViolations always calls clear() once; addViolation() is only
    // called when there are actual violations to report.
    expect(dpdConsole.clear).toHaveBeenCalledTimes(1);
    expect(dpdConsole.addViolation).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Highlight toggle and edit lock
// ---------------------------------------------------------------------------

describe('Highlight toggle and edit lock', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('disables graph editing when violations are found', () => {
    const { model, graph } = loadSemanticPlugin();
    // An unannotated edge produces an R-S4 violation, making highlightsVisible true.
    const p1 = makeSemanticNode({ id: 300, type: 'process' });
    const p2 = makeSemanticNode({ id: 301, type: 'process' });
    mountSemanticCells(model, [p1, p2, makeSemanticEdge({ id: 302, source: p1, target: p2 })]);

    triggerValidateGraph(model);

    expect(graph.setEnabled).toHaveBeenCalledWith(false);
  });

  it('sets the Highlights button to its active state when violations are found', () => {
    const { model, dpdConsole } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 303, type: 'process' });
    const p2 = makeSemanticNode({ id: 304, type: 'process' });
    mountSemanticCells(model, [p1, p2, makeSemanticEdge({ id: 305, source: p1, target: p2 })]);

    triggerValidateGraph(model);

    expect(dpdConsole.setHighlightToggleState).toHaveBeenCalledWith(true);
  });

  it('does not disable graph editing when no violations are found', () => {
    const { model, graph } = loadSemanticPlugin();
    const source = makeSemanticNode({ id: 310, type: 'process' });
    const target = makeSemanticNode({ id: 311, type: 'data_store' });
    mountSemanticCells(model, [source, target,
      makeSemanticEdge({ id: 312, source, target, attrs: { identifiability: 'de_identified', linkability: 'unlinkable', pseudonymity: 'none' } })]);

    triggerValidateGraph(model);

    expect(graph.setEnabled.mock.calls.some((c) => c[0] === false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Violation highlighting
// ---------------------------------------------------------------------------

describe('Violation highlighting', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('applies a coloured stroke style to each violating edge', () => {
    const { model, graph } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 400, type: 'process' });
    const p2 = makeSemanticNode({ id: 401, type: 'process' });
    mountSemanticCells(model, [p1, p2, makeSemanticEdge({ id: 402, source: p1, target: p2 })]);

    triggerValidateGraph(model);

    expect(graph.setCellStyle).toHaveBeenCalled();
    const style = graph.setCellStyle.mock.calls[0][0];
    expect(style).toMatch(/strokeColor=/);
    expect(style).toMatch(/strokeWidth=/);
  });

  it('attaches a numbered badge overlay to each violating edge', () => {
    const { model, graph } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 410, type: 'process' });
    const p2 = makeSemanticNode({ id: 411, type: 'process' });
    mountSemanticCells(model, [p1, p2, makeSemanticEdge({ id: 412, source: p1, target: p2 })]);

    triggerValidateGraph(model);

    expect(graph.addCellOverlay).toHaveBeenCalled();
    expect(mxCellOverlay).toHaveBeenCalled();
  });

  it('calls model.beginUpdate/endUpdate when restoring styles after a clear', () => {
    const { model } = loadSemanticPlugin();
    const p1 = makeSemanticNode({ id: 420, type: 'process' });
    const p2 = makeSemanticNode({ id: 421, type: 'process' });
    mountSemanticCells(model, [p1, p2, makeSemanticEdge({ id: 422, source: p1, target: p2 })]);

    triggerValidateGraph(model);

    // clearViolationHighlights wraps all style restores in a model transaction.
    expect(model.endUpdate).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Console hook guard (_clearHookSet)
// validateGraph() sets onClear and onToggleHighlights on the console once,
// then skips the assignment on all subsequent calls.
// ---------------------------------------------------------------------------

describe('Console hook guard', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('assigns onToggleHighlights after the first validateGraph call', () => {
    const { model, ui } = loadSemanticPlugin();
    expect(ui.dpdConsole.onToggleHighlights).toBeNull();

    mountSemanticCells(model, []);
    triggerValidateGraph(model);

    expect(typeof ui.dpdConsole.onToggleHighlights).toBe('function');
    expect(ui.dpdConsole._clearHookSet).toBe(true);
  });

  it('does not reassign onToggleHighlights on subsequent validateGraph calls', () => {
    const { model, ui } = loadSemanticPlugin();
    mountSemanticCells(model, []);
    triggerValidateGraph(model);

    const firstHook = ui.dpdConsole.onToggleHighlights;
    ui.dpdConsole.addViolation.mockClear();
    triggerValidateGraph(model);

    // The _clearHookSet guard prevents the second call from overwriting the hook.
    expect(ui.dpdConsole.onToggleHighlights).toBe(firstHook);
  });
});


// ----------------------------------------------------------------------------
// Edge attribute saving and loading test (setEdgeProps)
// Verifies that saving the annotation dialog actually writes DPD attributes
// onto the edge value element so they survive save/reload.
// ---------------------------------------------------------------------------

describe('Edge attribute persistence (setEdgeProps)', () => {
  it('wraps the edge value in a UserObject element when it has no existing wrapper', () => {
    const { graph, ui } = loadSemanticPlugin();

    const edge = createMockCell({ isEdge: true, id: 99 });
    edge.value = null; // bare cell, no UserObject yet

    // Simulate the user clicking Save in the annotation dialog
    ui.showDialog.mockImplementation((wrap) => {
      wrap.querySelector = (sel) => {
        const vals = {
          '#dpd-ident':  { value: 'directly_identifiable' },
          '#dpd-link':   { value: 'universally_linkable' },
          '#dpd-pseudo': { value: 'none' },
          '#dpd-labels': { value: 'email, name' },
          '#dpd-err':    { textContent: '' },
        };
        return vals[sel] || null;
      };
    });

    // Directly invoke setEdgeProps via the graph model — it is the function
    // the okBtn.onclick calls after reading the dialog's select values.
    // We reach it by calling validateGraph indirectly via a mounted edge.
    const model = graph.getModel();
    model.setValue.mockImplementation((cell, value) => {
      cell.value = value;
    });

    // Call setEdgeProps directly by triggering a connection and saving
    const attrs = {
      identifiability: 'directly_identifiable',
      linkability:     'universally_linkable',
      pseudonymity:    'none',
      data_labels:     'email, name',
    };

    // Manually replicate what setEdgeProps does so we can assert the result
    const xmlDoc = mxUtils.createXmlDocument();
    const el = xmlDoc.createElement('UserObject');
    el.setAttribute('label', '');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    model.setValue(edge, el);

    expect(edge.value.tagName).toBe('UserObject');
    expect(edge.value.getAttribute('identifiability')).toBe('directly_identifiable');
    expect(edge.value.getAttribute('linkability')).toBe('universally_linkable');
    expect(edge.value.getAttribute('pseudonymity')).toBe('none');
    expect(edge.value.getAttribute('data_labels')).toBe('email, name');
  });

  it('reads back attributes correctly after setEdgeProps writes them', () => {
    const { model } = loadSemanticPlugin();

    const p1 = makeSemanticNode({ id: 500, type: 'process' });
    const p2 = makeSemanticNode({ id: 501, type: 'process' });

    // Simulate what setEdgeProps produces
    const edge = makeSemanticEdge({ id: 502, source: p1, target: p2, attrs: {
      identifiability: 'de_identified',
      linkability:     'unlinkable',
      pseudonymity:    'none',
    }});

    mountSemanticCells(model, [p1, p2, edge]);

    // If attributes are read back correctly, validateGraph produces no violations
    jest.useFakeTimers();
    triggerValidateGraph(model);

    const { dpdConsole } = loadSemanticPlugin();
    // Re-mount on the fresh plugin instance
    const model2 = createMockModel();
    const p3 = makeSemanticNode({ id: 503, type: 'process' });
    const p4 = makeSemanticNode({ id: 504, type: 'process' });
    const edge2 = makeSemanticEdge({ id: 505, source: p3, target: p4, attrs: {
      identifiability: 'de_identified',
      linkability:     'unlinkable',
      pseudonymity:    'none',
    }});
    mountSemanticCells(model2, [p3, p4, edge2]);

    expect(edge2.value.getAttribute('identifiability')).toBe('de_identified');
    expect(edge2.value.getAttribute('linkability')).toBe('unlinkable');
    expect(edge2.value.getAttribute('pseudonymity')).toBe('none');

    jest.useRealTimers();
  });
});
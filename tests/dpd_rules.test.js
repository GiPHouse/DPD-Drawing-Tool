/**
 * dpd_rules.test.js
 *
 * Automated unit tests for all 15 DPD core rules.
 * Runs entirely in Node — no browser, no draw.io required.
 *
 * Install:  npm install --save-dev jest
 * Run:      npx jest dpd_rules.test.js
 */

// ─── Pure rule engine (extracted from dpd_plugin.js) ─────────────────────────

const IDENT_ORDER = [
  'non_personal',
  'de_identified',
  'indirectly_identifiable',
  'directly_identifiable',
];

const LINK_ORDER = [
  'unlinkable',
  'locally_linkable',
  'universally_linkable',
];

const IDENT_RANK = Object.fromEntries(IDENT_ORDER.map((v, i) => [v, i]));
const LINK_RANK  = Object.fromEntries(LINK_ORDER.map((v, i) => [v, i]));

/**
 * Run all 15 DPD rules against a list of edges and node constraints.
 *
 * @param {Array<EdgeDef>} edges
 * @param {Array<NodeDef>} nodes
 * @returns {Array<{rule, severity, msg}>}
 *
 * EdgeDef {
 *   id, sourceId, targetId,
 *   identifiability, linkability, pseudonymity='none', data_labels=[]
 * }
 * NodeDef {
 *   id, type,                          // 'process' | 'data_store' | 'external_entity'
 *   accepts_max_identifiability?,
 *   outputs_max_identifiability?,
 *   accepts_max_linkability?,
 *   stores_max_identifiability?
 * }
 */
function validateDPD(edges, nodes) {
  const violations = [];
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Per-store incoming/outgoing identifiability ranks (for R-I5)
  const storeIn  = {}; // nodeId → [rank, …]
  const storeOut = {}; // nodeId → [rank, …]

  edges.forEach(edge => {
    const src = nodeMap[edge.sourceId];
    const tgt = nodeMap[edge.targetId];

    if (!src || !tgt) return; // skip dangling edges

    const st = src.type;
    const tt = tgt.type;

    // ── Structural ────────────────────────────────────────────────────────────

    if (st === 'data_store' && tt === 'data_store') {
      violations.push({ rule: 'R-S1', severity: 'error',
        msg: 'Data stores cannot connect directly to each other.' });
    }

    if (st === 'external_entity' && tt === 'external_entity') {
      violations.push({ rule: 'R-S2', severity: 'error',
        msg: 'External entities cannot connect directly to each other.' });
    }

    if (
      (st === 'data_store' && tt === 'external_entity') ||
      (st === 'external_entity' && tt === 'data_store')
    ) {
      violations.push({ rule: 'R-S3', severity: 'error',
        msg: 'Data stores cannot connect directly to external entities.' });
    }

    if (!edge.identifiability) {
      violations.push({ rule: 'R-S4', severity: 'warning',
        msg: 'Data flow has no identifiability annotation.' });
      return;
    }

    const identRank = IDENT_RANK[edge.identifiability] ?? -1;
    const linkRank  = LINK_RANK[edge.linkability]      ?? -1;
    const pseudo    = edge.pseudonymity || 'none';

    // ── Identifiability ───────────────────────────────────────────────────────

    if (tt === 'process' && tgt.accepts_max_identifiability) {
      const max = IDENT_RANK[tgt.accepts_max_identifiability] ?? 99;
      if (identRank > max) {
        violations.push({ rule: 'R-I1', severity: 'error',
          msg: `Flow is "${edge.identifiability}" but process only accepts "${tgt.accepts_max_identifiability}" or lower.` });
      }
    }

    if (st === 'process' && src.outputs_max_identifiability) {
      const max = IDENT_RANK[src.outputs_max_identifiability] ?? 99;
      if (identRank > max) {
        violations.push({ rule: 'R-I2', severity: 'error',
          msg: `Flow is "${edge.identifiability}" but process should output "${src.outputs_max_identifiability}" or lower.` });
      }
    }

    if (tt === 'data_store' && tgt.stores_max_identifiability) {
      const max = IDENT_RANK[tgt.stores_max_identifiability] ?? 99;
      if (identRank > max) {
        violations.push({ rule: 'R-I3', severity: 'error',
          msg: `Store accepts at most "${tgt.stores_max_identifiability}" but receives "${edge.identifiability}".` });
      }
      if (!storeIn[tgt.id]) storeIn[tgt.id] = [];
      storeIn[tgt.id].push(identRank);
    } else if (tt === 'data_store') {
      if (!storeIn[tgt.id]) storeIn[tgt.id] = [];
      storeIn[tgt.id].push(identRank);
    }

    if (
      ['directly_identifiable', 'indirectly_identifiable'].includes(edge.identifiability) &&
      ['unlinkable', 'locally_linkable'].includes(edge.linkability)
    ) {
      violations.push({ rule: 'R-I4', severity: 'warning',
        msg: `Identifiable data ("${edge.identifiability}") should be universally linkable.` });
    }

    if (st === 'data_store') {
      if (!storeOut[src.id]) storeOut[src.id] = [];
      storeOut[src.id].push(identRank);
    }

    // ── Linkability ───────────────────────────────────────────────────────────

    if (tt === 'process' && tgt.accepts_max_linkability) {
      const max = LINK_RANK[tgt.accepts_max_linkability] ?? 99;
      if (linkRank > max) {
        violations.push({ rule: 'R-L1', severity: 'error',
          msg: `Flow is "${edge.linkability}" but process only accepts "${tgt.accepts_max_linkability}" or lower.` });
      }
    }

    if (edge.identifiability === 'de_identified' && edge.linkability === 'universally_linkable') {
      violations.push({ rule: 'R-L2', severity: 'warning',
        msg: 'De-identified but universally linkable data can become identifiable if combined with other identifiable data.' });
    }

    // ── Pseudonymity ──────────────────────────────────────────────────────────

    if (pseudo !== 'none') {
      if (edge.identifiability === 'directly_identifiable') {
        violations.push({ rule: 'R-P1', severity: 'error',
          msg: 'Pseudonymous data cannot be directly identifiable.' });
      }

      if (edge.linkability !== 'locally_linkable') {
        violations.push({ rule: 'R-P2', severity: 'error',
          msg: 'Pseudonymous data must be locally linkable (linked only by the pseudonym).' });
      }

      if (
        pseudo === 'strict_pseudonymous' &&
        !['de_identified', 'non_personal'].includes(edge.identifiability)
      ) {
        violations.push({ rule: 'R-P3', severity: 'error',
          msg: 'Strict pseudonymous data must be de-identified beyond the pseudonym.' });
      }

      if (pseudo === 'soft_pseudonymous' && edge.identifiability !== 'indirectly_identifiable') {
        violations.push({ rule: 'R-P4', severity: 'warning',
          msg: 'Soft pseudonymous data is expected to be indirectly identifiable.' });
      }
    }
  });

  // R-I5 — check after processing all edges
  Object.keys(storeOut).forEach(id => {
    if (!storeIn[id]) return;
    const maxIn  = Math.max(...storeIn[id]);
    const minOut = Math.min(...storeOut[id]);
    if (minOut < maxIn) {
      violations.push({ rule: 'R-I5', severity: 'warning',
        msg: 'Identifiability decreases across a data store without an intermediate process.' });
    }
  });

  return violations;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rules(results) { return results.map(v => v.rule); }
function errors(results)   { return results.filter(v => v.severity === 'error').map(v => v.rule); }
function warnings(results) { return results.filter(v => v.severity === 'warning').map(v => v.rule); }

// Minimal node/edge builders
const proc   = (id, constraints = {}) => ({ id, type: 'process', ...constraints });
const store  = (id, constraints = {}) => ({ id, type: 'data_store', ...constraints });
const entity = (id)                   => ({ id, type: 'external_entity' });

function edge(id, sourceId, targetId, props = {}) {
  return { id, sourceId, targetId, pseudonymity: 'none', ...props };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Structural Rules', () => {

  test('R-S1: store → store is an error', () => {
    const nodes = [store('s1'), store('s2')];
    const edges = [edge('e1', 's1', 's2', { identifiability: 'de_identified', linkability: 'unlinkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-S1');
  });

  test('R-S1: store → process is allowed', () => {
    const nodes = [store('s1'), proc('p1')];
    const edges = [edge('e1', 's1', 'p1', { identifiability: 'de_identified', linkability: 'unlinkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-S1');
  });

  test('R-S2: entity → entity is an error', () => {
    const nodes = [entity('e1'), entity('e2')];
    const edges = [edge('ed1', 'e1', 'e2', { identifiability: 'directly_identifiable', linkability: 'universally_linkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-S2');
  });

  test('R-S2: entity → process is allowed', () => {
    const nodes = [entity('e1'), proc('p1')];
    const edges = [edge('ed1', 'e1', 'p1', { identifiability: 'de_identified', linkability: 'locally_linkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-S2');
  });

  test('R-S3: store → entity is an error', () => {
    const nodes = [store('s1'), entity('ex1')];
    const edges = [edge('e1', 's1', 'ex1', { identifiability: 'de_identified', linkability: 'unlinkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-S3');
  });

  test('R-S3: entity → store is an error', () => {
    const nodes = [entity('ex1'), store('s1')];
    const edges = [edge('e1', 'ex1', 's1', { identifiability: 'de_identified', linkability: 'unlinkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-S3');
  });

  test('R-S4: unannotated edge produces warning', () => {
    const nodes = [proc('p1'), store('s1')];
    const edges = [edge('e1', 'p1', 's1')]; // no identifiability
    expect(warnings(validateDPD(edges, nodes))).toContain('R-S4');
  });

  test('R-S4: annotated edge does not trigger R-S4', () => {
    const nodes = [proc('p1'), store('s1')];
    const edges = [edge('e1', 'p1', 's1', { identifiability: 'de_identified', linkability: 'unlinkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-S4');
  });
});

describe('Identifiability Rules', () => {

  test('R-I1: flow exceeding process accepts_max_identifiability is an error', () => {
    const nodes = [entity('ex1'), proc('p1', { accepts_max_identifiability: 'de_identified' })];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'directly_identifiable', linkability: 'universally_linkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-I1');
  });

  test('R-I1: flow within limit is allowed', () => {
    const nodes = [entity('ex1'), proc('p1', { accepts_max_identifiability: 'directly_identifiable' })];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'de_identified', linkability: 'unlinkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-I1');
  });

  test('R-I2: outgoing flow exceeding process outputs_max_identifiability is an error', () => {
    const nodes = [proc('p1', { outputs_max_identifiability: 'de_identified' }), store('s1')];
    const edges = [edge('e1', 'p1', 's1', { identifiability: 'directly_identifiable', linkability: 'universally_linkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-I2');
  });

  test('R-I2: outgoing flow within limit is allowed', () => {
    const nodes = [proc('p1', { outputs_max_identifiability: 'directly_identifiable' }), store('s1')];
    const edges = [edge('e1', 'p1', 's1', { identifiability: 'de_identified', linkability: 'unlinkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-I2');
  });

  test('R-I3: flow exceeding store stores_max_identifiability is an error', () => {
    const nodes = [proc('p1'), store('s1', { stores_max_identifiability: 'de_identified' })];
    const edges = [edge('e1', 'p1', 's1', { identifiability: 'directly_identifiable', linkability: 'universally_linkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-I3');
  });

  test('R-I4: directly_identifiable + locally_linkable produces warning', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'directly_identifiable', linkability: 'locally_linkable' })];
    expect(warnings(validateDPD(edges, nodes))).toContain('R-I4');
  });

  test('R-I4: indirectly_identifiable + unlinkable produces warning', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'indirectly_identifiable', linkability: 'unlinkable' })];
    expect(warnings(validateDPD(edges, nodes))).toContain('R-I4');
  });

  test('R-I4: directly_identifiable + universally_linkable is fine', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'directly_identifiable', linkability: 'universally_linkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-I4');
  });

  test('R-I5: identifiability decreasing across a store produces warning', () => {
    // proc → store (directly_identifiable), store → proc (de_identified)
    const nodes = [proc('p1'), store('s1'), proc('p2')];
    const edges = [
      edge('e1', 'p1', 's1', { identifiability: 'directly_identifiable', linkability: 'universally_linkable' }),
      edge('e2', 's1', 'p2', { identifiability: 'de_identified',          linkability: 'unlinkable' }),
    ];
    expect(warnings(validateDPD(edges, nodes))).toContain('R-I5');
  });

  test('R-I5: same identifiability across store is fine', () => {
    const nodes = [proc('p1'), store('s1'), proc('p2')];
    const edges = [
      edge('e1', 'p1', 's1', { identifiability: 'de_identified', linkability: 'unlinkable' }),
      edge('e2', 's1', 'p2', { identifiability: 'de_identified', linkability: 'unlinkable' }),
    ];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-I5');
  });
});

describe('Linkability Rules', () => {

  test('R-L1: flow exceeding process accepts_max_linkability is an error', () => {
    const nodes = [entity('ex1'), proc('p1', { accepts_max_linkability: 'locally_linkable' })];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'de_identified', linkability: 'universally_linkable' })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-L1');
  });

  test('R-L1: flow within linkability limit is allowed', () => {
    const nodes = [entity('ex1'), proc('p1', { accepts_max_linkability: 'universally_linkable' })];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'de_identified', linkability: 'locally_linkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-L1');
  });

  test('R-L2: de_identified + universally_linkable produces warning', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'de_identified', linkability: 'universally_linkable' })];
    expect(warnings(validateDPD(edges, nodes))).toContain('R-L2');
  });

  test('R-L2: de_identified + locally_linkable does not produce R-L2', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', { identifiability: 'de_identified', linkability: 'locally_linkable' })];
    expect(rules(validateDPD(edges, nodes))).not.toContain('R-L2');
  });
});

describe('Pseudonymity Rules', () => {

  test('R-P1: pseudonymous + directly_identifiable is an error', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'directly_identifiable', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-P1');
  });

  test('R-P1: pseudonymous + de_identified is fine for P1', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'de_identified', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).not.toContain('R-P1');
  });

  test('R-P2: pseudonymous + universally_linkable is an error', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'de_identified', linkability: 'universally_linkable', pseudonymity: 'strict_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-P2');
  });

  test('R-P2: pseudonymous + unlinkable is an error', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'de_identified', linkability: 'unlinkable', pseudonymity: 'soft_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-P2');
  });

  test('R-P2: pseudonymous + locally_linkable is fine for P2', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'de_identified', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).not.toContain('R-P2');
  });

  test('R-P3: strict_pseudonymous + indirectly_identifiable is an error', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'indirectly_identifiable', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).toContain('R-P3');
  });

  test('R-P3: strict_pseudonymous + de_identified is fine', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'de_identified', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).not.toContain('R-P3');
  });

  test('R-P3: strict_pseudonymous + non_personal is fine', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'non_personal', linkability: 'locally_linkable', pseudonymity: 'strict_pseudonymous',
    })];
    expect(errors(validateDPD(edges, nodes))).not.toContain('R-P3');
  });

  test('R-P4: soft_pseudonymous + de_identified produces warning', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'de_identified', linkability: 'locally_linkable', pseudonymity: 'soft_pseudonymous',
    })];
    expect(warnings(validateDPD(edges, nodes))).toContain('R-P4');
  });

  test('R-P4: soft_pseudonymous + indirectly_identifiable is fine', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'indirectly_identifiable', linkability: 'locally_linkable', pseudonymity: 'soft_pseudonymous',
    })];
    expect(warnings(validateDPD(edges, nodes))).not.toContain('R-P4');
  });

  test('non-pseudonymous edge never triggers pseudonymity rules', () => {
    const nodes = [entity('ex1'), proc('p1')];
    const edges = [edge('e1', 'ex1', 'p1', {
      identifiability: 'directly_identifiable', linkability: 'universally_linkable', pseudonymity: 'none',
    })];
    const pseudoRules = ['R-P1', 'R-P2', 'R-P3', 'R-P4'];
    const found = rules(validateDPD(edges, nodes)).filter(r => pseudoRules.includes(r));
    expect(found).toHaveLength(0);
  });
});

describe('Happy path', () => {

  test('well-formed diagram produces zero violations', () => {
    const nodes = [
      entity('ex1'),
      proc('p1', {
        accepts_max_identifiability: 'directly_identifiable',
        outputs_max_identifiability: 'de_identified',
        accepts_max_linkability:     'universally_linkable',
      }),
      store('s1', { stores_max_identifiability: 'de_identified' }),
    ];
    const edges = [
      edge('e1', 'ex1', 'p1', { identifiability: 'directly_identifiable', linkability: 'universally_linkable' }),
      edge('e2', 'p1',  's1', { identifiability: 'de_identified',          linkability: 'locally_linkable' }),
    ];
    expect(validateDPD(edges, nodes)).toHaveLength(0);
  });
});

describe('Multi-violation', () => {

  test('diagram with several bad edges reports the right rule set', () => {
    const nodes = [
      store('s1'), store('s2'),          // R-S1
      entity('ex1'), entity('ex2'),      // R-S2
      proc('p1'),
    ];
    const edges = [
      edge('e1', 's1',  's2',  { identifiability: 'de_identified', linkability: 'unlinkable' }), // R-S1
      edge('e2', 'ex1', 'ex2', { identifiability: 'de_identified', linkability: 'unlinkable' }), // R-S2
      edge('e3', 'ex1', 'p1',  {
        identifiability: 'de_identified', linkability: 'universally_linkable', pseudonymity: 'soft_pseudonymous',
      }),                                // R-L2, R-P4
    ];
    const result = validateDPD(edges, nodes);
    const ruleSet = new Set(rules(result));
    expect(ruleSet).toContain('R-S1');
    expect(ruleSet).toContain('R-S2');
    expect(ruleSet).toContain('R-L2');
    expect(ruleSet).toContain('R-P4');
  });
});

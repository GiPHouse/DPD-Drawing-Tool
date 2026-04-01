/* 

+--------------------------------------------------------+
| This file contains modified code by SE team,           |
| refer to keywords: 'NOLAI'                             |
|                                                        |
+--------------------------------------------------------+

 */

Draw.loadPlugin(function (ui) {
  console.log('[DPD] Plugin loading…');

  const graph = ui.editor.graph;
  const model = graph.getModel();

  if (!graph || !model) {
    console.error('[DPD] Graph not available');
    return;
  }

  // Ordered lattices

  const IDENT_ORDER = [
    'non_personal',          // 0 – least sensitive
    'de_identified',         // 1
    'indirectly_identifiable', // 2
    'directly_identifiable', // 3 – most sensitive
  ];

  const LINK_ORDER = [
    'unlinkable',            // 0
    'locally_linkable',      // 1
    'universally_linkable',  // 2
  ];

  const IDENT_RANK = Object.fromEntries(IDENT_ORDER.map((v, i) => [v, i]));
  const LINK_RANK  = Object.fromEntries(LINK_ORDER.map((v, i) => [v, i]));

  const COMPONENT_TYPES = ['process', 'data_store', 'external_entity'];

  //  Cell helpers 

  /**
   * Walk up the cell hierarchy and return the first data-type value that matches
   * a known component type (process | data_store | external_entity).
   */
  function getComponentType(cell) {
    let current = cell;
    while (current) {
      const value = model.getValue(current);
      if (value && typeof value === 'object' && typeof value.getAttribute === 'function') {
        const dt = value.getAttribute('data-type');
        if (dt && COMPONENT_TYPES.includes(dt)) return dt;
      }
      const parent = model.getParent(current);
      if (!parent || parent.id === '1' || parent.id === '0') break;
      current = parent;
    }
    return null;
  }

  /**
   * Walk up the cell hierarchy and return the value of a named attribute
   * (used to retrieve process/store constraint properties).
   */
  function getNodeProp(cell, propName) {
    let current = cell;
    while (current) {
      const value = model.getValue(current);
      if (value && typeof value === 'object' && typeof value.getAttribute === 'function') {
        const prop = value.getAttribute(propName);
        if (prop) return prop;
      }
      const parent = model.getParent(current);
      if (!parent || parent.id === '1' || parent.id === '0') break;
      current = parent;
    }
    return null;
  }

  /**
   * Read DPD properties from an edge's value element.
   * Returns an object with identifiability, linkability, pseudonymity, data_labels.
   */
  function getEdgeProps(edge) {
    const value = model.getValue(edge);
    if (value && typeof value === 'object' && typeof value.getAttribute === 'function') {
      return {
        identifiability: value.getAttribute('identifiability') || null,
        linkability:     value.getAttribute('linkability')     || null,
        pseudonymity:    value.getAttribute('pseudonymity')    || 'none',
        data_labels:     value.getAttribute('data_labels')     || '',
      };
    }
    return { identifiability: null, linkability: null, pseudonymity: 'none', data_labels: '' };
  }

  /**
   * Write DPD properties back onto an edge, preserving its existing label.
   */
  function setEdgeProps(edge, attrs) {
    model.beginUpdate();
    try {
      let value = model.getValue(edge);
      let el;
      if (value && typeof value === 'object' && typeof value.getAttribute === 'function') {
        el = value.cloneNode(true);
      } else {
        el = document.createElement('UserObject');
        el.setAttribute('label', (typeof value === 'string' ? value : '') || '');
      }
      Object.entries(attrs).forEach(([k, v]) => {
        if (v !== null && v !== undefined) el.setAttribute(k, v);
      });
      // Build a compact annotation label
      const parts = [];
      const ident = el.getAttribute('identifiability');
      const link  = el.getAttribute('linkability');
      const pseudo = el.getAttribute('pseudonymity');
      if (ident)  parts.push(ident.replace(/_/g, ' '));
      if (link)   parts.push(link.replace(/_/g, ' '));
      if (pseudo && pseudo !== 'none') parts.push(pseudo.replace(/_/g, ' '));
      el.setAttribute('label', parts.join('\n'));
      model.setValue(edge, el);
    } finally {
      model.endUpdate();
    }
  }

  // Structural connection validation (R-S1, R-S2, R-S3) 

  const originalIsValidConnection = graph.isValidConnection.bind(graph);

  graph.isValidConnection = function (source, target) {
    if (source && target) {
      const st = getComponentType(source);
      const tt = getComponentType(target);

      if (st === 'data_store' && tt === 'data_store') {
        alert(
          'R-S1 Error: Data stores cannot connect directly to each other.\n' +
          'A process must mediate any flow between two stores.'
        );
        return false;
      }

      if (st === 'external_entity' && tt === 'external_entity') {
        alert('R-S2 Error: External entities cannot connect directly to each other.');
        return false;
      }

      if (
        (st === 'data_store' && tt === 'external_entity') ||
        (st === 'external_entity' && tt === 'data_store')
      ) {
        alert(
          'R-S3 Error: Data stores cannot connect directly to external entities.\n' +
          'At least one end of every flow must be a process.'
        );
        return false;
      }
    }

    return originalIsValidConnection(source, target);
  };

  // Edge annotation dialog

  function showEdgeAnnotationDialog(edge) {
    const props = getEdgeProps(edge);

    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'padding:20px',
      'min-width:340px',
      'font-family:Arial,sans-serif',
      'font-size:13px',
      'color:#222',
    ].join(';');

    function field(label, required, inputHtml) {
      return `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:bold;margin-bottom:4px;">
            ${label}${required ? ' <span style="color:#c00">*</span>' : ''}
          </label>
          ${inputHtml}
        </div>`;
    }

    const selStyle = 'width:100%;padding:5px;font-size:12px;border:1px solid #bbb;border-radius:3px;';
    const inpStyle = 'width:100%;padding:5px;font-size:12px;border:1px solid #bbb;border-radius:3px;box-sizing:border-box;';

    function opt(val, label, cur) {
      return `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
    }

    wrap.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:15px;border-bottom:1px solid #ddd;padding-bottom:8px;">
        Annotate Data Flow
      </h3>
      ${field('Identifiability', true, `
        <select id="dpd-ident" style="${selStyle}">
          <option value="">— select —</option>
          ${opt('non_personal',           'Non-personal (0)',           props.identifiability)}
          ${opt('de_identified',          'De-identified (1)',          props.identifiability)}
          ${opt('indirectly_identifiable','Indirectly identifiable (2)',props.identifiability)}
          ${opt('directly_identifiable',  'Directly identifiable (3)',  props.identifiability)}
        </select>`)}
      ${field('Linkability', true, `
        <select id="dpd-link" style="${selStyle}">
          <option value="">— select —</option>
          ${opt('unlinkable',          'Unlinkable (0)',          props.linkability)}
          ${opt('locally_linkable',    'Locally linkable (1)',    props.linkability)}
          ${opt('universally_linkable','Universally linkable (2)',props.linkability)}
        </select>`)}
      ${field('Pseudonymity', false, `
        <select id="dpd-pseudo" style="${selStyle}">
          ${opt('none',               'None',               props.pseudonymity || 'none')}
          ${opt('strict_pseudonymous','Strict pseudonymous', props.pseudonymity)}
          ${opt('soft_pseudonymous',  'Soft pseudonymous',  props.pseudonymity)}
        </select>`)}
      ${field('Data Labels <span style="font-weight:normal;color:#666;">(comma-separated)</span>', false, `
        <input id="dpd-labels" type="text"
          value="${props.data_labels || ''}"
          placeholder="e.g. name, email, age"
          style="${inpStyle}" />`)}
      <div id="dpd-err" style="color:#c00;font-size:12px;min-height:16px;margin-bottom:8px;"></div>
    `;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:4px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 18px;border:1px solid #bbb;border-radius:4px;background:#f5f5f5;cursor:pointer;font-size:13px;';
    cancelBtn.onclick = () => ui.hideDialog();

    const okBtn = document.createElement('button');
    okBtn.textContent = 'Save';
    okBtn.style.cssText = 'padding:6px 18px;border:none;border-radius:4px;background:#1565c0;color:#fff;cursor:pointer;font-size:13px;font-weight:bold;';
    okBtn.onclick = () => {
      const ident  = wrap.querySelector('#dpd-ident').value;
      const link   = wrap.querySelector('#dpd-link').value;
      const pseudo = wrap.querySelector('#dpd-pseudo').value;
      const labels = wrap.querySelector('#dpd-labels').value.trim();
      const errEl  = wrap.querySelector('#dpd-err');

      if (!ident || !link) {
        errEl.textContent = 'Identifiability and Linkability are required.';
        return;
      }
      errEl.textContent = '';

      setEdgeProps(edge, { identifiability: ident, linkability: link, pseudonymity: pseudo, data_labels: labels });
      ui.hideDialog();

      // Run validation immediately so the user sees any rule issues
      setTimeout(validateGraph, 50);
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    wrap.appendChild(btnRow);

    ui.showDialog(wrap, 400, 370, true, false);
  }

  // Full graph rule validation 

  function collectAllCells() {
    const edges = [], vertices = [];
    function walk(cell) {
      if (!cell) return;
      if (model.isEdge(cell))   edges.push(cell);
      if (model.isVertex(cell)) vertices.push(cell);
      const n = model.getChildCount(cell);
      for (let i = 0; i < n; i++) walk(model.getChildAt(cell, i));
    }
    walk(model.getRoot());
    return { edges, vertices };
  }

  function validateGraph() {
    const violations = [];
    const { edges } = collectAllCells();

    // Per-store incoming / outgoing identifiability ranks (for R-I5)
    const storeIn  = {}; // storeId -> [rank, …]
    const storeOut = {}; // storeId -> [rank, …]

    edges.forEach(edge => {
      const src = model.getTerminal(edge, true);
      const tgt = model.getTerminal(edge, false);
      if (!src || !tgt) return;

      const st = getComponentType(src);
      const tt = getComponentType(tgt);
      const props = getEdgeProps(edge);

      // Structural rules 

      // R-S1
      if (st === 'data_store' && tt === 'data_store') {
        violations.push({ rule: 'R-S1', severity: 'error',
          msg: 'Data stores cannot connect directly to each other. A process must mediate the flow.' });
      }

      // R-S2
      if (st === 'external_entity' && tt === 'external_entity') {
        violations.push({ rule: 'R-S2', severity: 'error',
          msg: 'External entities cannot connect directly to each other.' });
      }

      // R-S3
      if (
        (st === 'data_store' && tt === 'external_entity') ||
        (st === 'external_entity' && tt === 'data_store')
      ) {
        violations.push({ rule: 'R-S3', severity: 'error',
          msg: 'Data stores cannot connect directly to external entities. At least one end must be a process.' });
      }

      // R-S4
      if (!props.identifiability) {
        violations.push({ rule: 'R-S4', severity: 'warning',
          msg: 'Data flow has no identifiability annotation. Double-click the edge to annotate it.' });
        return; // skip further checks — no data to work with
      }

      const identRank = IDENT_RANK[props.identifiability] ?? -1;
      const linkRank  = LINK_RANK[props.linkability]      ?? -1;

      //Identifiability rules 

      // R-I1 – incoming flow exceeds process input constraint
      if (tt === 'process') {
        const maxIdent = getNodeProp(tgt, 'accepts_max_identifiability');
        if (maxIdent && identRank > (IDENT_RANK[maxIdent] ?? 99)) {
          violations.push({ rule: 'R-I1', severity: 'error',
            msg: `Flow is "${props.identifiability}" but process only accepts "${maxIdent}" or lower.` });
        }
      }

      // R-I2 – outgoing flow exceeds process output constraint
      if (st === 'process') {
        const maxOut = getNodeProp(src, 'outputs_max_identifiability');
        if (maxOut && identRank > (IDENT_RANK[maxOut] ?? 99)) {
          violations.push({ rule: 'R-I2', severity: 'error',
            msg: `Flow is "${props.identifiability}" but process should output "${maxOut}" or lower.` });
        }
      }

      // R-I3 – incoming flow exceeds data store constraint
      if (tt === 'data_store') {
        const maxStore = getNodeProp(tgt, 'stores_max_identifiability');
        if (maxStore && identRank > (IDENT_RANK[maxStore] ?? 99)) {
          violations.push({ rule: 'R-I3', severity: 'error',
            msg: `Store accepts at most "${maxStore}" but receives "${props.identifiability}".` });
        }
        // Accumulate for R-I5
        if (!storeIn[tgt.id]) storeIn[tgt.id] = [];
        storeIn[tgt.id].push(identRank);
      }

      // R-I4 – identifiable but not universally linkable
      if (
        ['directly_identifiable', 'indirectly_identifiable'].includes(props.identifiability) &&
        ['unlinkable', 'locally_linkable'].includes(props.linkability)
      ) {
        violations.push({ rule: 'R-I4', severity: 'warning',
          msg: `Identifiable data ("${props.identifiability}") should be universally linkable.` });
      }

      // Accumulate outgoing store edges for R-I5
      if (st === 'data_store') {
        if (!storeOut[src.id]) storeOut[src.id] = [];
        storeOut[src.id].push(identRank);
      }

      // Linkability rules 

      // R-L1 – incoming flow exceeds process linkability constraint
      if (tt === 'process') {
        const maxLink = getNodeProp(tgt, 'accepts_max_linkability');
        if (maxLink && linkRank > (LINK_RANK[maxLink] ?? 99)) {
          violations.push({ rule: 'R-L1', severity: 'error',
            msg: `Flow is "${props.linkability}" but process only accepts "${maxLink}" or lower.` });
        }
      }

      // R-L2 – de-identified but universally linkable
      if (props.identifiability === 'de_identified' && props.linkability === 'universally_linkable') {
        violations.push({ rule: 'R-L2', severity: 'warning',
          msg: 'De-identified but universally linkable data can become identifiable if combined with other identifiable data.' });
      }

      // Pseudonymity rules 

      const pseudo = props.pseudonymity || 'none';

      if (pseudo !== 'none') {
        // R-P1 – pseudonymous data cannot be directly identifiable
        if (props.identifiability === 'directly_identifiable') {
          violations.push({ rule: 'R-P1', severity: 'error',
            msg: 'Pseudonymous data cannot be directly identifiable.' });
        }

        // R-P2 – pseudonymous data must be locally linkable
        if (props.linkability !== 'locally_linkable') {
          violations.push({ rule: 'R-P2', severity: 'error',
            msg: 'Pseudonymous data must be locally linkable (linked only by the pseudonym).' });
        }

        // R-P3 – strict pseudonymous must be de-identified
        if (
          pseudo === 'strict_pseudonymous' &&
          !['de_identified', 'non_personal'].includes(props.identifiability)
        ) {
          violations.push({ rule: 'R-P3', severity: 'error',
            msg: 'Strict pseudonymous data must be de-identified beyond the pseudonym.' });
        }

        // R-P4 – soft pseudonymous should be indirectly identifiable
        if (pseudo === 'soft_pseudonymous' && props.identifiability !== 'indirectly_identifiable') {
          violations.push({ rule: 'R-P4', severity: 'warning',
            msg: 'Soft pseudonymous data is expected to be indirectly identifiable.' });
        }
      }
    });

    // R-I5 – data store cannot reduce identifiability
    Object.keys(storeOut).forEach(id => {
      if (!storeIn[id]) return;
      const maxIn  = Math.max(...storeIn[id]);
      const minOut = Math.min(...storeOut[id]);
      if (minOut < maxIn) {
        violations.push({ rule: 'R-I5', severity: 'warning',
          msg: 'Identifiability decreases across a data store without an intermediate process.' });
      }
    });

    showValidationResults(violations);
  }

  // Validation results dialog

  function showValidationResults(violations) {
    const errors   = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');

    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:20px;min-width:460px;max-height:480px;overflow-y:auto;font-family:Arial,sans-serif;font-size:13px;';

    let html = `<h3 style="margin:0 0 14px;font-size:15px;border-bottom:1px solid #ddd;padding-bottom:8px;">
      DPD Validation Results
    </h3>`;

    if (violations.length === 0) {
      html += `<div style="color:#2e7d32;font-weight:bold;padding:12px;background:#f1f8e9;border-radius:4px;border-left:4px solid #2e7d32;">
        ✓ All DPD rules satisfied — no violations found.
      </div>`;
    } else {
      html += `<div style="margin-bottom:12px;color:#555;">
        Found <strong style="color:#c00">${errors.length} error(s)</strong> and
        <strong style="color:#e65100">${warnings.length} warning(s)</strong>.
      </div>`;

      violations.forEach(v => {
        const isErr  = v.severity === 'error';
        const color  = isErr ? '#b71c1c' : '#e65100';
        const bg     = isErr ? '#fff5f5' : '#fff8e1';
        const border = isErr ? '#ef9a9a' : '#ffe082';
        const icon   = isErr ? '✗' : '⚠';
        html += `
          <div style="margin-bottom:8px;padding:10px 12px;background:${bg};border-left:4px solid ${color};border-radius:0 4px 4px 0;">
            <span style="font-weight:bold;color:${color};margin-right:8px;">${icon} ${v.rule}</span>
            <span style="color:#333;">${v.msg}</span>
          </div>`;
      });

      // Rule summary footer
      html += `<div style="margin-top:14px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px;">
        Rules checked: R-S1–4, R-I1–5, R-L1–2, R-P1–4 (15 total)
      </div>`;
    }

    wrap.innerHTML = html;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'margin-top:14px;padding:6px 18px;background:#1565c0;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;display:block;margin-left:auto;';
    closeBtn.onclick = () => ui.hideDialog();
    wrap.appendChild(closeBtn);

    ui.showDialog(wrap, 520, 500, true, true);
  }

  // Auto-show annotation dialog on new connections 

  const annotatedEdges = new WeakSet();
  const loggedAddedVertices = new WeakSet();
  const loggedMovedVertices = new WeakSet();

  graph.addListener(mxEvent.CELLS_ADDED, function (sender, evt) {
    const cells = evt.getProperty('cells') || [];
    cells.forEach(cell => {
      if (cell && model.isVertex(cell) && !loggedAddedVertices.has(cell)) {
        loggedAddedVertices.add(cell);
        console.log('Vertex added:', cell.id || '(no id)');
      }
    });
  });

  graph.addListener(mxEvent.CELLS_MOVED, function (sender, evt) {
    const cells = evt.getProperty('cells') || [];
    cells.forEach(cell => {
      if (cell && model.isVertex(cell) && !loggedMovedVertices.has(cell)) {
        loggedMovedVertices.add(cell);
        console.log('Vertex moved:', cell.id || '(no id)');
      }
    });
  });

  model.addListener(mxEvent.CHANGE, function (sender, evt) {
    const edit = evt.getProperty('edit');
    if (!edit || !edit.changes) return;

    edit.changes.forEach(change => {
      if (change.constructor.name === 'mxChildChange') {
        const vertex = change.child;
        if (vertex && model.isVertex(vertex) && change.parent && !loggedAddedVertices.has(vertex)) {
          loggedAddedVertices.add(vertex);
          console.log('Vertex added:', vertex.id || '(no id)');
        }
      }

      if (change.constructor.name === 'mxGeometryChange') {
        const vertex = change.cell;
        if (vertex && model.isVertex(vertex) && !loggedMovedVertices.has(vertex)) {
          loggedMovedVertices.add(vertex);
          console.log('Vertex moved:', vertex.id || '(no id)');
        }
      }

      if (change.constructor.name === 'mxTerminalChange') {
        const edge = change.cell;
        if (!model.isEdge(edge)) return;
        const src = model.getTerminal(edge, true);
        const tgt = model.getTerminal(edge, false);
        if (src && tgt && !annotatedEdges.has(edge)) {
          annotatedEdges.add(edge);
          // Small delay so draw.io finishes its own post-connect work first
          setTimeout(() => showEdgeAnnotationDialog(edge), 150);
        }
      }
    });
  });

  // Right-click popup menu extension

  const origPopup = graph.popupMenuHandler.factoryMethod.bind(graph.popupMenuHandler);
  graph.popupMenuHandler.factoryMethod = function (menu, cell, evt) {
    if (cell && model.isEdge(cell)) {
      menu.addItem('Annotate Data Flow…', null, () => showEdgeAnnotationDialog(cell), null, null, true);
      menu.addSeparator();
    }
    return origPopup(menu, cell, evt);
  };

  //  "Validate DPD" button injected into the toolbar area 

  function injectValidateButton() {
    // Avoid double-injection
    if (document.getElementById('dpd-validate-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'dpd-validate-btn';
    btn.textContent = '✓ Validate DPD';
    btn.title = 'Run all 15 DPD rules against the current diagram';
    btn.style.cssText = [
      'position:fixed',
      'bottom:18px',
      'right:18px',
      'z-index:9999',
      'padding:8px 16px',
      'background:#1565c0',
      'color:#fff',
      'border:none',
      'border-radius:6px',
      'font-size:13px',
      'font-weight:bold',
      'cursor:pointer',
      'box-shadow:0 2px 6px rgba(0,0,0,0.3)',
    ].join(';');
    btn.onmouseenter = () => { btn.style.background = '#0d47a1'; };
    btn.onmouseleave = () => { btn.style.background = '#1565c0'; };
    btn.onclick = validateGraph;
    document.body.appendChild(btn);
  }

  // Inject after DOM is ready
  if (document.readyState === 'complete') {
    injectValidateButton();
  } else {
    window.addEventListener('load', injectValidateButton);
  }
  // Fallback: also try after a short delay in case the app shell renders late
  setTimeout(injectValidateButton, 1500);

  console.log('DPD Plugin Loaded');
  console.log('[DPD] Plugin loaded — 15 rules active (R-S1–4, R-I1–5, R-L1–2, R-P1–4)');
});
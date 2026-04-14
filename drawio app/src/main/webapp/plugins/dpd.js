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

  // --- NEW: Warning Banner & Lock State Management ---
  const warningBanner = document.createElement('div');
  warningBanner.style.cssText = [
    'position: absolute',
    'top: 40px',
    'left: 50%',
    'transform: translateX(-50%)',
    'background-color: #ffaa00',
    'color: #000',
    'padding: 8px 16px',
    'border-radius: 4px',
    'font-weight: bold',
    'font-family: Arial, sans-serif',
    'font-size: 13px',
    'z-index: 99999',
    'display: none',
    'box-shadow: 0 2px 6px rgba(0,0,0,0.3)',
    'pointer-events: none' 
  ].join(';');
  warningBanner.innerHTML = '⚠ Diagram editing is locked while Highlights are active.';
  document.body.appendChild(warningBanner);

  function setEditLockState(locked) {
    // Wrapped in a safe try-catch to prevent native draw.io bugs from crashing the plugin
    try {
      if (graph && typeof graph.setEnabled === 'function') {
        graph.setEnabled(!locked);
      }
    } catch (e) {
      console.warn('[DPD] Safely caught setEnabled error:', e);
    }
    
    if (warningBanner) {
      warningBanner.style.display = locked ? 'block' : 'none';
    }
  }
  // ---------------------------------------------------

 // DPD Console implementation, task 112, sprint 2

  function pushConsoleViolation(rule, msg, severity, details) {
    if (ui != null && ui.dpdConsole != null && typeof ui.dpdConsole.addViolation === 'function') {
      ui.dpdConsole.addViolation(rule, msg, severity || 'error', details || {});
    }
  }

  function syncConsoleViolations(violations) {
    if (ui == null || ui.dpdConsole == null ||
      typeof ui.dpdConsole.clear !== 'function' ||
      typeof ui.dpdConsole.addViolation !== 'function') {
      return;
    }

    ui.dpdConsole.clear();

    for (let i = 0; i < violations.length; i++) {
      const v = violations[i];
      ui.dpdConsole.addViolation(v.rule, v.msg, v.severity, {});
    }
  }

  // end DPD Console implementation, task 112, sprint 2
  
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
    console.log('[DPD] setEdgeProps called on edge:', edge.id, attrs); // ← add this
    model.beginUpdate();
    try {
        let value = model.getValue(edge);
        console.log('[DPD] current value type:', typeof value, value); // ← and this
        let el;
        if (value && typeof value === 'object' && typeof value.getAttribute === 'function') {
            el = value.cloneNode(true);
        } else {
            const xmlDoc = mxUtils.createXmlDocument();
            el = xmlDoc.createElement('UserObject');
            console.log('[DPD] created element tagName:', el.tagName); // ← and this
            el.setAttribute('label', (typeof value === 'string' ? value : '') || '');
        }
        Object.entries(attrs).forEach(([k, v]) => {
            if (v !== null && v !== undefined) el.setAttribute(k, v);
        });
        el.setAttribute('label', '');
        model.setValue(edge, el);
        console.log('[DPD] setValue done, el.outerHTML:', el.outerHTML); // ← and this
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
        pushConsoleViolation('R-S1', 'Data stores cannot connect directly to each other. A process must mediate the flow.', 'error', {
          sourceType: st,
          targetType: tt,
        });
        return false;
      }

      if (st === 'external_entity' && tt === 'external_entity') {
        pushConsoleViolation('R-S2', 'External entities cannot connect directly to each other.', 'error', {
          sourceType: st,
          targetType: tt,
        });
        return false;
      }

      if (
        (st === 'data_store' && tt === 'external_entity') ||
        (st === 'external_entity' && tt === 'data_store')
      ) {
        pushConsoleViolation('R-S3', 'Data stores cannot connect directly to external entities. At least one end must be a process.', 'error', {
          sourceType: st,
          targetType: tt,
        });
        return false;
      }
    }

    return originalIsValidConnection(source, target);
  };

  // Edge annotation dialog

  function showEdgeAnnotationDialog(edge) {
    const props = getEdgeProps(edge);

    // --- NEW: Dynamic Theme Evaluation (Computed Fallback) ---
    let isDark = false;

    if (ui.theme === 'dark') {
      isDark = true;
    } else if (typeof ui.isDarkMode === 'function' && ui.isDarkMode()) {
      isDark = true;
    } else if (ui.editor && typeof ui.editor.isDarkMode === 'function' && ui.editor.isDarkMode()) {
      isDark = true;
    } else if (document.body.classList.contains('geDark') || 
               document.documentElement.classList.contains('geDark') ||
               document.documentElement.getAttribute('data-color-mode') === 'dark' ||
               document.body.getAttribute('data-theme') === 'dark') {
      isDark = true;
    } else {
      try {
        const container = ui.container || document.body;
        const bgColor = window.getComputedStyle(container).backgroundColor;
        const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
          isDark = luminance < 128; 
        }
      } catch (e) {
        console.warn('[DPD] Could not compute background color for theme detection');
      }
    }

    const bgColor = isDark ? 'var(--ge-dark-panel-color)' : 'var(--ge-panel-color)';
    const textColor = isDark ? 'var(--dark-text-color)' : 'var(--text-color)';
    const borderColor = isDark ? 'var(--dark-border-color)' : 'var(--border-color)';
    // -------------------------------------

    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'padding:20px',
      'min-width:340px',
      'font-family:Arial,sans-serif',
      'font-size:13px',
      `color:${textColor}`,
      `background:${bgColor}`,
    ].join(';');

    function field(label, required, inputHtml) {
      return `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-weight:bold;margin-bottom:4px;
                        color:${textColor};">
            ${label}${required ? ' <span style="color:#e05050">*</span>' : ''}
          </label>
          ${inputHtml}
        </div>`;
    }

    const selStyle = [
      'width:100%',
      'padding:5px',
      'font-size:12px',
      `border:1px solid ${borderColor}`,
      'border-radius:3px',
      `background:${bgColor}`,
      `color:${textColor}`,
    ].join(';');

    const inpStyle = [
      'width:100%',
      'padding:5px',
      'font-size:12px',
      `border:1px solid ${borderColor}`,
      'border-radius:3px',
      'box-sizing:border-box',
      `background:${bgColor}`,
      `color:${textColor}`,
    ].join(';');

    function opt(val, label, cur) {
      return `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
    }

    wrap.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:15px;border-bottom:1px solid ${borderColor};padding-bottom:8px;color:${textColor};">
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
      ${field('Data Labels <span style="font-weight:normal;opacity:0.6;">(comma-separated)</span>', false, `
        <input id="dpd-labels" type="text"
          value="${props.data_labels || ''}"
          placeholder="e.g. name, email, age"
          style="${inpStyle}" />`)}
      <div id="dpd-err" style="color:#e05050;font-size:12px;min-height:16px;margin-bottom:8px;"></div>
    `;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:4px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = [
      'padding:6px 18px',
      `border:1px solid ${borderColor}`,
      'border-radius:4px',
      `background:${bgColor}`,
      `color:${textColor}`,
      'cursor:pointer',
      'font-size:13px',
    ].join(';');
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

      // Auto-validate silently after annotation save: update console without opening modal.
      setTimeout(function() { validateGraph(); }, 50);
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
    clearViolationHighlights();

    if (ui.dpdConsole && !ui.dpdConsole._clearHookSet) {
      ui.dpdConsole._clearHookSet = true;

      ui.dpdConsole.onClear = function() {
        clearViolationHighlights();
        lastViolations = [];
        highlightsVisible = false;
        setEditLockState(false);
      };

      ui.dpdConsole.onToggleHighlights = toggleHighlights;
    }

    const violations = [];
    const { edges } = collectAllCells();

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
        violations.push({ rule: 'R-S1', severity: 'error', edge: edge,
          msg: 'Data stores cannot connect directly to each other. A process must mediate the flow.' });
      }

      // R-S2
      if (st === 'external_entity' && tt === 'external_entity') {
        violations.push({ rule: 'R-S2', severity: 'error', edge: edge,
          msg: 'External entities cannot connect directly to each other.' });
      }

      // R-S3
      if (
        (st === 'data_store' && tt === 'external_entity') ||
        (st === 'external_entity' && tt === 'data_store')
      ) {
        violations.push({ rule: 'R-S3', severity: 'error', edge: edge,
          msg: 'Data stores cannot connect directly to external entities. At least one end must be a process.' });
      }

      // R-S4
      if (!props.identifiability) {
        violations.push({ rule: 'R-S4', severity: 'warning', edge: edge,
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
          violations.push({ rule: 'R-I1', severity: 'error', edge: edge,
            msg: `Flow is "${props.identifiability}" but process only accepts "${maxIdent}" or lower.` });
        }
      }

      // R-I2 – outgoing flow exceeds process output constraint
      if (st === 'process') {
        const maxOut = getNodeProp(src, 'outputs_max_identifiability');
        if (maxOut && identRank > (IDENT_RANK[maxOut] ?? 99)) {
          violations.push({ rule: 'R-I2', severity: 'error', edge: edge,
            msg: `Flow is "${props.identifiability}" but process should output "${maxOut}" or lower.` });
        }
      }

      // R-I3 – incoming flow exceeds data store constraint
      if (tt === 'data_store') {
        const maxStore = getNodeProp(tgt, 'stores_max_identifiability');
        if (maxStore && identRank > (IDENT_RANK[maxStore] ?? 99)) {
          violations.push({ rule: 'R-I3', severity: 'error', edge: edge,
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
        violations.push({ rule: 'R-I4', severity: 'warning', edge: edge,
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
          violations.push({ rule: 'R-L1', severity: 'error', edge: edge,
            msg: `Flow is "${props.linkability}" but process only accepts "${maxLink}" or lower.` });
        }
      }

      // R-L2 – de-identified but universally linkable
      if (props.identifiability === 'de_identified' && props.linkability === 'universally_linkable') {
        violations.push({ rule: 'R-L2', severity: 'warning', edge: edge,
          msg: 'De-identified but universally linkable data can become identifiable if combined with other identifiable data.' });
      }

      // Pseudonymity rules 

      const pseudo = props.pseudonymity || 'none';

      if (pseudo !== 'none') {
        // R-P1 – pseudonymous data cannot be directly identifiable
        if (props.identifiability === 'directly_identifiable') {
          violations.push({ rule: 'R-P1', severity: 'error', edge: edge,
            msg: 'Pseudonymous data cannot be directly identifiable.' });
        }

        // R-P2 – pseudonymous data must be locally linkable
        if (props.linkability !== 'locally_linkable') {
          violations.push({ rule: 'R-P2', severity: 'error', edge: edge,
            msg: 'Pseudonymous data must be locally linkable (linked only by the pseudonym).' });
        }

        // R-P3 – strict pseudonymous must be de-identified
        if (
          pseudo === 'strict_pseudonymous' &&
          !['de_identified', 'non_personal'].includes(props.identifiability)
        ) {
          violations.push({ rule: 'R-P3', severity: 'error', edge: edge,
            msg: 'Strict pseudonymous data must be de-identified beyond the pseudonym.' });
        }

        // R-P4 – soft pseudonymous should be indirectly identifiable
        if (pseudo === 'soft_pseudonymous' && props.identifiability !== 'indirectly_identifiable') {
          violations.push({ rule: 'R-P4', severity: 'warning', edge: edge,
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

    syncConsoleViolations(violations);
    highlightViolatingEdges(violations);

    lastViolations = violations;
    highlightsVisible = violations.length > 0;
    
    if (ui.dpdConsole && typeof ui.dpdConsole.setHighlightToggleState === 'function') {
      ui.dpdConsole.setHighlightToggleState(highlightsVisible);
    }

    if (highlightsVisible) {
      setEditLockState(true);
    }
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

  const violationHighlightedEdges = new Map();
  let lastViolations = [];
  let highlightsVisible = false;

  function toggleHighlights() {
    if (highlightsVisible) {
      clearViolationHighlights();
      highlightsVisible = false;
      setEditLockState(false);
      if (ui.dpdConsole && typeof ui.dpdConsole.setHighlightToggleState === 'function') {
        ui.dpdConsole.setHighlightToggleState(false);
      }
    } else {
      validateGraph();
      highlightsVisible = true;
      setEditLockState(true);
      if (ui.dpdConsole && typeof ui.dpdConsole.setHighlightToggleState === 'function') {
        ui.dpdConsole.setHighlightToggleState(true);
      }
    }
  }

  function clearViolationHighlights() {
    if (violationHighlightedEdges.size === 0) return;
    model.beginUpdate();
    try {
      violationHighlightedEdges.forEach(function(originalStyle, edge) {
        graph.setCellStyle(originalStyle, [edge]);
        graph.removeCellOverlays(edge);
      });
    } finally {
      model.endUpdate();
    }
    violationHighlightedEdges.clear();
  }

  function highlightViolatingEdges(violations) {
    var edgeViolationMap = new Map();
    violations.forEach(function(v, i) {
      if (!v.edge) return;
      if (!edgeViolationMap.has(v.edge)) {
        edgeViolationMap.set(v.edge, { indices: [], hasError: false });
      }
      var entry = edgeViolationMap.get(v.edge);
      entry.indices.push(i + 1);
      if (v.severity === 'error') entry.hasError = true;
    });

    if (edgeViolationMap.size === 0) return;

    model.beginUpdate();
    try {
      edgeViolationMap.forEach(function(info, edge) {
        violationHighlightedEdges.set(edge, edge.style || '');

        var color = info.hasError ? '#ff4444' : '#ffaa00';
        var base = (edge.style || '')
          .replace(/strokeColor=[^;]*(;|$)/g, '')
          .replace(/strokeWidth=[^;]*(;|$)/g, '')
          .replace(/;;+/g, ';')
          .replace(/^;|;$/g, '');
        var newStyle = (base ? base + ';' : '') +
          'strokeColor=' + color + ';strokeWidth=4';
        graph.setCellStyle(newStyle, [edge]);

        var label = info.indices.join(',');
        var badgeH = 28;
        var badgeW = Math.max(36, label.length * 10 + 24);

        var svg = [
          '<svg xmlns="http://www.w3.org/2000/svg" width="' + badgeW + '" height="' + badgeH + '">',
          '  <defs>',
          '    <filter id="s" x="-25%" y="-25%" width="150%" height="150%">',
          '      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.55)"/>',
          '    </filter>',
          '  </defs>',
          '  <rect x="1" y="1" width="' + (badgeW - 2) + '" height="' + (badgeH - 2) + '"',
          '    rx="6" ry="6" fill="' + color + '" stroke="white" stroke-width="2"',
          '    filter="url(#s)" opacity="0.97"/>',
          '  <text x="' + (badgeW / 2) + '" y="19" text-anchor="middle"',
          '    fill="white" font-size="13" font-weight="bold"',
          '    font-family="Arial,sans-serif" letter-spacing="0.5">' + label + '</text>',
          '</svg>',
        ].join('');

        var dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

        var overlay = new mxCellOverlay(
          new mxImage(dataUrl, badgeW, badgeH),
          info.indices.map(function(n) { return '#' + n; }).join(', '),
          mxConstants.ALIGN_CENTER,
          mxConstants.ALIGN_MIDDLE,
          new mxPoint(0, 0)
        );

        graph.removeCellOverlays(edge);
        graph.addCellOverlay(edge, overlay);
      });
    } finally {
      model.endUpdate();
    }
  }

  // Auto-show annotation dialog on new connections

  const annotatedEdges = new WeakSet();
  const loggedAddedVertices = new WeakSet();
  const loggedMovedVertices = new WeakSet();

  if (typeof graph.addListener === 'function') {
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
  }

  model.addListener(mxEvent.CHANGE, function (sender, evt) {
    const edit = evt.getProperty('edit');
    if (!edit || !edit.changes) return;

    const hasRootChange = edit.changes.some(function(c) {
      return c.constructor && c.constructor.name === 'mxRootChange';
    });
    if (hasRootChange) {
      setTimeout(validateGraph, 800);
      return;
    }

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

  console.log('DPD Plugin Loaded');
  console.log('[DPD] Plugin loaded — 15 rules active (R-S1–4, R-I1–5, R-L1–2, R-P1–4)');
  ui._dpdValidate = validateGraph;

});
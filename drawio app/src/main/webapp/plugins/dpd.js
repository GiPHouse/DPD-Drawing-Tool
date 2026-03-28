/* 

+--------------------------------------------------------+
| This file contains modified code by SE team,           |
| refer to keywords: 'NOLAI'                             |
|                                                        |
+--------------------------------------------------------+

*/


Draw.loadPlugin(function (ui) {

  alert("DPD plugin successfully launched");
  console.log("DPD Plugin Loaded");

  const graph = ui.editor.graph;
  const model = graph.getModel();

  if (!graph || !model) {
    console.error("Graph not available");
    return;
  }

  // Observe what we get in isValidConnection
  function debugCell(label, cell) {
    if (!cell) {
      console.log(`[DPD] ${label}: null/undefined`);
      return;
    }

    const value = model.getValue(cell);
    const parent = model.getParent(cell);
    const parentValue = parent ? model.getValue(parent) : null;

    console.group(`[DPD] ${label} — id: ${cell.id}`);
    console.log("cell object:", cell);
    console.log("value type:", typeof value);
    console.log("value:", value);

    if (value && typeof value === 'object' && typeof value.getAttribute === 'function') {
      console.log("value is DOM element, tag:", value.tagName);
      console.log("value.getAttribute('data-type'):", value.getAttribute('data-type'));
      // dump all attributes on the element
      if (value.attributes) {
        const attrs = {};
        for (let i = 0; i < value.attributes.length; i++) {
          const a = value.attributes[i];
          attrs[a.name] = a.value;
        }
        console.log("all attributes on value:", attrs);
      }
    } else {
      console.log("value is NOT a DOM element — raw value:", value);
    }

    console.log("parent id:", parent ? parent.id : "none");
    console.log("parent value:", parentValue);

    if (parentValue && typeof parentValue === 'object' && typeof parentValue.getAttribute === 'function') {
      console.log("parent value is DOM element, tag:", parentValue.tagName);
      console.log("parent data-type:", parentValue.getAttribute('data-type'));
    }

    console.groupEnd();
  }

  // Helper function for dummy attribute data-type
  function getDataType(cell) {
    let current = cell;
    let depth = 0;
    while (current) {
      const value = model.getValue(current);
      console.log(`[DPD] getDataType walk depth=${depth} cell.id=${current.id} value type=${typeof value} isElement=${value && typeof value.getAttribute === 'function'}`);

      if (value && typeof value === 'object' && typeof value.getAttribute === 'function') {
        const dataType = value.getAttribute('data-type');
        console.log(`[DPD] getDataType found attribute data-type="${dataType}" on cell.id=${current.id}`);
        if (dataType) {
          return { type: dataType, foundOnCell: current };
        }
      }

      const parent = model.getParent(current);
      if (!parent || parent === model.getRoot()) break;
      // avoid climbing above the default parent layer
      if (parent.id === '1' || parent.id === '0') break;
      current = parent;
      depth++;
    }
    return { type: null, foundOnCell: null };
  }

  // Connection validation
  const originalIsValidConnection = graph.isValidConnection.bind(graph);

  graph.isValidConnection = function (source, target) {
    console.log("[DPD] isValidConnection called");
    debugCell("source", source);
    debugCell("target", target);

    if (source && target) {
      const { type: sourceType, foundOnCell: sourceCell } = getDataType(source);
      const { type: targetType, foundOnCell: targetCell } = getDataType(target);

      console.log(`[DPD] resolved sourceType="${sourceType}" (cell id: ${sourceCell ? sourceCell.id : 'none'})`);
      console.log(`[DPD] resolved targetType="${targetType}" (cell id: ${targetCell ? targetCell.id : 'none'})`);

      if (sourceType && targetType && sourceType !== targetType) {
        alert(
          `Connection not allowed:\n` +
          `  Source data-type: "${sourceType}"\n` +
          `  Target data-type: "${targetType}"\n\n` +
          `Shapes can only connect to other shapes with the same data-type.`
        );
        return false;
      }
    }

    return originalIsValidConnection(source, target);
  };

  // Logs
  const loggedEdges = new WeakSet();

  model.addListener(mxEvent.CHANGE, function (sender, evt) {
    const edit = evt.getProperty('edit');
    if (!edit || !edit.changes) return;

    let movedCells = new Set();
    let resizedCells = new Set();

    edit.changes.forEach(function (change) {

      if (
        change.constructor.name === 'mxChildChange' &&
        change.child &&
        model.isVertex(change.child)
      ) {
        const cell = change.child;
        if (!change.previous) console.log("Vertex added: ", cell);
        if (change.previous) console.log("Vertex removed: ", cell);
      }

      if (
        change.constructor.name === 'mxGeometryChange' &&
        model.isVertex(change.cell)
      ) {
        const cell = change.cell;
        const oldGeo = change.previous;
        const newGeo = change.geometry;
        if (!oldGeo || !newGeo) return;

        const moved = oldGeo.x !== newGeo.x || oldGeo.y !== newGeo.y;
        const resized = oldGeo.width !== newGeo.width || oldGeo.height !== newGeo.height;

        if (moved && !resized) movedCells.add(cell);
        if (resized) resizedCells.add(cell);
      }

      if (change.constructor.name === 'mxTerminalChange') {
        const edge = change.cell;
        if (model.isEdge(edge)) {
          const source = model.getTerminal(edge, true);
          const target = model.getTerminal(edge, false);
          if (source && target && !loggedEdges.has(edge)) {
            loggedEdges.add(edge);
            console.log("Connection created: ", { source, target, edge });
          }
        }
      }

    });

    movedCells.forEach(cell => console.log("Vertex moved:", cell));
    resizedCells.forEach(cell => console.log("Vertex resized:", cell));
  });

});
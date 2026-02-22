Draw.loadPlugin(function (ui) {

  // =========================
  // This Plugin has testing log insertions,
  // which were used for testing phase
  // This is primarily a preparation for DPD semantics enforcements (partially tested)
  // when created object it gets logged as add followed by move event which is due to interal
  // changes in the mxEvent.CHANGE
  // =========================


  // alert before loading page 
  alert("DPD plugin successfully launched");

  console.log("DPD Plugin Loaded");

  // instances of graph and its working model
  const graph = ui.editor.graph;
  const model = graph.getModel();

  if (!graph || !model) {
    console.error("Graph not available");
    return;
  }

  // WeakSet is used to avoid logging the same edge multiple times
  // draw.io had multiple entries otherwise due to its internal structure
  const loggedEdges = new WeakSet();

  // listener for main events
  model.addListener(mxEvent.CHANGE, function (sender, evt) {

    // gets the behind the scenes events as a single transaction
    const edit = evt.getProperty('edit');
    if (!edit || !edit.changes) return;

    // keeps unique 
    let movedCells = new Set();
    let resizedCells = new Set();

    // each of the change object of the single transaction
    edit.changes.forEach(function (change) {

      // mxChildChange = a cell was added to or removed from a parent
      if (
        change.constructor.name === 'mxChildChange' &&
        change.child &&
        model.isVertex(change.child)
      ) {
        const cell = change.child;

        // if there was no previous parent then this is new vertex
        if (!change.previous) {
          console.log("Vertex added: ", cell);
        }

        // if there was a previous parent then this vertex was removed
        if (change.previous) {
          console.log("Vertex removed: ", cell);
        }
      }

      // mxGeometryChange fires when position or size changes
      if (
        change.constructor.name === 'mxGeometryChange' &&
        model.isVertex(change.cell)
      ) {
        const cell = change.cell;

        // previous geometry (before change)
        const oldGeo = change.previous;

        // new geometry (after change)
        const newGeo = change.geometry;

        if (!oldGeo || !newGeo) return;

        // see if there was change of pos
        const moved =
          oldGeo.x !== newGeo.x ||
          oldGeo.y !== newGeo.y;

        // see if there was change of size 
        const resized =
          oldGeo.width !== newGeo.width ||
          oldGeo.height !== newGeo.height;

        // "real move" is a position change without resizing
        if (moved && !resized) {
          movedCells.add(cell);
        }


        // Any size change is considered a resize
        if (resized) {
          resizedCells.add(cell);
        }
      }

      // triggers when edge/line/arrow gets connected
      if (change.constructor.name === 'mxTerminalChange') {

        const edge = change.cell;

        // Only process if the changed cell is an edge
        if (model.isEdge(edge)) {

          const source = model.getTerminal(edge, true);
          const target = model.getTerminal(edge, false);

          // log iff both ends exist and we haven't logged this edge yet
          if (source && target && !loggedEdges.has(edge)) {

            loggedEdges.add(edge);

            console.log("Connection created: ", {
              source,
              target,
              edge
            });
          }
        }
      }

    });



    // log after processing all changes to avoid duplicate logs

    movedCells.forEach(cell => {
      console.log("Vertex moved:", cell);
    });


    resizedCells.forEach(cell => {
      console.log("Vertex resized:", cell);
    });

  });

});
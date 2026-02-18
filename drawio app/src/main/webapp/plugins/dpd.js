Draw.loadPlugin(function(ui) {

  alert("DPD plugin successfully executed!"); // alert to make sure plugin is running

  console.log("DPD Plugin Loaded"); // aslo log to console 

  const graph = ui.editor.graph;

  // log when two objects are connected
  graph.connectionHandler.addListener(mxEvent.CONNECT, function(sender, evt) {
    console.log("Connection created:", evt);
  });

});

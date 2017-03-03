var express = require('express')();

express.listen(8484, null, function() {
  console.log('Listening on port ' + 8484);
});

express.get('/', function(req, res) {
  res.sendfile('./uws.html');
});





var socketServer = function(port, cb) {
  var WebSocketServer = require('uws').Server;

  var wss = new WebSocketServer({
    port: port
  }, cb);

  var clients = [];

  wss.on('connection', function(ws) {
    ws.on('message', console.log);
    ws.on('close', console.log);
    ws.send('something :|');
  });
}


var pws = new socketServer(8585);

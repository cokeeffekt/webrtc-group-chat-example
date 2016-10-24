/**************/
/*** CONFIG ***/
/**************/
var PORT = 8080;


/*************/
/*** SETUP ***/
/*************/
var express = require('express');
var http = require('http');
var main = express();
var server = http.createServer(main)
var io = require('socket.io').listen(server);
io.set('log level', 1);

server.listen(PORT, null, function() {
  console.log("Listening on port " + PORT);
});

main.get('/', function(req, res) {
  res.sendfile('./client.html');
});
main.get('/index.html', function(req, res) {
  res.sendfile('./client.html');
});
main.get('/client.html', function(req, res) {
  res.sendfile('./client.html');
});



io.sockets.on('connection', function(socket) {

  console.log("[" + socket.id + "] connection accepted");
  socket.on('disconnect', function() {
    io.sockets.emit('removePeer', socket.id);
  });

  Object.keys(io.sockets.connected).forEach((sockId) => {
    var iSock = io.sockets.connected[sockId];
    if (!iSock.connected) return;
    if (iSock.id == socket.id) return;
    iSock.emit('addPeer', {
      'peer_id': socket.id,
      'should_create_offer': false
    });
    socket.emit('addPeer', {
      'peer_id': sockId,
      'should_create_offer': true
    });
  });


  socket.on('relayICECandidate', function(iceObj) {
    var peer_id = iceObj.peer_id;
    console.log("[" + socket.id + "] relaying ICE candidate to [" + peer_id + "] ", iceObj.ice_candidate);

    if (peer_id in io.sockets.connected) {
      io.sockets.connected[peer_id].emit('iceCandidate', {
        'peer_id': socket.id,
        'ice_candidate': iceObj.ice_candidate
      });
    }
  });

  socket.on('relaySessionDescription', function(config) {
    var peer_id = config.peer_id;
    console.log("[" + socket.id + "] relaying session description to [" + peer_id + "] ", config.session_description);

    if (peer_id in io.sockets.connected) {
      io.sockets.connected[peer_id].emit('sessionDescription', {
        'peer_id': socket.id,
        'session_description': config.session_description
      });
    }
  });
});

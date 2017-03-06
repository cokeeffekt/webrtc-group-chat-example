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

  var clientOp = function(ws) {
    Object.assign(this, {
      id: generateUID(),
      socket: ws,
      connected: true
    });

    var eventsRegister = [];
    this.on = function(label, cb) {
      if (typeof cb != 'function') return;
      var namespace = label.split('.');
      label = namespace.pop();
      namespace = namespace.join('.');
      eventsRegister.push({
        label: label,
        namespace: namespace,
        func: cb
      });
    };

    function trigger(label, data) {
      eventsRegister
        .filter(e => (e.label == label))
        .forEach(e => {
          e.func(...data);
        });
    }

    this.send = function(label, data) {
      if (this.connected)
        ws.send(JSON.stringify([label, data]));
    };


    ws.on('message', console.log);
    ws.on('close', () => {
      this.connected = false;
    });

  };

  wss.on('connection', function(ws) {
    var clientConn = new clientOp(ws);
    clients.push(clientConn);
    trigger('connect', [clientConn]);
  });

  var eventsRegister = [];
  this.on = function(label, cb) {
    if (typeof cb != 'function') return;
    var namespace = label.split('.');
    label = namespace.pop();
    namespace = namespace.join('.');
    eventsRegister.push({
      label: label,
      namespace: namespace,
      func: cb
    });
  };

  function trigger(label, data) {
    eventsRegister
      .filter(e => (e.label == label))
      .forEach(e => {
        e.func(...data);
      });
  }

  function generateUID() {
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ('000' + firstPart.toString(36)).slice(-3);
    secondPart = ('000' + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
  }

};




var pws = new socketServer(8585);

pws.on('connect', (client => {
  console.log(client);
  client.send('hullo', {
    w: 123
  });
}));

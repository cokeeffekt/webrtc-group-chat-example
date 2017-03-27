const uws = require('uws');

module.exports = function (sRedis) {

  return function (options) {

    // TODO: will need some checking of the options object here.
    options.auth = options.auth || function (token, accept) {
      accept();
    };
    options.port = options.port || 8080;

    var WebSocketServer = uws.Server;
    var wss = new WebSocketServer({
      port: options.port
    });
    var clients = [];

    wss.on('connection', (ws) => {
      var clientConn = new clientConnection(ws, options.auth);
      clients.push(clientConn);
      // this.trigger('connect', [clientConn]);
      clientConn.authClient();
    });

    sRedis.on('pwsBroadcast', function (payload) {
      clients.forEach(client => {
        client.send(...payload);
      });
    });

    sRedis.on('ws:client-connected', function (s) {
      clients.filter(c => {
        return (c.token == s.token && s.id != c.id);
      }).forEach(c => {
        c.send('_kickConnection', null);
        setTimeout(c.close, 100);
      });
    });

    sRedis.on('ws:client-disconnected', function (s) {
      var fi = clients.findIndex(c => c.id == s.id);
      if (fi > -1)
        clients.splice(fi);
    });

    sRedis.on('ws:send-message', function (body) {
      var [too, event, payload] = body;
      var sendto = [];
      if (typeof too == 'string')
        sendto = clients.filter(c => c.id == too);
      sendto.forEach(client => {
        client.send(event, payload);
      });
    });

    sRedis.on('ws:whos-online', function (olReplyId) {
      sRedis.poly(olReplyId, clients.map(c => {
        return {
          id: c.id,
          metadata: c.metadata,
          connected: c.connected,
          authenticated: c.authenticated,
        };
      }));
    });
  };

  function clientConnection(ws, authFunction) {
    var token = ws.upgradeReq.url.match(/token\=([a-z0-9\-]+)/i);
    if (token)
      token = token[1];
    Object.assign(this, {
      id: process.pid + ':' + generateUID(),
      token: token,
      socket: ws,
      connected: true,
      authenticated: false,
      metadata: null
    });

    this.send = function (event, payload) {
      if ((this.connected && this.authenticated) || event == '_denyAuth')
        ws.send(JSON.stringify([event, payload]));
    };

    this.close = function () {
      ws.close();
    };

    var acceptAuth = (metadata) => {
      this.metadata = metadata;
      this.authenticated = true;
      sRedis.poly('ws:client-connected', {
        token: this.token,
        id: this.id,
      });
      // runHandle('ws:clientConnected', {
      //   token: this.token,
      //   id: this.id,
      //   metadata: this.metadata
      // });
      this.send('_acceptAuth', {
        token: this.token,
        id: this.id,
        metadata: this.metadata
      });
    };
    var denyAuth = () => {
      this.send('_denyAuth', null);
      setTimeout(this.close, 100);
    };

    this.authClient = function () {
      authFunction(this.token, acceptAuth, denyAuth);
    };

    var libReserved = {
      _mehtodo: (data) => {
        console.log();
      }
    };

    ws.on('message', e => {
      if (!this.connected || !this.authenticated) return;
      try {
        var [event, data, reply] = JSON.parse(e);
        sRedis.mono('ws:' + event, {
          from: {
            id: this.id,
            metadata: this.metadata,
            token: this.token
          },
          payload: data
        }, (reply ? (data) => {
          this.send('_reply', JSON.stringify([reply, data]));
        } : undefined));
      } catch (err) {
        console.log(err);
      }
    });

    ws.on('close', () => {
      this.connected = false;
      this.authenticated = false;
      sRedis.mono('ws:client-disconnected', {
        metadata: this.metadata,
        token: this.token,
        id: this.id,
      });
    });
  }
};
const express = require('express')();
const socketServer = require('./pws.js').socketServer;

express.listen(8484, null, function () {
  console.log(process.pid + ' => Listening on port ' + 8484);
});

express.get('/', function (req, res) {
  console.log(process.pid + ' => Loaded Index');
  res.sendfile('./uws-frame.html');
});
express.get('/client.html', function (req, res) {
  console.log(process.pid + ' => Loaded Frame');
  res.sendfile('./uws-client.html');
});

var pws = new socketServer({
  port: 8585,
  auth: function (token, accept, deny) {
    if (token.substr(0, 6) == 'abc123')
      return accept('nullo');
    deny();
  }
});
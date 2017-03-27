const pws = require('./pws.js');

pws.handle('ping', function (data, reply) {
  this.reply(process.pid);
});

pws.handle('broadcast', function (payload) {
  pws.broadcast('derka', payload);
});

pws.handle('clientConnected', function (payload) {
  pws.broadcast('Client connected', payload.id);
});

pws.handle('clientDisconnected', function (payload) {
  console.log('Client Disonnected');
});

pws.handle('onlinelist', function () {
  pws.onlinelist().then(list => {
    console.log(this.from);
    pws.send(this.from.id, 'derka', list);
  });
});

pws.handle('sendto', function (payload) {
  var [to, data] = payload;
  pws.send(to, 'derka', data + this.from.id);
});
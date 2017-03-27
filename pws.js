const snubRedis = require('./snub-redis.js');
const snubWebSockets = require('./snub-ws.js');
const snubHandle = require('./snub-handle.js');

const sRedis = new snubRedis();
const sWebSockets = snubWebSockets(sRedis);
const sHandle = snubHandle(sRedis);

module.exports = {
  socketServer: sWebSockets,
  handle: sHandle.on,
  broadcast: broadcast,
  send: sendEvent,
  onlinelist: onlinelist
};

// broadcast to all clients
function broadcast(event, payload) {
  sRedis.poly('pwsBroadcast', [event, payload]);
}

function sendEvent(too, event, payload) {
  sRedis.poly('pwsSendEvent', [too, event, payload]);
}

function onlinelist() {
  var olReplyId = generateUID();
  var list = [];
  sRedis.on(olReplyId, (l) => {
    list = list.concat(l);
  });
  sRedis.poly('pwsOnlinelist', olReplyId);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(list);
    }, 1000);
  });
}

// CLIENT Connections

giveEvents(clientConnection);

function generateUID() {
  var firstPart = (Math.random() * 46656) | 0;
  var secondPart = (Math.random() * 46656) | 0;
  firstPart = ('000' + firstPart.toString(36)).slice(-3);
  secondPart = ('000' + secondPart.toString(36)).slice(-3);
  return firstPart + secondPart;
}

function giveEvents(obj) {
  var _eventsRegister = [];
  obj.prototype._eventsRegister = function () {
    return _eventsRegister;
  };
  obj.prototype.on = function (ilabel, cb) {
    if (typeof cb != 'function') return;
    var [label, namespace] = ilabel.split('.');
    _eventsRegister.push({
      label: label,
      regex: new RegExp(label.replace('*', '.+')),
      namespace: namespace,
      func: cb
    });
  };
  obj.prototype.trigger = function (label, data) {
    data = data || [];
    _eventsRegister
      .filter(e => label.match(e.regex))
      .forEach(e => {
        e.func(...data, label, e.label + (e.namespace ? '.' + e.namespace : ''));
      });
  };
}
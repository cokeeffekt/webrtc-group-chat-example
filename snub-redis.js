module.exports = function (prefix) {
  prefix = ((prefix || '').replace(':', '') || 'uniSub') + ':';
  const Redis = require('ioredis');
  const redis = new Redis();
  const pub = new Redis();
  var eventsRegistered = [];

  redis.on('message', (channel, message) => {
    channel = channel.split(':');
    channel.shift();
    channel = channel.join(':');

    var e = eventsRegistered.filter(e => e.channel == channel) || [];
    e.forEach(e => {
      if (message.includes('unisub:mono:')) {
        // mono messages get delivered once.
        setTimeout(() => {
          pub.pipeline([
            ['get', message],
            ['del', message]
          ]).exec((err, response) => {
            if (err) return;
            var [getR, delR] = response;
            if (delR[1]) {
              var data;
              try {
                data = JSON.parse(getR[1]);
              } catch (e) {}
              if (data.reply) {
                e.method(data.contents, (replyData) => {
                  this.poly('unireply:' + data.key, replyData);
                });
              } else {
                e.method(data.contents);
              }
              e.count++;
              if (e.once)
                this.off(e.channel + (e.namespace ? '.' + e.namespace : ''));
            }
          });
        }, Math.round(Math.random()));

      } else {
        // everything else goes via normal means
        var data;
        try {
          data = JSON.parse(message);
        } catch (e) {}
        if (data.reply) {
          e.method(data.contents, (replyData) => {
            this.poly('unireply:' + data.key, replyData);
          });
        } else {
          e.method(data.contents);
        }
        if (e.once)
          this.off(e.channel + (e.namespace ? '.' + e.namespace : ''));
      }
    });
  });

  this.on = function (ichannel, method, once) {
    var [channel, namespace] = ichannel.split('.');
    redis.psubscribe(prefix + channel, err => {
      eventsRegistered.push({
        channel: channel,
        namespace: namespace,
        method: method,
        once: once,
        count: 0
      });
    });
  };

  this.off = function (ichannel) {
    var [channel, namespace] = ichannel.split('.');
    eventsRegistered
      .filter(e => (e.channel == channel && e.namespace == namespace))
      .map(v => eventsRegistered.findIndex(f => f == v))
      .reverse().forEach(i => eventsRegistered.splice(i, 1));
    if (!eventsRegistered.find(e => e.channel == channel))
      redis.punsubscribe(prefix + channel);
  };

  // send to one listener
  this.mono = function (channel, data, reply) {
    var obj = {
      key: generateUID(),
      contents: data,
      reply: (typeof reply == 'function' ? true : false)
    };
    pub.set('unisub:mono:' + obj.key, JSON.stringify(obj)).then(res => {
      if (obj.reply) {
        this.on('unireply:' + obj.key, reply);
        // kill the reply listener after 5 seconds, we dont need jank sitting in the registered events
        setTimeout(() => {
          this.off('unireply:' + obj.key);
        }, 5000);
      }
      pub.publish(prefix + channel, 'unisub:mono:' + obj.key);
    }).catch(() => {});
  };

  // sending messages to everone listening
  this.poly = function (channel, data, reply) {
    var obj = {
      key: generateUID(),
      contents: data,
      reply: (typeof reply == 'function' ? true : false)
    };
    if (obj.reply) {
      this.on('unireply:' + obj.key, reply);
      // kill the reply listener after 10 seconds, we dont need jank sitting in the registered events
      setTimeout(() => {
        this.off('unireply:' + obj.key);
      }, 10000);
    }
    pub.publish(prefix + channel, JSON.stringify(obj));
  };

  // // key value stores;
  // this.set = function (key, value, ttl) {
  //   key = 'snubKeyVal:' + key;
  //   return new Promise((resolve, reject) => {
  //     pub.set(key, JSON.stringify(value), ttl).then(res => {
  //       resolve(res);
  //     }).catch(reject);
  //   });
  // };

  // this.get = function (key) {
  //   key = 'snubKeyVal:' + key;
  //   return new Promise((resolve, reject) => {
  //     pub.get(key).then(res => {
  //       try {
  //         resolve(JSON.parse(res));
  //       } catch (e) {
  //         resolve(null);
  //       }
  //     }).catch(reject);
  //   });
  // };

  // this.del = function (key) {
  //   key = 'snubKeyVal:' + key;
  //   return new Promise((resolve, reject) => {
  //     pub.del(key).then(res => {
  //       try {
  //         resolve(JSON.parse(res));
  //       } catch (e) {
  //         resolve(null);
  //       }
  //     }).catch(reject);
  //   });
  // };

  function generateUID() {
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ('000' + firstPart.toString(36)).slice(-3);
    secondPart = ('000' + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
  }

};
module.exports = function(config) {

  config = Object.assign({
    prefix: 'snub',
    port: 6379,
    host: '127.0.0.1',
    debug: false,
    timeout: 5000
  }, config || {});

  var snubSelf = this;
  var prefix = config.prefix.replace(/\:/igm, '') + ':';
  const Redis = require('ioredis');
  const redis = new Redis(config);
  const pub = new Redis(config);
  var eventsRegistered = [];

  redis.on('pmessage', (pattern, channel, message) => {

    if (config.debug)
      console.log('Snub redis.message => ', channel, pattern);

    pattern = pattern.split(':');
    pattern.shift();
    pattern = pattern.join(':');

    var e = eventsRegistered.filter(e => e.channel == pattern) || [];
    e.sort(() => Math.round(Math.random() * 2) - 1).forEach(e => {
      if (message.includes(prefix + '_mono:')) {
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
                  this.poly(prefix + '_monoreply:' + data.key, replyData).send();
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
            this.poly(prefix + '_monoreply:' + data.key, replyData).send();
          });
        } else {
          e.method(data.contents);
        }
        if (e.once)
          this.off(e.channel + (e.namespace ? '.' + e.namespace : ''));
      }
    });
  });

  this.on = function(ichannel, method, once) {
    var [channel, namespace] = ichannel.split('.');

    if (config.debug)
      console.log('Snub.on => ', prefix + channel);
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

  this.off = function(ichannel) {
    var [channel, namespace] = ichannel.split('.');
    if (config.debug)
      console.log('Snub.off => ', prefix + channel);
    eventsRegistered
      .filter(e => (e.channel == channel && e.namespace == namespace))
      .map(v => eventsRegistered.findIndex(f => f == v))
      .reverse().forEach(i => eventsRegistered.splice(i, 1));
    if (!eventsRegistered.find(e => e.channel == channel))
      redis.punsubscribe(prefix + channel);
  };

  // send to one listener
  this.mono = function(channel, data) {
    if (config.debug)
      console.log('Snub.mono => ', prefix + channel);
    var obj = {
      key: generateUID(),
      contents: data,
      reply: false
    };
    var tmpReply;
    return {
      replyAt: function(replyMethod) {
        obj.reply = (typeof replyMethod == 'function' ? true : false);
        if (obj.reply)
          tmpReply = replyMethod;
        return this;
      },
      send: function(cb) {
        cb = (typeof cb == 'function' ? cb : function() {});
        pub.set(prefix + '_mono:' + obj.key, JSON.stringify(obj)).then(res => {
          if (obj.reply) {
            snubSelf.on(prefix + '_monoreply:' + obj.key, tmpReply);
            setTimeout(() => {
              snubSelf.off(prefix + '_monoreply:' + obj.key);
            }, config.timeout);
          }
          pub.publish(prefix + channel, prefix + '_mono:' + obj.key, (err, count) => {
            cb((err || count < 1 ? false : true));
          });
        }).catch(err => {
          if (config.debug)
            console.log('ERROR Snub.mono', err);
          cb(false);
        });
      },
    };
  };

  // sending messages to everone listening
  this.poly = function(channel, data) {
    if (config.debug)
      console.log('Snub.poly => ', prefix + channel);
    var obj = {
      key: generateUID(),
      contents: data,
      reply: false
    };
    var tmpReply;
    return {
      replyAt: function(replyMethod) {
        if (typeof replyMethod != 'function') return this;
        snubSelf.on(prefix + '_monoreply:' + obj.key, reply);
        setTimeout(() => {
          snubSelf.off(prefix + '_monoreply:' + obj.key);
        }, config.timeout);
        return this;
      },
      send: function(cb) {
        cb = (typeof cb == 'function' ? cb : function() {});
        pub.publish(prefix + channel, JSON.stringify(obj), (err, count) => {
          cb((err || count < 1 ? false : true));
        });
      },
    };
  };

  function generateUID() {
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ('000' + firstPart.toString(36)).slice(-3);
    secondPart = ('000' + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
  }

  this.generateUID = generateUID;

  this.use = function(method) {
    if (typeof method == 'function')
      method(snubSelf);
  };

};

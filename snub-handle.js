modules.exports = function (sRedis) {
  return {
    on: function (event, method) {
      sRedis.on('pwsHandle:' + event, function (data, reply) {
        var bind = {
          from: data.from || null,
          reply: (typeof reply == 'function' ? reply : () => {}),
          broadcast: broadcast,
          send: sendEvent
        };
        method.apply(bind, [data.payload || data]);
      });
    },
    run: function (event, payload, reply) {
      sRedis.mono('pwsHandle:' + event, payload, reply);
    }
  };
};
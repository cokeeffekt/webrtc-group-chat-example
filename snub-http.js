const http = require('http');
const querystring = require('querystring');
const url = require('url');

module.exports = function(config) {
  config = Object.assign({
    port: 8080,
    debug: false,
    timeout: 5000
  }, config || {});

  return function(snub) {
    const requestHandler = (request, response) => {
      var urlParsed = url.parse(request.url);
      var reqObj = {
        method: request.method,
        path: urlParsed.pathname,
        body: [],
        token: request.headers['x-auth-token']
      };
      if (urlParsed.query)
        reqObj.query = querystring.parse(urlParsed.query);

      request.on('data', function(chunk) {
        reqObj.body.push(chunk);
      }).on('end', function() {
        reqObj.body = Buffer.concat(reqObj.body).toString();

        try {
          reqObj.body = JSON.parse(reqObj.body);
        } catch (e) {}

        snub
          .mono('http:' + reqObj.method + ':' + reqObj.path, reqObj)
          .replyAt(reply => {
            if (reply.headers)
              Object.keys(reply.headers).forEach(i => {
                response.setHeader(i, reply.headers[i]);
              });
            response.statusCode = reply.statusCode || 200;
            if (typeof reply.body == 'string')
              return response.end(reply.body);
            response.end(JSON.stringify(reply.body));
          })
          .send(delivered => {
            if (delivered) return;
            response.statusCode = 404;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              message: 'Event handler not found'
            }));
          });

        setTimeout(() => {
          if (!response.finished) {
            response.statusCode = 504;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              message: 'Event handler timed out'
            }));
          }
        }, config.timeout);
      });
    };

    const server = http.createServer(requestHandler);

    server.listen(config.port, (err) => {
      if (err) {
        return console.log('something bad happened', err);
      }

      console.log(`server is listening on ${config.port}`);
    });
  };
};

const Snub = require('./snub.js');

const snub = new Snub({
  prefix: 'snub', // prefix redis key / channels
  port: 6379, // redis port
  host: '127.0.0.1', // redis host
  debug: true
});

const snubHttp = require('./snub-http.js');

snub.use(snubHttp({
  port: 5400
}));

snub.on('h[ae]llo.namespace', (data) => {
  console.log('PASSED1! > ' + data);
});

snub.on('hello', (data) => {
  console.log('PASSED2! > ' + data);
});

snub.on('http:*', function(payload, reply) {
  reply({
    headers: {
      'Content-Type': 'application/json',
    },
    statusCode: 200,
    body: payload
  });
});

snub.mono('hello', 'world').send(console.log);
snub.mono('hello', 'world').send(console.log);
snub.mono('hello', 'world').send(console.log);
snub.mono('hello', 'world').send(console.log);
snub.mono('hello', 'world').send(console.log);
snub.mono('hello', 'world').send(console.log);
snub.mono('hello', 'world').send(console.log);
snub.mono('hello', 'world').send(console.log);
snub.mono('hallo', 'derka').send(console.log);

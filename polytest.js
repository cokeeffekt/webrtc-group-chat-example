const Snub = require('./snub.js');
const snub = new Snub();


var instance = Math.round(Math.random() * 1000);

console.log(instance + ' => Im listening');

snub.on('listen-to-me', (data) => {
  console.log(instance + ' => got a message', data);
});

setTimeout(() => {
  snub.mono('listen-to-me', 'hello?');
}, 3000);
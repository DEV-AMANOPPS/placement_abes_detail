const pdf = require('pdf-parse');
console.log('Type of require("pdf-parse"):', typeof pdf);
console.log('Keys of require("pdf-parse"):', Object.keys(pdf));
console.log('Is pdf a function?', typeof pdf === 'function');

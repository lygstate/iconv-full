var x = new Buffer([0xee, 0xa1, 0xa4]).toString('utf8')
console.log(new Buffer(x, 'UTF-16le').toString('hex'))

x = new Buffer([0xee, 0xa1, 0xa4]).toString('utf8')

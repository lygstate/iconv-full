var assert = require('assert')
var iconv = require('..')

describe('testing the cp936/gbk euro dollor symbol', function () {
  it('test gbk pua decode', function () {
    // Convert from an encoded buffer to js string.
    var str = ''

    str = iconv.decode(new Buffer([0xFE, 0x50]), 'gb18030')
    assert.equal(str, '\u2E81')

    str = iconv.decode(new Buffer([0xFE, 0x50]), 'gb18030')
  })

  it('test gbk pua encode', function () {
    var buffer = new Buffer([])

    buffer = iconv.encode('\u2E81', 'gb18030')
    assert.equal(buffer.toString('hex'), 'fe50')
  })
})

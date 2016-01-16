var assert = require('assert')
var iconv = require('..')

describe('testing the cp936/gbk euro dollor symbol', function () {
  it('test cp936 decode Euro dollor symbol', function () {
    // Convert from an encoded buffer to js string.
    var str = ''
    str = iconv.decode(new Buffer([0x80]), 'gb2312')
    assert.equal(str, '€')

    str = iconv.decode(new Buffer([0x80]), 'cp936')
    assert.equal(str, '€')

    str = iconv.decode(new Buffer([0x80]), 'gbk')
    assert.equal(str, '€')

    str = iconv.decode(new Buffer([0x80]), 'gb18030')
    assert.equal(str, '€')

    // Decode a2e3
    str = iconv.decode(new Buffer([0xa2, 0xe3]), 'gb2312')
    assert.equal(str.charCodeAt(0), 0xfffD)

    str = iconv.decode(new Buffer([0xa2, 0xe3]), 'cp936')
    assert.equal(str.charCodeAt(0), 0xfffD)

    str = iconv.decode(new Buffer([0xa2, 0xe3]), 'gbk')
    assert.equal(str, '€')

    str = iconv.decode(new Buffer([0xa2, 0xe3]), 'gb18030')
    assert.equal(str, '€')
  })

  it('test cp936 encode Euro dollor symbol', function () {
    var buffer = new Buffer([])

    buffer = iconv.encode('€', 'gb2312')
    assert.equal(buffer.toString('hex'), '80')

    buffer = iconv.encode('€', 'cp936')
    assert.equal(buffer.toString('hex'), '80')

    buffer = iconv.encode('€', 'gbk')
    assert.equal(buffer.toString('hex'), '80')

    // https://en.wikipedia.org/wiki/GB_18030
    buffer = iconv.encode('€', 'gb18030')
    assert.equal(buffer.toString('hex'), 'a2e3')
  })
})

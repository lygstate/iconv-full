const fs = require('fs')
const assert = require('assert')
const iconv = require(__dirname + '/../')

const testString = '中国abc' // unicode contains GBK-code and ascii
const testStringGBKBuffer = new Buffer([0xd6, 0xd0, 0xb9, 0xfa, 0x61, 0x62, 0x63])

describe('GBK tests', function () {
  it('GBK correctly encoded/decoded', function () {
    assert.strictEqual(iconv.encode(testString, 'GBK').toString('binary'), testStringGBKBuffer.toString('binary'))
    assert.strictEqual(iconv.decode(testStringGBKBuffer, 'GBK'), testString)
  })

  it('GB2312 correctly encoded/decoded', function () {
    assert.strictEqual(iconv.encode(testString, 'GB2312').toString('binary'), testStringGBKBuffer.toString('binary'))
    assert.strictEqual(iconv.decode(testStringGBKBuffer, 'GB2312'), testString)
  })

  it('GBK file read decoded,compare with iconv result', function () {
    var contentBuffer = fs.readFileSync(__dirname + '/gbkFile.txt')
    var str = iconv.decode(contentBuffer, 'GBK')
    var iconvc = new (require('iconv').Iconv)('GBK', 'utf8')
    assert.strictEqual(iconvc.convert(contentBuffer).toString(), str)
  })

  it('GBK correctly decodes and encodes characters · and ×', function () {
    // https://github.com/ashtuchkin/iconv-lite/issues/13
    // Reference: http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP936.TXT
    var chars = '·×'
    var gbkChars = new Buffer([0xA1, 0xA4, 0xA1, 0xC1])
    assert.strictEqual(iconv.encode(chars, 'GBK').toString('binary'), gbkChars.toString('binary'))
    assert.strictEqual(iconv.decode(gbkChars, 'GBK'), chars)
  })
})

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

    // Decode a2e3
    str = iconv.decode(new Buffer([0xa2, 0xe3]), 'gb2312')
    assert.equal(str, '€')

    str = iconv.decode(new Buffer([0xa2, 0xe3]), 'cp936')
    assert.equal(str, '€')

    str = iconv.decode(new Buffer([0xa2, 0xe3]), 'gbk')
    assert.equal(str, '€')
  })

  it('test cp936 encode Euro dollor symbol', function () {
    var buffer = new Buffer([])

    buffer = iconv.encode('€', 'gb2312')
    assert.equal(buffer.toString('hex'), 'a2e3')

    buffer = iconv.encode('€', 'cp936')
    assert.equal(buffer.toString('hex'), 'a2e3')

    // encodeEuro default is false
    buffer = iconv.encode('€', 'gbk', {encodeEuro: false})
    assert.equal(buffer.toString('hex'), 'a2e3')

    buffer = iconv.encode('€', 'gbk', {encodeEuro: true})
    assert.equal(buffer.toString('hex'), 'a2e3')
  })
})

'use strict'

var assert = require('assert')
var iconv = require('..')

describe('testing the cp936/gbk euro dollor symbol', function () {
  // http://www.fmddlmyy.cn/text30.html

  // Unicode、GB2312、GBK和GB18030中的汉字
  // http://www.fmddlmyy.cn/text24.html
  it('test gbk pua decode', function () {
    // Convert from an encoded buffer to js string.
    var str = ''

    str = iconv.decode(new Buffer([0xFE, 0x50]), 'gb18030')
    assert.equal(str, '\u2E81')

    str = iconv.decode(new Buffer([0xFE, 0x51]), 'gb18030')
    assert.equal(str.length, 1)
    assert.equal(str, '') // It's to PUA

    str = iconv.decode(new Buffer([0xFE, 0x52]), 'gb18030')
    assert.equal(str, '\uE817') // It's to PUA

    str = iconv.decode(new Buffer([0xFE, 0x53]), 'gb18030')
    assert.equal(str, '\uE818') // It's to PUA

    str = iconv.decode(new Buffer([0xFE, 0x54]), 'gb18030')
    assert.equal(str, '\u2E84')

    str = iconv.decode(new Buffer([0xFE, 0x59]), 'gb18030')
    assert.equal(str, '') // '\u9FB4' It's to PUA
  })

  it('test gbk pua encode', function () {
    var buffer = new Buffer([])

    buffer = iconv.encode('\u2E81', 'gb18030')
    assert.equal(buffer.toString('hex'), 'fe50')
  })
})

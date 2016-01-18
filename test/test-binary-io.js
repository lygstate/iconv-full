'use strict'

var assert = require('assert')

import { BinaryIO, BinaryInput } from '../src/BinaryIO'

describe('testing BinaryIO', function () {
  // http://www.fmddlmyy.cn/text30.html

  // Unicode、GB2312、GBK和GB18030中的汉字
  // http://www.fmddlmyy.cn/text24.html
  it('test BinaryIO constructor pua decode', function () {
    let buffer = BinaryIO.stringToBinaryBuffer('\u0000\u0001')
    assert.equal(buffer.length, 4)
    expect(buffer.toString()).to.equal('0,0,0,1')
    let binaryInput = new BinaryInput()
    assert.equal(binaryInput.length, 0)
    assert.equal(binaryInput.capacity, 1024)
  })
})

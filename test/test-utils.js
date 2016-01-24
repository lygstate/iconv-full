'use strict'

const utils = require('../generation/utils')
const { BinarySearch, Converter } = require('../encodings/utils')
const assert = require('assert')

describe('test generation utils', function () {
  it('test compressArray', function () {
    let compressed
    compressed = utils.compressArray([0, 0xFFFF])
    assert.equal(compressed.length, 2)
    assert.deepEqual(compressed.offsets, [0, 1, 2])
    assert.deepEqual(compressed.planes, [0, 0xFFFF])
    assert.deepEqual(compressed.planeOffsets, [0, 2])
    assert.deepEqual(compressed.extraPlane, [])
    assert.deepEqual(compressed.extraOffsets, [0])

    compressed = utils.compressArray([0, 0xFFFF, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    assert.equal(compressed.length, 5)
    assert.deepEqual(compressed.offsets, [0, 1, 2])
    assert.deepEqual(compressed.planes, [0, 0xFFFF])
    assert.deepEqual(compressed.planeOffsets, [0, 2])
    assert.deepEqual(compressed.extraPlane, [0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    assert.deepEqual(compressed.extraOffsets, [0, 1, 2, 3])

    compressed = utils.compressArray([0, 0xFFFF, 0x20FFF, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    assert.equal(compressed.length, 6)
    assert.deepEqual(compressed.offsets, [0, 1, 2, 3])
    assert.deepEqual(compressed.planes, [0, 0xFFFF, 0x0FFF])
    assert.deepEqual(compressed.planeOffsets, [0, 2, 2, 3])
    assert.deepEqual(compressed.extraPlane, [0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    assert.deepEqual(compressed.extraOffsets, [0, 1, 2, 3])

    compressed = utils.compressArray([0, 0xFFFE, 0xFFFF, 0x10000, 0x10001, 0x20FFF, 0x21000, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    assert.equal(compressed.length, 10)
    assert.deepEqual(compressed.offsets, [0, 1, 3, 5, 7])
    assert.deepEqual(compressed.planes, [0, 0xFFFE, 0, 0xFFF])
  })

  it('test converter.indexOfCodePoint', function () {
    this.timeout(10000)
    let compressed
    let pos
    let converter
    compressed = utils.compressArray([0, 0xFFFF, 0x20FFF, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    converter = new Converter(compressed)
    pos = converter.indexOfCodePoint(0x21FFFF)
    expect(pos).to.equal(4)
    pos = converter.indexOfCodePoint(0x20FFFF)
    expect(pos).to.equal(3)
    pos = converter.indexOfCodePoint(0x21FFFE)
    expect(pos).to.equal(-1)
    pos = converter.indexOfCodePoint(0x22FFF0)
    expect(pos).to.equal(-1)
    pos = converter.indexOfCodePoint(0x00CA << 16 | 0x0304)
    expect(pos).to.equal(5)
    pos = converter.indexOfCodePoint((0x00CA << 16 | 0x0304) + 1)
    expect(pos).to.equal(-1)

    pos = converter.indexOfCodePoint(0)
    expect(pos).to.equal(0)
    pos = converter.indexOfCodePoint(1)
    expect(pos).to.equal(-1)

    pos = converter.indexOfCodePoint(0xFFFF)
    expect(pos).to.equal(1)

    pos = converter.indexOfCodePoint(0x10000)
    expect(pos).to.equal(-1)
    pos = converter.indexOfCodePoint(0x1FFFF)
    expect(pos).to.equal(-1)
    pos = converter.indexOfCodePoint(0x20000)
    expect(pos).to.equal(-1)
    pos = converter.indexOfCodePoint(0x20FFF)
    expect(pos).to.equal(2)

    compressed = utils.compressArray([0, 0xFFFF, 0x20FFF, 0x21000, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    converter = new Converter(compressed)
    pos = converter.indexOfCodePoint(0x21000)
    expect(pos).to.equal(3)

    compressed = utils.compressArray([0, 0xFFFE, 0xFFFF, 0x10000, 0x10001, 0x20FFF, 0x21000, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    converter = new Converter(compressed)
    pos = converter.indexOfCodePoint(0xFFFE)
    expect(pos).to.equal(1)
    pos = converter.indexOfCodePoint(0)
    expect(pos).to.equal(0)
    pos = converter.indexOfCodePoint(0xFFFF)
    expect(pos).to.equal(2)

    for (let i = 0; i < 10000; ++i) {
      converter.indexOfCodePoint(0xFFFF)
    }
    let start = Date.now()
    let bytes = 20000000
    for (let i = 0; i < (bytes >> 1); ++i) {
      converter.indexOfCodePoint(0xFFFE)
    }
    let rate = bytes / (((Date.now() - start) / 1000) * (1024 * 1024))
    console.log(`Speed rate: ${rate.toFixed(2)}MByte/s`)
  })

  it('test converter.codePointOfIndex', function () {
    this.timeout(10000)
    let compressed
    let converter
    let array = [0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0x10, 0x11, 0x12, 0x13, 0x1000, 0xFFFE, 0xFFFF]
    compressed = utils.compressArray(array)
    converter = new Converter(compressed)
    assert.equal(converter.codePointOfIndex(-1), -1)
    let result = []
    for (let i = 0; i < array.length; ++i) {
      result.push(converter.codePointOfIndex(i))
    }
    assert.deepEqual(result, array)
    assert.equal(converter.codePointOfIndex(array.length), -1)
    let start = Date.now()
    let bytes = 20000000
    for (let i = 0; i < (bytes >> 1); ++i) {
      converter.codePointOfIndex(i & 2)
    }
    let rate = bytes / (((Date.now() - start) / 1000) * (1024 * 1024))
    console.log(`Speed rate: ${rate.toFixed(2)}MByte/s`)
  })

  it('test binary Search', function () {
    assert.equal(BinarySearch([0, 1], 0, 2, -2), -1)
    assert.equal(BinarySearch([0, 1], 0, 2, -1), -1)
    assert.equal(BinarySearch([0, 1], 0, 2, 0), 0)
    assert.equal(BinarySearch([0, 1], 0, 2, 1), 1)
    assert.equal(BinarySearch([0, 1], 0, 2, 2), 1)
    assert.equal(BinarySearch([0, 1], 0, 2, 3), 1)
  })
})

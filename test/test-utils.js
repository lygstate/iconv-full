'use strict'

const utils = require('../generation/utils')
const { BinarySearch, indexOfCodePoint, convertCompressedArray } = require('../encodings/utils')
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

  it('test indexOfCodePoint', function () {
    this.timeout(10000)
    let compressed
    let pos
    compressed = utils.compressArray([0, 0xFFFF, 0x20FFF, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    convertCompressedArray(compressed)
    pos = indexOfCodePoint(compressed, 0x21FFFF)
    expect(pos).to.equal(4)
    pos = indexOfCodePoint(compressed, 0x20FFFF)
    expect(pos).to.equal(3)
    pos = indexOfCodePoint(compressed, 0x21FFFE)
    expect(pos).to.equal(-1)
    pos = indexOfCodePoint(compressed, 0x22FFF0)
    expect(pos).to.equal(-1)
    pos = indexOfCodePoint(compressed, 0x00CA << 16 | 0x0304)
    expect(pos).to.equal(5)
    pos = indexOfCodePoint(compressed, (0x00CA << 16 | 0x0304) + 1)
    expect(pos).to.equal(-1)

    pos = indexOfCodePoint(compressed, 0)
    expect(pos).to.equal(0)
    pos = indexOfCodePoint(compressed, 1)
    expect(pos).to.equal(-1)

    pos = indexOfCodePoint(compressed, 0xFFFF)
    expect(pos).to.equal(1)

    pos = indexOfCodePoint(compressed, 0x10000)
    expect(pos).to.equal(-1)
    pos = indexOfCodePoint(compressed, 0x1FFFF)
    expect(pos).to.equal(-1)
    pos = indexOfCodePoint(compressed, 0x20000)
    expect(pos).to.equal(-1)
    pos = indexOfCodePoint(compressed, 0x20FFF)
    expect(pos).to.equal(2)

    compressed = utils.compressArray([0, 0xFFFF, 0x20FFF, 0x21000, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    convertCompressedArray(compressed)
    pos = indexOfCodePoint(compressed, 0x21000)
    expect(pos).to.equal(3)

    compressed = utils.compressArray([0, 0xFFFE, 0xFFFF, 0x10000, 0x10001, 0x20FFF, 0x21000, 0x20FFFF, 0x21FFFF, 0x00CA << 16 | 0x0304])
    convertCompressedArray(compressed)
    pos = indexOfCodePoint(compressed, 0xFFFE)
    expect(pos).to.equal(1)
    pos = indexOfCodePoint(compressed, 0)
    expect(pos).to.equal(0)
    pos = indexOfCodePoint(compressed, 0xFFFF)
    expect(pos).to.equal(2)

    for (let i = 0; i < 10000; ++i) {
      indexOfCodePoint(compressed, 0xFFFF)
    }
    let start = Date.now()
    for (let i = 0; i < 20000000; ++i) {
      indexOfCodePoint(compressed, 0xFFFF)
    }
    console.log(`Time consumed ${Date.now() - start}`)
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

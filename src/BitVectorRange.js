const utils = require('../generation/utils')
const errTo = require('errto')
const async = require('async')
const { BinarySearch } = require('../encodings/utils')
const BitVector = require('./BitVector')

function convertTable (tableText) {
  let dbcs = []
  utils.parseText(tableText).map(function (a) {
    let dbcsCode = parseInt(a[0], 0)
    let unicode = parseInt(a[1], 16)
    if (!isNaN(unicode)) {
      dbcs.push([dbcsCode, unicode])
    }
  })
  return dbcs
}

exports.computePos = (intArray, msb, offset) => {
  let startValue = offset
  let endValue = offset + (1 << msb)
  let startPos = BinarySearch(intArray, 0, intArray.length, startValue) + 1
  let endPos = BinarySearch(intArray, 0, intArray.length, endValue) + 1
  return [startPos, endPos]
}

function createBitVectorRangeSet (intArray, uint16Array, uint16ArraySize, msb, offset) {
  let [startPos, endPos] = exports.computePos(intArray, msb, offset)
  let bitVector16 = 0 // new Array(16)
  for (let i = startPos; i < endPos; ++i) {
    bitVector16 |= 1 << ((intArray[i] >> (msb - 4)) & 0xF)
  }
  uint16Array[uint16ArraySize] = bitVector16
  if (msb === 4) {
    return [startPos, uint16ArraySize + 1]
  }
  let count = BitVector.popcount(bitVector16)
  console.log(count)
  let newArraySize = uint16ArraySize + 1 + count
  for (let i = 0; i < 16; ++i) {
    if (bitVector16 & (1 << i)) {
      let [startPos, resultArraySize] = createBitVectorRangeSet(intArray, uint16Array, newArraySize)
      newArraySize = resultArraySize
    }
  }
  console.log(bitVector16, startPos, endPos, intArray.length)
}

function createCompactTable (table) {
  let keys = []
  let values = []
  for (let [key, value] of table) {
    keys.push(key)
    values.push(value)
  }
  let uint16Array = new Uint16Array(65536)
  createBitVectorRangeSet(keys, uint16Array, 0, 16, 0)
}

async.parallel({
  $big5: utils.getFile.bind(null, 'http://encoding.spec.whatwg.org/index-big5.txt')
}, errTo(console.log, function (data) {
  // First, parse all files.
  for (let enc in data) {
    data[enc] = convertTable(data[enc])
  }
  createCompactTable(data['$big5'])
  console.log()
}))

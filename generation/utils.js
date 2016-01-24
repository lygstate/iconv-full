'use strict'

const fs = require('fs-extra')
const request = require('request')
const path = require('path')
const errTo = require('errto')

const { UNICODE_MAX_CODEPOINT } = require('../encodings/utils')

// Common utilities used in scripts.

exports.getFile = function (url, cb) {
  let fullpath = path.join(__dirname, 'source-data', path.basename(url))
  fs.readFile(fullpath, 'utf8', function (err, text) {
    if (!err) return cb(null, text)
    if (err.code !== 'ENOENT') return cb(err)
    request(url, errTo(cb, function (res, text) {
      fs.writeFile(fullpath, text, errTo(cb, function () {
        cb(null, text)
      }))
    }))
  })
}

// Returns array of arrays.
exports.parseText = function (text, splitChar) {
  return text.split('\n').map(function (line) {
    return line.split('#')[0].trim()
  }).filter(Boolean).map(function (line) {
    return line.split(splitChar || /\s+/).map(function (s) { return s.trim() }).filter(Boolean)
  })
}

// Convert array of character codes to string. Character codes can be > 0xFFFF,
// so we emit surrogates when needed. Also, some character codes are actually
// sequences (arrays) - we emit them prepended with U+0FFF-(length-2).
// U+0FFF was chosen because it's small and unassigned, as well as 32 chars before it
exports.arrToStr = (arr) => {
  let s = ''
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      if (arr[i].length === 1) {
        s += exports.arrToStr(arr[i])
      } else if (arr[i].length > 1) {
        s += String.fromCharCode(0xFFF - (arr[i].length - 2)) + exports.arrToStr(arr[i])
      }
    } else if (arr[i] > 0xFFFF) {
      // Surrogates
      s += String.fromCharCode(0xD800 + Math.floor((arr[i] - 0x10000) / 0x400)) +
        String.fromCharCode(0xDC00 + (arr[i] - 0x10000) % 0x400)
    } else {
      // Basic characters.
      s += String.fromCharCode(arr[i])
    }
  }

  return s
}

function sortNumber (a, b) {
  return a - b
}

exports.sortedIntegerArray = (array) => {
  let keys = array.map((x) => parseInt(x, 10))
  return keys.sort(sortNumber)
}

exports.totalLength = 0

exports.bufferToIntArray = (buffer) => {
  let data = []
  for (let value of buffer.values()) {
    data.push(value)
  }
  return data
}

exports.arrayToSortedMap = (arr) => {
  arr = exports.sortedIntegerArray(Array.from(arr))
  let valuesPos = {}
  for (let i = 0; i < arr.length; ++i) {
    valuesPos[arr[i]] = i
  }

  return {
    array: arr,
    poses: valuesPos
  }
}

exports.compressArray = (array) => {
  let prev = -1
  let offsets = []
  let extraOffsets = []

  let currentOffsets = offsets

  let results = []
  let pos = 0
  let plane = 0xFFFF
  let planes = []
  let planeOffsets = [0]
  let item = 0
  for (item of array) {
    while (item > plane) {
      Array.prototype.push.apply(planes, results)
      planeOffsets.push(planes.length)
      results = []
      if (item > UNICODE_MAX_CODEPOINT) {
        offsets.push(pos)
        pos = 0
        plane = 0xFFFFFFFF
        currentOffsets = extraOffsets
      } else {
        plane += 0x10000
      }
    }
    if (prev + 1 !== item || results.length === 0) {
      currentOffsets.push(pos)
      if (item <= UNICODE_MAX_CODEPOINT) {
        results.push(item & 0xFFFF)
      } else {
        results.push(item)
      }
    }
    prev = item
    ++pos
  }
  let extraStart = 0
  if (plane <= UNICODE_MAX_CODEPOINT) {
    planeOffsets.push(array.length)
    Array.prototype.push.apply(planes, results)
    offsets.push(array.length)
    results = []
    extraOffsets.push(0)
  } else {
    extraStart = offsets[offsets.length - 1]
    extraOffsets.push(pos)
  }
  return {
    length: array.length,
    offsets: offsets,
    planeOffsets: planeOffsets,
    planes: planes,
    extraStart: extraStart,
    extraPlane: results,
    extraOffsets: extraOffsets
  }
}

exports.mapToPermutation = (map) => {
  let keys = exports.arrayToSortedMap(map.keys())
  let values = exports.arrayToSortedMap(map.values())
  let pointerToUnicodes = new Array(keys.array.length)
  let unicodeToPointers = new Array(keys.array.length)
  for (let key of keys.array) {
    pointerToUnicodes[keys.poses[key]] = values.poses[map.get(key)]
    unicodeToPointers[values.poses[map.get(key)]] = keys.poses[key]
  }

  return {
    length: pointerToUnicodes.length,
    pointerToUnicodes: pointerToUnicodes,
    unicodeToPointers: unicodeToPointers,
    pointers: exports.compressArray(keys.array),
    unicodes: exports.compressArray(values.array)
  }
}

// Input: map <dbcs num> -> <unicode num>
// Resulting format: Array of chunks, each chunk is:
// [0] = address of start of the chunk, hex string.
// <str> - characters of the chunk.
// <num> - increasing sequence of the length num, starting with prev character.
exports.generateTable = function (name, dbcs) {
  let tables = []
  let totalSize = 0
  while (dbcs.length > 0) {
    let cacheKey = new Set()
    let cacheValue = new Set()
    let map = new Map()
    let rest = []
    for (let [key, value] of dbcs) {
      if (cacheKey.has(key) || cacheValue.has(value)) {
        if (map.has(key)) {
          console.log('Repeat key', map.get(key) === value)
        }
        rest.push([key, value])
        continue
      }
      cacheKey.add(key)
      cacheValue.add(value)
      map.set(key, value)
    }
    let permutation = exports.mapToPermutation(map)
    permutation.size = permutation.length * 4 +
      (permutation.pointers.offsets.length * 4 + 2) +
      (permutation.unicodes.offsets.length * 4 + 2)
    tables.push(permutation)
    totalSize += permutation.size
    dbcs = rest
  }
  console.log(`Need space for ${name} is ${totalSize} Bytes, table count: ${tables.length}`)
  exports.writeTable(name, tables)
  return tables
}

exports.toJSON = (existIndent, indent, v) => {
  if (Array.isArray(v)) {
    if (v.length <= 0 | v.length > 0 && typeof v[0] !== 'object') {
      return JSON.stringify(v)
    }
    let lists = []
    for (let item of v) {
      let str = exports.toJSON(existIndent + indent, indent, item)
      lists.push(`${existIndent}${indent}{\n${str}\n${existIndent}${indent}}`)
    }
    return `[\n${lists.join(',\n')}\n]`
  }
  if (typeof v === 'object') {
    let items = []
    for (let k in v) {
      let value = v[k]
      let str = exports.toJSON(existIndent + indent, indent, value)
      if (Array.isArray(value) || typeof value !== 'object') {
        items.push(`${existIndent}${indent}"${k}": ${str}`)
      } else {
        items.push(`${existIndent}${indent}"${k}": {\n${str}\n${existIndent}${indent}}`)
      }
    }
    return `${items.join(`,\n`)}`
  }
  return JSON.stringify(v)
}

exports.writeTable = function (name, tables) {
  this.writeFile(name, exports.toJSON('', '  ', tables))
}

exports.writeFile = function (name, body) {
  let tablesDir = path.join(__dirname, '../encodings/tables')
  fs.mkdirsSync(tablesDir)
  fs.writeFileSync(path.join(tablesDir, name + '.json'), body)
}

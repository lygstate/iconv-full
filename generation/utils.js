let fs = require('fs-extra')
let request = require('request')
let path = require('path')
let errTo = require('errto')

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
  let prev = -2
  let offsets = []
  let results = []
  let pos = 0
  for (let item of array) {
    if (prev + 1 !== item) {
      offsets.push(pos)
      results.push(item)
    }
    prev = item
    ++pos
  }
  offsets.push(array.length)
  return [
    [results.length, results],
    [offsets.length, offsets]
  ]
}

exports.mapToPermutation = (map) => {
  let keys = exports.arrayToSortedMap(map.keys())
  let values = exports.arrayToSortedMap(map.values())
  let permutation = []
  for (let key of keys.array) {
    permutation.push([keys.poses[key], values.poses[map.get(key)]])
  }
  let keysCompressed = exports.compressArray(keys.array)
  let valuesCompressed = exports.compressArray(values.array)
  let count = 0
  for (let v of valuesCompressed[0][1]) {
    if (v <= 0xFFFF) {
      count += 1
    }
  }
  return [
    {
      length: permutation.length,
      narrowUnicodeCount: count,
      unicodeCount: valuesCompressed[0][1].length,
      wideUnicodeCount: valuesCompressed[0][1].length - count
    }
  ].concat(keysCompressed, valuesCompressed, [permutation])
}

// Input: map <dbcs num> -> <unicode num>
// Resulting format: Array of chunks, each chunk is:
// [0] = address of start of the chunk, hex string.
// <str> - characters of the chunk.
// <num> - increasing sequence of the length num, starting with prev character.
exports.generateTable = function (dbcs) {
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
  // console.log(rest)
  let table = exports.mapToPermutation(map)
  let totalByte = table[0].length * 2 + table[0].wideUnicodeCount * 2 + (table[1][0] * 4 + 2) + (table[2][0] * 4 + 2)
  console.log(`Expected talbe size is ${totalByte}`)
  // console.log(table)
  return [totalByte].concat([rest.length, rest], table)
}

exports.writeTable = function (name, table) {
  this.writeFile(name, '[\n' + table.map(function (a) { return JSON.stringify(a) }).join(',\n') + '\n]\n')
}

exports.writeFile = function (name, body) {
  let tablesDir = path.join(__dirname, '../encodings/tables')
  fs.mkdirsSync(tablesDir)
  fs.writeFileSync(path.join(tablesDir, name + '.json'), body)
}

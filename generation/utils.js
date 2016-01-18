let fs = require('fs-extra')
let request = require('request')
let path = require('path')
let errTo = require('errto')
import { FMIndex, BinaryOutput } from 'fm-index'

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
function arrToStr (arr) {
  let s = ''
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      if (arr[i].length === 1) {
        s += arrToStr(arr[i])
      } else if (arr[i].length > 1) {
        s += String.fromCharCode(0xFFF - (arr[i].length - 2)) + arrToStr(arr[i])
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

// Input: map <dbcs num> -> <unicode num>
// Resulting format: Array of chunks, each chunk is:
// [0] = address of start of the chunk, hex string.
// <str> - characters of the chunk.
// <num> - increasing sequence of the length num, starting with prev character.
exports.generateTable = function (dbcs) {
  // Do not record the sequence length, cause that
  // doesn't save space much
  let table = []
  let singleString = ''
  let dbcsOffsets = []
  let charLengths = []
  let unicodeOffsets = []
  let charLength = 0
  let offset = 0
  let prevIndex = -2
  let stringList = {}
  for (let i of exports.sortedIntegerArray(Object.keys(dbcs))) {
    const char = arrToStr([dbcs[i]])

    const charString = new Buffer(char, 'utf8').toString('binary')
    if (charString.length === 1 && charString[0].charCodeAt(0) < 0x80) {
      continue
    }
    for (let i = 0; i < charString.length; ++i) {
      if (charString[0].charCodeAt(0) === 0) {
        console.log('Warning, no zero')
      }
    }

    if (!(charString in stringList)) {
      stringList[charString] = []
    }
    stringList[charString].push(singleString.length)
    singleString += charString
    if (prevIndex + 1 !== i || charLength !== charString.length) { // Range started.
      charLength = charString.length
      dbcsOffsets.push(i)
      charLengths.push(charLength)
      unicodeOffsets.push(offset)
    }
    offset += 1
    prevIndex = i
  }
  unicodeOffsets.push(offset)
  let maxCharCode = 1
  for (let i = 0; i < singleString.length; ++i) {
    if (singleString.charCodeAt(i) > maxCharCode) {
      maxCharCode = singleString.charCodeAt(i)
    }
  }
  // if ((maxCharCode & 1) === 1) maxCharCode += 1

  // FIXME: TODO: FMIndex issue: when a single char repeat
  // mutliple times, it's dead lock
  // TODO: FIXME: FMIndex doesn't support for 0 in string
  let fm = new FMIndex()
  fm.push(singleString)
  fm.build(5, 0xFF)

  let dump = new BinaryOutput()
  fm.dump(dump)
  let result = dump.result()
  exports.totalLength += result.length
  exports.totalLength += dbcsOffsets.length * 4
  exports.totalLength += charLengths.length
  exports.totalLength += unicodeOffsets.length * 4
  console.log(`maxCharCode: ${maxCharCode} fm size:${fm.size()} contentSize:${fm.contentSize()} utf8 length:${singleString.length}`)
  console.log(`currentLength:${result.length} totalLength:${exports.totalLength}`)

  table.push(dbcsOffsets)
  table.push(charLengths)
  table.push(unicodeOffsets)
  table.push(exports.bufferToIntArray(new Buffer(result, 'binary')))

  let begin = Date.now()
  let matched = 0
  for (let charString in stringList) {
    let poses = exports.sortedIntegerArray(stringList[charString])
    let chars = exports.bufferToIntArray(new Buffer(charString, 'binary'))
    let serachedPoses = exports.sortedIntegerArray(fm.search(charString))
    if (poses.toString() !== serachedPoses.toString()) {
      console.log(`${chars.toString()} search not match ${poses.toString()} ${serachedPoses.toString()} matched:${matched}`)
    } else {
      ++matched
    }
  }
  console.log(`The time search is: ${Date.now() - begin}`)
  begin = Date.now()
  for (let pos = 0; pos < singleString.length; ++pos) {
    if (fm.getSubstring(pos, 1).charCodeAt(0) !== singleString.charCodeAt(pos)) {
      console.log(singleString.charCodeAt(pos))
    }
  }
  console.log(`The time getPosition is: ${Date.now() - begin}`)
  return table
}

exports.writeTable = function (name, table) {
  this.writeFile(name, '[\n' + table.map(function (a) { return JSON.stringify(a) }).join(',\n') + '\n]\n')
}

exports.writeFile = function (name, body) {
  let tablesDir = path.join(__dirname, '../encodings/tables')
  fs.mkdirsSync(tablesDir)
  fs.writeFileSync(path.join(tablesDir, name + '.json'), body)
}

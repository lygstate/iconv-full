'use strict'

const { Converter } = require('../encodings/utils')

// Multibyte codec. In this scheme, a character is represented by 1 or more bytes.
// Our codec supports UTF-16 surrogates, extensions for GB18030 and unicode sequences.
// To save memory and loading time, we read table files only when requested.

exports._dbcs = DBCSCodec
const UNASSIGNED = 0xFFFFFFFF
const GB18030_CODE = 1

// Class DBCSCodec reads and initializes mapping tables.
function DBCSCodec (codecOptions, iconv) {
  this.encodingName = codecOptions.encodingName
  if (!codecOptions) {
    throw new Error('DBCS codec is called without the data.')
  }
  if (!codecOptions.table) {
    throw new Error("Encoding '" + this.encodingName + "' has no data.")
  }

  // Load tables.
  let mappingTables = codecOptions.table()
  for (let table of mappingTables) {
    table.unicodeToPointers = new Uint16Array(table.unicodeToPointers)
    table.pointerToUnicodes = new Uint16Array(table.pointerToUnicodes)
    table.pointers = new Converter(table.pointers)
    table.unicodes = new Converter(table.unicodes)
  }
  this.mappingTables = mappingTables
  this.defaultCharUnicode = iconv.defaultCharUnicode
}

DBCSCodec.prototype.encoder = DBCSEncoder
DBCSCodec.prototype.decoder = DBCSDecoder

// == Encoder ==================================================================
function DBCSEncoder (options, codec) {
  // Encoder state
  this.leadSurrogate = -1
  // Static data
  this.mappingTables = codec.mappingTables
  this.gb18030 = codec.gb18030
  this.defaultCharSingleByte = codec.defaultCharSingleByte
}

DBCSEncoder.prototype.write = function (str) {
  const newBuf = new Buffer(str.length * (this.gb18030 ? 4 : 3))
  let leadSurrogate = this.leadSurrogate
  let i = 0
  let j = 0
  let nextChar = -1
  let uCode = 0
  while (true) {
    // 0. Get next character.
    if (nextChar === -1) {
      if (i === str.length) break
      uCode = str.charCodeAt(i++)
    } else {
      uCode = nextChar
      nextChar = -1
    }

    // 1. Handle surrogates.
    if (uCode >= 0xD800 && uCode < 0xE000) { // Char is one of surrogates.
      if (uCode < 0xDC00) { // We've got lead surrogate.
        if (leadSurrogate === -1) {
          leadSurrogate = uCode
          continue
        } else {
          leadSurrogate = uCode
          // Double lead surrogate found.
          uCode = UNASSIGNED
        }
      } else { // We've got trail surrogate.
        if (leadSurrogate !== -1) {
          uCode = 0x10000 + (leadSurrogate - 0xD800) * 0x400 + (uCode - 0xDC00)
          leadSurrogate = -1
        } else {
          // Incomplete surrogate pair - only trail surrogate found.
          uCode = UNASSIGNED
        }
      }
    } else if (leadSurrogate !== -1) {
      // Incomplete surrogate pair - only lead surrogate found.
      nextChar = uCode
      uCode = UNASSIGNED // Write an error, then current char.
      leadSurrogate = -1
    }

    // 2. Convert uCode character.
    let dbcsCode = UNASSIGNED
    if (uCode !== UNASSIGNED) {
      if (uCode < 0x80) {
        dbcsCode = uCode
      } else {
        for (let table of this.mappingTables) {
          let index = table.unicodes.indexOfCodePoint(uCode)
          if (index >= 0) {
            index = table.unicodeToPointers[index]
            dbcsCode = table.pointers.codePointOfIndex(index)
            break
          }
        }
      }
    }

    // 3. Write dbcsCode character.
    if (dbcsCode === UNASSIGNED) {
      dbcsCode = this.defaultCharSingleByte
    }

    if (dbcsCode < 0x100) {
      newBuf[j++] = dbcsCode
    } else if (dbcsCode < 0x10000) {
      newBuf[j++] = dbcsCode >> 8   // high byte
      newBuf[j++] = dbcsCode & 0xFF // low byte
    } else {
      newBuf[j++] = dbcsCode >> 16
      newBuf[j++] = (dbcsCode >> 8) & 0xFF
      newBuf[j++] = dbcsCode & 0xFF
    }
  }
  this.leadSurrogate = leadSurrogate
  return newBuf.slice(0, j)
}

DBCSEncoder.prototype.end = function () {
}

// == Decoder ==================================================================
function DBCSDecoder (options, codec) {
  // Decoder state
  this.prevByte = 0
  this.dbcsCode = 0

  // Static data
  this.mappingTables = codec.mappingTables
  this.defaultCharUnicode = codec.defaultCharUnicode
  this.defaultCharUnicodeCode = codec.defaultCharUnicode.charCodeAt(0)
  this.gb18030 = codec.gb18030
}

DBCSDecoder.prototype.write = function (buf) {
  const newBuf = new Buffer(buf.length * 2)
  let uCode = 0
  let prevByte = this.prevByte
  let dbcsCode = this.dbcsCode

  let j = 0
  for (let i = 0; i < buf.length; i++) {
    const curByte = buf[i]
    let pointer = 0
    if (prevByte === GB18030_CODE) {
      // DO GB18030 decode
      dbcsCode = dbcsCode * 2
    } else if (prevByte === 0) {
      if (curByte < 0x80) {
        // Normal character, just use it.
        uCode = curByte
      } else if (curByte > 0x80) {
        prevByte = curByte
        continue
      } else {
        pointer = curByte
      }
    } else {
      pointer = prevByte << 8 | curByte
    }
    if (pointer > 0) {
      // console.log('pointer', pointer)
      // TODO: Make sure the pointer in DB18030 range
      // then continue
      if (this.gb18030 && pointer >= 0 && pointer <= 0xFF) {
        dbcsCode = prevByte
        // Do GB18030
      }
      uCode = 0
      for (let table of this.mappingTables) {
        let index = table.pointers.indexOfCodePoint(pointer)
        if (index >= 0) {
          index = table.pointerToUnicodes[index]
          uCode = table.unicodes.codePointOfIndex(index)
          break
        }
      }
      if (uCode === 0) {
        prevByte = curByte
        uCode = this.defaultCharUnicodeCode
      } else {
        prevByte = 0
      }
    }
    // Write the character to buffer, handling higher planes using surrogate pair.
    if (uCode > 0xFFFF) {
      uCode -= 0x10000
      const uCodeLead = 0xD800 + Math.floor(uCode / 0x400)
      newBuf[j++] = uCodeLead & 0xFF
      newBuf[j++] = uCodeLead >> 8

      uCode = 0xDC00 + uCode % 0x400
    }
    newBuf[j++] = uCode & 0xFF
    newBuf[j++] = uCode >> 8
  }

  this.prevByte = prevByte
  return newBuf.slice(0, j).toString('ucs2')
}

DBCSDecoder.prototype.end = function () {
  var ret = ''

  // Try to parse all remaining chars.
  if (this.prevByte !== 0) {
    // TODO: testing GB18030
    // Skip 1 character in the buffer.
    ret += this.defaultCharUnicode
    this.prevByte = 0
  }

  return ret
}

// Binary search for GB18030. Returns largest i such that table[i] <= val.
exports.findIdx = (table, val) => {
  if (table[0] > val) {
    return -1
  }

  let l = 0
  let r = table.length
  while (l < r - 1) { // always table[l] <= val < table[r]
    var mid = l + Math.floor((r - l + 1) / 2)
    if (table[mid] <= val) {
      l = mid
    } else {
      r = mid
    }
  }
  return l
}

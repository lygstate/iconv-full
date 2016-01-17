// import { FMIndex } from 'fm-index'

const utils = require('./utils')
const errTo = require('errto')
const async = require('async')

function initDBCS (from) {
  let to = {}
  for (let i = 0; i <= 0x80; ++i) {
    if (from[i] === undefined) {
      continue
    }
    to[i] = from[i]
  }
  return to
}

async.parallel({
  $big5: utils.getFile.bind(null, 'http://encoding.spec.whatwg.org/index-big5.txt'), // Encodings with $ are not saved. They are used to calculate other encs.
  $gbk: utils.getFile.bind(null, 'http://encoding.spec.whatwg.org/index-gb18030.txt'),
  $gbRanges: utils.getFile.bind(null, 'http://encoding.spec.whatwg.org/index-gb18030-ranges.txt'),
  $eucKr: utils.getFile.bind(null, 'http://encoding.spec.whatwg.org/index-euc-kr.txt'),
  $jis0208: utils.getFile.bind(null, 'http://encoding.spec.whatwg.org/index-jis0208.txt'),
  $jis0212: utils.getFile.bind(null, 'http://encoding.spec.whatwg.org/index-jis0212.txt'),
  $cp932: utils.getFile.bind(null, 'http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP932.TXT'),
  cp936: utils.getFile.bind(null, 'http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP936.TXT'),
  cp949: utils.getFile.bind(null, 'http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP949.TXT'),
  cp950: utils.getFile.bind(null, 'http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT')
}, errTo(console.log, function (data) {
  // First, parse all files.
  for (let enc in data) {
    let dbcs = {}
    let parseIntBase = enc.startsWith('$') ? 10 : 16
    utils.parseText(data[enc]).map(function (a) {
      let dbcsCode = parseInt(a[0], parseIntBase)
      let unicode = parseInt(a[1], 16)
      if (!isNaN(unicode)) {
        dbcs[dbcsCode] = unicode
      }
    })
    data[enc] = dbcs
  }

  // Add char sequences that are not in the index file (as given in http://encoding.spec.whatwg.org/#big5-encoder)
  function toIdx (pointer) {
    let trail = pointer % 157
    let lead = Math.floor(pointer / 157) + 0x81
    return (lead << 8) + (trail + (trail < 0x3F ? 0x40 : 0x62))
  }

  // Calculate difference between big5 and cp950, and write it to a file.
  // See http://encoding.spec.whatwg.org/#big5-encoder
  let big5 = initDBCS(data.cp950)
  for (let i of utils.sortedIntegerArray(Object.keys(data.$big5))) { // Lead byte is 0x81 .. 0xFE
    let idx = toIdx(i)
    let big5Char = data.$big5[i]
    big5[idx] = big5Char
    let cpChar = data.cp950[idx]
    if (cpChar !== undefined && cpChar !== big5Char) {
      console.log('Dont match: ', i.toString(16), idx.toString(16), big5Char, cpChar)
    }
  }

  big5[toIdx(1133)] = [0x00CA, 0x0304]
  big5[toIdx(1135)] = [0x00CA, 0x030C]
  big5[toIdx(1164)] = [0x00EA, 0x0304]
  big5[toIdx(1166)] = [0x00EA, 0x030C]

  utils.writeTable('cp950', utils.generateTable(data.cp950))
  utils.writeTable('big5', utils.generateTable(big5))

  // Calculate difference between GB18030 encoding and cp936.
  // See http://encoding.spec.whatwg.org/#gb18030-encoder
  let gbk = initDBCS(data.cp936)
  for (let i = 0x8100; i < 0x10000; i++) { // Lead byte is 0x81 .. 0xFE
    let trail = i & 0xFF
    if (trail < 0x40 || trail === 0x7F || trail > 0xFE) continue
    let lead = i >> 8
    let offset = (trail < 0x7F) ? 0x40 : 0x41
    let gbAddr = (lead - 0x81) * 190 + (trail - offset)
    let cpChar = data.cp936[i]
    let gbChar = data.$gbk[gbAddr]
    if (gbChar === undefined) {
      if (cpChar !== undefined) {
        console.log('Dont match: ', i.toString(16), gbAddr.toString(16), gbChar, cpChar)
      }
      continue
    }
    if ((cpChar !== undefined) && (cpChar !== gbChar)) {
      console.log('Dont match: ', i.toString(16), gbAddr.toString(16), gbChar, cpChar)
    }
    gbk[i] = gbChar
  }

  utils.writeTable('cp936', utils.generateTable(data.cp936))
  utils.writeTable('gbk', utils.generateTable(gbk))

  // Write GB18030 ranges
  let ranges = { uChars: [], gbChars: [] }
  for (let k in data.$gbRanges) {
    ranges.uChars.push(data.$gbRanges[k])
    ranges.gbChars.push(+k)
  }
  utils.writeFile('gb18030-ranges', JSON.stringify(ranges))

  // Use http://encoding.spec.whatwg.org/#shift_jis-decoder
  let shiftjis = {}
  for (let i = 0; i <= 0x80; i++) {
    shiftjis[i] = i
  }
  for (let i = 0xA1; i <= 0xDF; i++) {
    shiftjis[i] = 0xFF61 + i - 0xA1
  }

  for (let lead = 0x81; lead < 0xFF; lead++) {
    if (lead < 0xA1 || lead > 0xDF) {
      for (let byte = 0; byte < 0xFF; byte++) {
        let offset = (byte < 0x7F) ? 0x40 : 0x41
        let leadOffset = (lead < 0xA0) ? 0x81 : 0xC1
        if ((byte >= 0x40 && byte <= 0x7E) || (byte >= 0x80 && byte <= 0xFC)) {
          let pointer = (lead - leadOffset) * 188 + byte - offset
          if (data.$jis0208[pointer]) {
            shiftjis[(lead << 8) + byte] = data.$jis0208[pointer]
          } else if (pointer >= 8836 && pointer <= 10528) {
            shiftjis[(lead << 8) + byte] = 0xE000 + pointer - 8836 // Interoperable legacy from Windows known as EUDC
          }
        }
      }
    }
  }

  utils.writeTable('shiftjis', utils.generateTable(shiftjis))

  // Fill out EUC-JP table according to http://encoding.spec.whatwg.org/#euc-jp
  let eucJp = {}
  for (let i = 0; i < 0x80; i++) {
    eucJp[i] = i
  }
  for (let i = 0xA1; i <= 0xDF; i++) {
    eucJp[(0x8E << 8) + i] = 0xFF61 + i - 0xA1
  }
  for (let i = 0xA1; i <= 0xFE; i++) {
    for (let j = 0xA1; j <= 0xFE; j++) {
      let idx = (i - 0xA1) * 94 + (j - 0xA1)
      const jis0208Char = data.$jis0208[idx]
      const jis0212Char = data.$jis0212[idx]
      // NOTE: We need to make sure the idx are exists
      if (jis0208Char) eucJp[(i << 8) + j] = jis0208Char
      if (jis0212Char) eucJp[(0x8F << 16) + (i << 8) + j] = jis0212Char
    }
  }

  utils.writeTable('eucjp', utils.generateTable(eucJp))

  // Fill out EUC-KR Table and check that it is the same as cp949.
  let eucKr = {}
  for (let i = 0; i < 0x80; i++) {
    eucKr[i] = i
  }
  for (let i = 0x8100; i < 0xFF00; i++) {
    let lead = i >> 8
    let byte = i & 0xFF
    let pointer = null
    if (byte >= 0x41 && byte <= 0xFE) {
      pointer = (lead - 0x81) * 190 + (byte - 0x41)
    }
    if (pointer !== null) {
      eucKr[i] = data.$eucKr[pointer]
    }

    // Compare with cp949
    if (data.cp949[i] !== eucKr[i]) {
      console.log(byte, pointer)
      console.log("Warning: EUC-KR from Encoding Standard doesn't match with CP949 from Unicode.com: ", i, data.cp949[i], eucKr[i])
    }
  }

  // Write all plain tables as-is.
  for (let enc of ['cp949']) {
    utils.writeTable(enc, utils.generateTable(data[enc]))
  }

  console.log('DBCS encodings regenerated.')
}))

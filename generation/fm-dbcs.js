'use strict'

const utils = require('./utils')
const errTo = require('errto')
const async = require('async')

function initDBCS (last) {
  last = last || 0x7f
  let to = []
  for (let i = 0; i <= last; ++i) {
    to.push([i, i])
  }
  return to
}

// Add char sequences that are not in the index file (as given in http://encoding.spec.whatwg.org/#big5-encoder)
function toIdxBig5 (pointer) {
  let lead = Math.floor(pointer / 157) + 0x81  // Lead byte is 0x81 .. 0xFE
  let trail = pointer % 157
  let offset = trail < 0x3F ? 0x40 : 0x62
  return (lead << 8) | (trail + offset)
}

function toIdxGBK (pointer) {
  let lead = Math.floor(pointer / 190) + 0x81
  let trail = pointer % 190
  let offset = trail < 0x3F ? 0x40 : 0x41
  return (lead << 8) | (trail + offset)
}

function toIdxKR (pointer) {
  let lead = Math.floor(pointer / 190) + 0x81
  let trail = pointer % 190
  let offset = 0x41
  return (lead << 8) | (trail + offset)
}

exports.convertWhatWgTable = (table, target, toIdx) => {
  for (let [pointer, unicode] of table) {
    let idx = toIdx(pointer)
    target.push([idx, unicode])
  }
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
    let isJIS = enc.startsWith('$jis')
    let dbcs = []
    if (isJIS) {
      dbcs = {}
    }
    let parseIntBase = enc.startsWith('$') ? 10 : 16
    utils.parseText(data[enc]).map(function (a) {
      let dbcsCode = parseInt(a[0], parseIntBase)
      let unicode = parseInt(a[1], 16)
      if (!isNaN(unicode)) {
        if (isJIS) {
          dbcs[dbcsCode] = unicode
        } else {
          dbcs.push([dbcsCode, unicode])
        }
      }
    })
    data[enc] = dbcs
  }

  // Calculate difference between big5 and cp950, and write it to a file.
  // See http://encoding.spec.whatwg.org/#big5-encoder
  let big5 = initDBCS()
  exports.convertWhatWgTable(data.$big5, big5, toIdxBig5)
  big5.push([toIdxBig5(1133), 0x00CA << 16 | 0x0304])
  big5.push([toIdxBig5(1135), 0x00CA << 16 | 0x030C])
  big5.push([toIdxBig5(1164), 0x00EA << 16 | 0x0304])
  big5.push([toIdxBig5(1166), 0x00EA << 16 | 0x030C])
  //  TODO: Check the cp950 big5 difference

  utils.writeTable('big5', utils.generateTable(big5))
  // utils.writeTable('cp950', utils.generateTable(data.cp950))

  // Calculate difference between GB18030 encoding and cp936.
  // See http://encoding.spec.whatwg.org/#gb18030-encoder
  let gbk = initDBCS()
  gbk.push([0x80, '€'.charCodeAt(0)]) // 0x80 is the Euro dollor symbol
  exports.convertWhatWgTable(data.$gbk, gbk, toIdxGBK)
  // TODO: Compare GBK & cp936
  // utils.writeTable('cp936', utils.generateTable(data.cp936))
  utils.writeTable('gbk', utils.generateTable(gbk))

  // Write GB18030 ranges
  let ranges = { uChars: [], gbChars: [] }
  for (let k in data.$gbRanges) {
    ranges.uChars.push(data.$gbRanges[k])
    ranges.gbChars.push(+k)
  }
  utils.writeFile('gb18030-ranges', JSON.stringify(ranges))

  // Use http://encoding.spec.whatwg.org/#shift_jis-decoder
  let shiftjis = initDBCS(0x80)
  for (let i = 0xA1; i <= 0xDF; i++) {
    shiftjis.push([i, 0xFF61 + i - 0xA1])
  }

  for (let lead = 0x81; lead < 0xFF; lead++) {
    if (lead < 0xA1 || lead > 0xDF) {
      for (let byte = 0; byte < 0xFF; byte++) {
        let offset = (byte < 0x7F) ? 0x40 : 0x41
        let leadOffset = (lead < 0xA0) ? 0x81 : 0xC1
        if ((byte >= 0x40 && byte <= 0x7E) || (byte >= 0x80 && byte <= 0xFC)) {
          let pointer = (lead - leadOffset) * 188 + byte - offset
          if (data.$jis0208[pointer]) {
            shiftjis.push([(lead << 8) + byte, data.$jis0208[pointer]])
          } else if (pointer >= 8836 && pointer <= 10528) {
            shiftjis.push([(lead << 8) + byte, 0xE000 + pointer - 8836]) // Interoperable legacy from Windows known as EUDC
          }
        }
      }
    }
  }

  utils.writeTable('shiftjis', utils.generateTable(shiftjis))

  // Fill out EUC-JP table according to http://encoding.spec.whatwg.org/#euc-jp
  let eucJp = initDBCS()
  for (let i = 0xA1; i <= 0xDF; i++) {
    eucJp.push([(0x8E << 8) + i, 0xFF61 + i - 0xA1])
  }
  for (let i = 0xA1; i <= 0xFE; i++) {
    for (let j = 0xA1; j <= 0xFE; j++) {
      let idx = (i - 0xA1) * 94 + (j - 0xA1)
      const jis0208Char = data.$jis0208[idx]
      const jis0212Char = data.$jis0212[idx]
      // NOTE: We need to make sure the idx are exists
      if (jis0208Char && jis0212Char) {
        // console.log('Exist in both index')
      }
      if (jis0208Char) eucJp.push([(i << 8) + j, jis0208Char])
      if (jis0212Char) eucJp.push([(0x8F << 16) + (i << 8) + j, jis0212Char])
    }
  }

  utils.writeTable('eucjp', utils.generateTable(eucJp))

  // Fill out EUC-KR Table and check that it is the same as cp949.
  let eucKr = initDBCS()
  exports.convertWhatWgTable(data.$eucKr, eucKr, toIdxKR)
  // TODO: Compare CP949 eucKr

  utils.writeTable('euc-kr', utils.generateTable(eucKr))
  console.log('DBCS encodings regenerated.')
}))

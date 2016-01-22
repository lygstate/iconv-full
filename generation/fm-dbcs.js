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
    let dbcs = []
    let parseIntBase = enc.startsWith('$') ? 10 : 16
    utils.parseText(data[enc]).map(function (a) {
      let dbcsCode = parseInt(a[0], parseIntBase)
      let unicode = parseInt(a[1], 16)
      if (!isNaN(unicode)) {
        dbcs.push([dbcsCode, unicode])
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

  utils.generateTable('big5', big5)
  // utils.writeTable('cp950', utils.generateTable(data.cp950))

  // Calculate difference between GB18030 encoding and cp936.
  // See http://encoding.spec.whatwg.org/#gb18030-encoder
  let gbk = initDBCS()
  gbk.push([0x80, '€'.charCodeAt(0)]) // 0x80 is the Euro dollor symbol
  exports.convertWhatWgTable(data.$gbk, gbk, toIdxGBK)
  // TODO: Compare GBK & cp936
  // utils.writeTable('cp936', utils.generateTable(data.cp936))
  utils.generateTable('gbk', gbk)

  // Write GB18030 ranges
  let ranges = { uChars: [], gbChars: [] }
  for (let k in data.$gbRanges) {
    ranges.uChars.push(data.$gbRanges[k])
    ranges.gbChars.push(+k)
  }
  utils.writeFile('gb18030-ranges', JSON.stringify(ranges))

  utils.generateTable('jis0208', data.$jis0208)
  utils.generateTable('jis0212', data.$jis0212)

  // Fill out EUC-KR Table and check that it is the same as cp949.
  let eucKr = initDBCS()
  exports.convertWhatWgTable(data.$eucKr, eucKr, toIdxKR)
  // TODO: Compare CP949 eucKr

  utils.generateTable('euc-kr', eucKr)
  console.log('DBCS encodings regenerated.')
}))

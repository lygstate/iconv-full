'use strict'
const UNICODE_MAX_CODEPOINT = exports.UNICODE_MAX_CODEPOINT = 0x10FFFF

exports.convertCompressedArray = (compressed) => {
  compressed.offsets = new Uint16Array(compressed.offsets)
  compressed.planes = new Uint16Array(compressed.planes)
  compressed.extraPlane = new Uint32Array(compressed.extraPlane)
  compressed.planeOffsets = new Uint16Array(compressed.planeOffsets)
}
// Search between [start, end)
// The array[result] <= element < array[result + 1]
exports.BinarySearch = (array, left, right, element) => {
  left = left - 1
  while (left + 1 < right) {
    let mid = (left + right) >> 1
    if (array[mid] <= element) {
      left = mid
    } else {
      right = mid
    }
  }
  return left
}

exports.indexOfCodePointInPlane = (plane, left, right, codepoint, offsets) => {
  let offsetPos = exports.BinarySearch(plane, left, right, codepoint)
  // console.log(plane, left, right, pos, codepoint)
  if (offsetPos < left) {
    return -1
  }
  let offset = codepoint - plane[offsetPos]
  let baseOffset = offsets[offsetPos]
  let maxOffset = offsets[offsetPos + 1]
  let finalOffset = baseOffset + offset
  if (finalOffset >= maxOffset) {
    return -1
  }
  return finalOffset
}

exports.indexOfCodePoint = (compressed, codepoint) => {
  if (codepoint < UNICODE_MAX_CODEPOINT) {
    let planeNumber = codepoint >> 16
    // console.log(compressed.planeOffsets)
    let left = compressed.planeOffsets[planeNumber]
    let right = compressed.planeOffsets[planeNumber + 1]
    return exports.indexOfCodePointInPlane(
      compressed.planes,
      left, right,
      codepoint & 0xFFFF, compressed.offsets)
  }

  let finalPos = exports.indexOfCodePointInPlane(
    compressed.extraPlane,
    0, compressed.extraPlane.length,
    codepoint, compressed.extraOffsets)
  if (finalPos === -1) {
    return -1
  }
  return compressed.extraStart + finalPos
}

exports.codePointOfIndex = (compressed, index) => {
}

'use strict'
const UNICODE_MAX_CODEPOINT = exports.UNICODE_MAX_CODEPOINT = 0x10FFFF

exports.convertCompressedArray = (compressed) => {
  compressed.offsets = new Uint16Array(compressed.offsets)
  compressed.planes = new Uint16Array(compressed.planes)
  compressed.extraPlane = new Uint32Array(compressed.extraPlane)
  compressed.extraOffsets = new Uint16Array(compressed.extraOffsets)
  compressed.planeOffsets = new Uint16Array(compressed.planeOffsets)
}

// Search between [start, end)
// The array[result] <= element < array[result + 1]
const BinarySearch = exports.BinarySearch = (array, left, right, element) => {
  if (left === right) {
    return -1
  }
  // console.log('BinarySearch', array, left, right, element)
  while (left < right) {
    let mid = (left + right) >> 1
    if (array[mid] <= element) {
      left = mid + 1
    } else {
      right = mid
    }
  }
  // console.log(array, left, right)
  if (array[left - 1] <= element) {
    return left - 1
  } else {
    return -1
  }
}

exports.indexOfCodePoint = (compressed, codepoint) => {
  let left = 0
  let right = compressed.extraPlane.length
  let plane = compressed.extraPlane
  let extraOffset = compressed.extraStart
  let offsets = compressed.extraOffsets

  if (codepoint < UNICODE_MAX_CODEPOINT) {
    let planeNumber = codepoint >> 16
    // console.log(compressed.planeOffsets)
    left = compressed.planeOffsets[planeNumber]
    right = compressed.planeOffsets[planeNumber + 1]
    plane = compressed.planes
    offsets = compressed.offsets
    codepoint = codepoint & 0xFFFF
    extraOffset = 0
  }

  let offsetPos = BinarySearch(plane, left, right, codepoint)
  // console.log(plane, left, right, offsetPos, codepoint)
  if (offsetPos < 0) {
    return -1
  }
  let offset = codepoint - plane[offsetPos]
  let baseOffset = offsets[offsetPos]
  let maxOffset = offsets[offsetPos + 1]
  let finalOffset = baseOffset + offset
  if (finalOffset >= maxOffset) {
    return -1
  }
  return finalOffset + extraOffset
}

exports.codePointOfIndex = (compressed, index) => {
  if (index < 0 || index >= compressed.length) {
    return -1
  }
  let offsets = compressed.offsets
  let planes = compressed.planes
  if (index >= compressed.extraStart) {
    index -= compressed.extraStart
    offsets = compressed.extraOffsets
    planes = compressed.extraPlane
  }
  let pos = BinarySearch(offsets, 0, offsets.length, index)
  let diff = index - offsets[pos]
  return planes[pos] + diff
}

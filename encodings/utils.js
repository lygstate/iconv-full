'use strict'
const UNICODE_MAX_CODEPOINT = exports.UNICODE_MAX_CODEPOINT = 0x10FFFF

exports.Converter = function (compressed) {
  this.offsets = new Uint16Array(compressed.offsets)
  this.planes = new Uint16Array(compressed.planes)
  this.extraPlane = new Uint32Array(compressed.extraPlane)
  this.extraOffsets = new Uint16Array(compressed.extraOffsets)
  this.planeOffsets = new Uint16Array(compressed.planeOffsets)
  this.extraStart = compressed.extraStart | 0
  this.length = compressed.length | 0
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

exports.Converter.prototype = {
  indexOfCodePoint: function (codepoint) {
    let left = 0
    let right = this.extraPlane.length
    let plane = this.extraPlane
    let extraOffset = this.extraStart
    let offsets = this.extraOffsets

    if (codepoint < UNICODE_MAX_CODEPOINT) {
      let planeNumber = codepoint >> 16
      // console.log(this.planeOffsets)
      left = this.planeOffsets[planeNumber]
      right = this.planeOffsets[planeNumber + 1]
      plane = this.planes
      offsets = this.offsets
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
  },
  codePointOfIndex: function (index) {
    if (index < 0 || index >= this.length) {
      return -1
    }
    let offsets = this.offsets
    let planes = this.planes
    if (index >= this.extraStart) {
      index -= this.extraStart
      offsets = this.extraOffsets
      planes = this.extraPlane
    }
    let pos = BinarySearch(offsets, 0, offsets.length, index)
    let diff = index - offsets[pos]
    return planes[pos] + diff
  }
}

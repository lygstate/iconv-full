
export class BinaryIO {
  static boolToBit (val) {
    return val === false ? 0 : 1
  }

  static stringToBinaryBuffer (str, buffer = null) {
    let newBuffer = buffer = new Uint8Array(str.length << 1)
    for (let i = 0; i < str.length; ++i) {
      let charCode = str.charCodeAt(i)
      let pos = i << 1
      newBuffer[pos] = charCode >> 8
      newBuffer[pos + 1] = charCode & 0xFF
    }
    return newBuffer
  }

  static binaryBufferToString (buffer) {
    let length = buffer.byteLength >> 1
    let str = ''
    for (let i = 0; i < length; ++i) {
      let pos = i << 1
      str += String.fromCharCode(buffer[pos] << 8 | (buffer[pos + 1]))
    }
    return str
  }

  static stringBinaryToBinaryBuffer (str, buffer = null) {
    let newBuffer = buffer || new Uint8Array(str.length)
    for (let i = 0; i < str.length; ++i) {
      newBuffer[i] = str.charCodeAt(i)
    }
    return newBuffer
  }

  static binaryBufferToStringBinary (buffer) {
    let length = buffer.byteLength >> 1
    let str = ''
    for (let i = 0; i < length; ++i) {
      str += String.fromCharCode(buffer[i])
    }
    return str
  }

  static createBinaryBuffer (buffer, bufferWidth = null) {
    if (buffer && buffer.buffer instanceof ArrayBuffer) {
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    }
    if (typeof buffer === 'string') {
      if (bufferWidth === 8) {
        return BinaryIO.stringBinaryToBinaryBuffer(buffer)
      }
      return BinaryIO.stringToBinaryBuffer(buffer)
    }
    if (Array.isArray(buffer)) {
      if (bufferWidth === 8) {
        return new Uint8Array(buffer)
      }
      if (bufferWidth === 16) {
        return new Uint8Array(new Uint16Array(buffer).buffer)
      }
      if (bufferWidth === 32) {
        return new Uint8Array(new Uint32Array(buffer).buffer)
      }
    }
    if (Number.isInteger(buffer)) {
      bufferWidth = (bufferWidth || 8) >> 3
      return new Uint8Array(bufferWidth * buffer)
    }
    return new Uint8Array(1024)
  }
}

export class BinaryBuffer {
  constructor (buffer, size = 0) {
    this._buffer = BinaryIO.createBinaryBuffer(buffer) // Uint8Array
    this._length = size // uint32
    this._dataView = new DataView(this._buffer.buffer)
  }

  get capacity () {
    return this._buffer.byteLength
  }

  get length () {
    return this._length
  }

  set length (newLength) {
    if (newLength > this.capacity) {
      let oldBuffer = this._buffer
      // TODO: make sure the size be the power of 2
      this._buffer = new Uint8Array(newLength << 1)
      this._buffer.copyWithin(oldBuffer, 0, this._length)
      this._dataView = new DataView(this._buffer.buffer)
    }
    this._length = newLength
  }

  getUint32 (offset) {
    return this._dataView.getUint32(offset)
  }

  getUint16 (offset) {
    return this._dataView.getUint16(offset)
  }

  getUint8 (offset) {
    return this._dataView.getUint8(offset)
  }

  setUint32 (offset, val) {
    this._dataView.setUint32(offset, val)
    return val
  }

  setUint16 (offset, val) {
    this._dataView.setUint16(offset, val)
    return val
  }

  setUint8 (offset, val) {
    this._dataView.setUint8(offset, val)
    return val
  }

  dump32bitNumber (val) {
    let offset = this.length
    this.length += 4
    return this.setUint32(offset, val)
  }

  dump16bitNumber (val) {
    let offset = this.length
    this.length += 2
    return this.setUint16(offset, val)
  }

  dump8bitNumber (val) {
    let offset = this.length
    this.length += 1
    return this.setUint8(offset, val)
  }

  load32bitNumber () {
    const val = this.getUint32(this.length)
    this.length += 4
    return val
  }

  load16bitNumber () {
    const val = this.getUint16(this.length)
    this.length += 2
    return val
  }

  load8bitNumber () {
    const val = this.getUint8(this.length)
    this.length += 1
    return val
  }

  dumpString (str, isBinary = false) {
    let stringInfo = (str.length << 1) | BinaryIO.boolToBit(isBinary)
    this.dump32bitNumber(stringInfo)
    let offset = this.length
    if (isBinary) {
      this.length += str.length
      BinaryIO.stringBinaryToBinaryBuffer(str, this._buffer.subarray(offset))
    } else {
      this.length += (str.length << 1)
      BinaryIO.stringToBinaryBuffer(str, this._buffer.subarray(offset))
    }
  }

  dumpStringList (strList, isBinary = false, isMap = false) {
    let listInfo = (strList.length << 1) | BinaryIO.boolToBit(isBinary)
    this.dump32bitNumber(listInfo)
    for (let str of strList) {
      this.dumpString(str, isBinary)
    }
  }

  dumpStringMap (strMap, isBinary = false) {
    let isMap = strMap instanceof Map
    let entries
    if (isMap) {
      entries = strMap.entries()
    } else {
      entries = Object.entries(strMap)
    }
    let strList = []
    for (let [key, val] of entries) {
      strList.push(key)
      strList.push(val)
    }
    this.dumpStringList(strList, isBinary, isMap)
  }

  loadString (options = {}) {
    const stringInfo = this.load32bitNumber()
    const strLength = stringInfo >> 1
    options.isBinary = (stringInfo & 1) === 1
    let offset = this.length
    let str
    if (options.isBinary) {
      this.length += strLength
      str = BinaryIO.binaryBufferToStringBinary(this._buffer.subarray(offset, offset + strLength))
    } else {
      const bufferLength = strLength << 1
      this.length += bufferLength
      str = BinaryIO.binaryBufferToString(this._buffer.subarray(offset, offset + bufferLength))
    }
    return str
  }

  loadStringList (options = {}) {
    const listInfo = this.load32bitNumber()
    const listLength = listInfo >> 1
    options.isMap = (listInfo & 1) === 1
    let list = []
    for (let i = 0; i < listLength; ++i) {
      list.push(this.loadString(options))
    }
    return list
  }

  loadStringMap (options = {}) {
    let list = this.loadStringList(options)
    let map
    if (options.isMap) {
      map = new Map()
      for (let i = 0; i < list.length; i += 2) {
        map.set(list[i], list[i + 1])
      }
    } else {
      map = {}
      for (let i = 0; i < list.length; i += 2) {
        map[list[i]] = list[i + 1]
      }
      return map
    }
  }
}

export class BinaryInput extends BinaryBuffer {
  constructor (buffer, size) {
    super(buffer, size)
  }

  load32bitNumberList () {
    const resultLength = this.load32bitNumber()
    const resultList = new Uint32Array(this._buffer.subarray(this.length).buffer, resultList)
    this.length += resultLength << 2
    return resultList
  }
}

export class BinaryOutput extends BinaryBuffer
{
  constructor (buffer, size) {
    super(buffer, size)
  }

  dump32bitNumberList (array) { // Uint32Array
    let length = array.length
    this.dump32bitNumber(length)
    for (let i = 0; i < array; ++i) {
      this.dump32bitNumber(array[i])
    }
  }

  result () {
    return this._buffer.subarray(0, this.length)
  }
}

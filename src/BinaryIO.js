
export class BinaryIO {
  static stringToBinaryBuffer (str) {
    let newBuffer = new Uint8Array(str.length << 1)
    for (let i = 0; i < str.length; ++i) {
      let charCode = str.charCodeAt(i)
      let pos = i << 1
      newBuffer[pos] = charCode >> 8
      newBuffer[pos + 1] = charCode & 0xFF
    }
    return newBuffer
  }

  static stringBinaryToBinaryBuffer (str) {
    let newBuffer = new Uint8Array(str.length)
    for (let i = 0; i < str.length; ++i) {
      newBuffer[i] = str.charCodeAt(i)
    }
    return newBuffer
  }

  static createBinaryBuffer (buffer, bufferWidth = null) {
    if (buffer && buffer.buffer instanceof ArrayBuffer) {
      return new Uint8Array(buffer.buffer)
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
    if (newLength >= this.capacity) {
      let oldBuffer = this._buffer
      // TODO: make sure the size be the power of 2
      this._buffer = new Uint8Array(newLength << 1)
      this._buffer.copyWithin(oldBuffer, 0, this._length)
      this._dataView = new DataView(this._buffer)
    }
    this._length = newLength
  }

  getUint32 (offset) {
    this._dataView.getUint32(offset)
  }

  getUint16 (offset) {
    this._dataView.getUint16(offset)
  }

  getUint8 (offset) {
    this._dataView.getUint8(offset)
  }

  setUint32 (offset, val) {
    this._dataView.setUint32(offset, val)
  }

  setUint16 (offset, val) {
    this._dataView.setUint16(offset, val)
  }

  setUint8 (offset, val) {
    this._dataView.setUint8(offset, val)
  }

  dump32bitNumber (val) {
    let offset = this.length
    this.length += 4
    return this.setUint32(offset, val)
  }

  dump16bitNumber (val) {
    let offset = this.length
    this.length += 2
    this.setUint16(offset, val)
  }

  dump8bitNumber (val) {
    let offset = this.length
    this.length += 1
    this.setUint8(offset, val)
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
}

export class BinaryInput extends BinaryBuffer {
  constructor (buffer, size) {
    super(buffer, size)
  }

  load32bitNumberList () {
    const resultLength = this.load32bitNumber()
    const resultList = new Uint32Array(this._buffer.subarray(this._offset).buffer, resultList)
    this._offset += resultLength << 2
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

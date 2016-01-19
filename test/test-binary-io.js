'use strict'

const assert = require('assert')

import { BinaryIO, BinaryInput, BinaryOutput } from '../src/BinaryIO'

describe('testing BinaryIO', function () {
  it('test constructor', function () {
    let buffer = BinaryIO.stringToBinaryBuffer('\u0000\u0001')
    assert.equal(buffer.length, 4)
    expect(buffer.toString()).to.equal('0,0,0,1')
    let binaryInput = new BinaryInput()
    assert.equal(binaryInput.length, 0)
    assert.equal(binaryInput.capacity, 1024)
  })

  it('test_16bit_number', function () {
    let input
    let output

    output = new BinaryOutput()
    output.dump16bitNumber(0)
    expect(output.length).to.equal(2)
    expect(output.result().length).to.equal(2)
    input = new BinaryInput(output.result())
    expect(input.capacity).to.equal(2)
    expect(input.length).to.equal(0)
    expect(input._buffer.buffer instanceof ArrayBuffer).to.equal(true)
    expect(input.load16bitNumber()).to.equal(0)

    output = new BinaryOutput()
    output.dump16bitNumber(65535)
    input = new BinaryInput(output.result())
    expect(input.load16bitNumber()).to.equal(65535)

    output = new BinaryOutput()
    output.dump16bitNumber(65536)
    input = new BinaryInput(output.result())
    expect(input.load16bitNumber()).not.to.equal(65536)

    output = new BinaryOutput()
    output.dump8bitNumber(0x80)
    input = new BinaryInput(output.result())
    expect(input.load8bitNumber()).to.equal(0x80)
  })

  it('test_32bit_number', function () {
    let output1 = new BinaryOutput()
    output1.dump32bitNumber(0)
    let input1 = new BinaryInput(output1.result())
    expect(input1.load32bitNumber()).to.equal(0)

    let output2 = new BinaryOutput()
    output2.dump32bitNumber(4294967295)
    let input2 = new BinaryInput(output2.result())
    expect(input2.load32bitNumber()).to.equal(4294967295)

    let output3 = new BinaryOutput()
    output3.dump32bitNumber(4294967296)
    let input3 = new BinaryInput(output3.result())
    expect(input3.load32bitNumber()).not.to.equal(4294967296)
  })

  it('test_string', function () {
    let output
    let input
    output = new BinaryOutput()
    output.dumpString('hello world')
    input = new BinaryInput(output.result())
    expect(input.loadString()).to.equal('hello world')

    // uint32 bytes + string length * 2
    expect(output.result().length).to.equal(('hello world'.length << 1) + 4)

    output = new BinaryOutput()
    output.dumpString('')
    expect(output.result().length).to.equal(4)

    output = new BinaryOutput()
    output.dumpString('\u1111\u1111')
    expect(output.result().length).to.equal(('\u1111\u1111'.length << 1) + 4)

    output = new BinaryOutput()
    output.dumpString('\u1111\u1111')
    expect(output.result().length).to.equal(('\u1111\u1111'.length << 1) + 4)

    output = new BinaryOutput()
    output.dumpString('hello world', true)
    expect(output.result().length).to.equal('hello world'.length + 4)
  })

  it('test_string_list', function () {
    let output1 = new BinaryOutput()
    output1.dumpStringList(['hello', 'world'])
    let input1 = new BinaryInput(output1.result())
    let result1 = input1.loadStringList()
    expect(result1[0]).to.equal('hello')
    expect(result1[1]).to.equal('world')

    let output2 = new BinaryOutput()
    output2.dumpStringList(['\u1112', '\u1112'])
    let input2 = new BinaryInput(output2.result())
    let result2 = input2.loadStringList()
    expect(result2[0]).to.equal('\u1112')
    expect(result2[1]).to.equal('\u1112')

    let output3 = new BinaryOutput()
    output3.dumpStringList(['', ''])
    let input3 = new BinaryInput(output3.result())
    let result3 = input3.loadStringList()
    expect(result3[0]).to.equal('')
    expect(result3[1]).to.equal('')
  })

  it('test_string_list_map', function () {
    let src = {'hello': ['HELLO'], 'world': ['WORLD']}

    let output = new BinaryOutput()
    output.dumpStringListMap(src)
    let input = new BinaryInput(output.result())
    let result = input.loadStringListMap()
    expect(result['hello'][0]).to.equal('HELLO')
    expect(result['world'][0]).to.equal('WORLD')
  })

  it('test_32bit_number_list_blank', function () {
    let list = [0, 0, 0, 0, 0, 0]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 + 1)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(6)
    expect(result[0]).to.equal(0)
    expect(result[5]).to.equal(0)
    expect(input._offset).to.equal(2 + 1)
  })

  it('test_32bit_number_list_non_blank', function () {
    let list = [1, 1, 1, 1, 1, 1]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 * 6 + 2 + 1)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(6)
    expect(result[0]).to.equal(1)
    expect(result[5]).to.equal(1)
    expect(input._offset).to.equal(2 * 6 + 2 + 1)
  })

  it('test_32bit_number_list_zebra', function () {
    let list = [1, 0, 1, 0, 1, 0]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 * 3 + 2 + 1)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(6)
    expect(result[0]).to.equal(1)
    expect(result[1]).to.equal(0)
    expect(result[2]).to.equal(1)
    expect(result[3]).to.equal(0)
    expect(result[4]).to.equal(1)
    expect(result[5]).to.equal(0)
    expect(input._offset).to.equal(2 * 3 + 2 + 1)
  })

  it('test_32bit_number_list_combo1', function () {
    // non-blank + blank
    let list = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 + 1 + 2 * 17 + 1)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(list.length)
    expect(result[0]).to.equal(1)
    expect(result[15]).to.equal(1)
    expect(result[17]).to.equal(0)
    expect(result[19]).to.equal(0)
    expect(input._offset).to.equal(2 + 1 + 2 * 17 + 1)
  })

  it('test_32bit_number_list_combo2', function () {
    // blank + non-blank
    let list = [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 + 1 + 1 + 2 * 17)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(list.length)
    expect(result[0]).to.equal(0)
    expect(result[2]).to.equal(0)
    expect(result[3]).to.equal(1)
    expect(result[19]).to.equal(1)
    expect(input._offset).to.equal(2 + 1 + 1 + 2 * 17)
  })

  it('test_32bit_number_list_combo3', function () {
    // non-blank + zebra
    let list = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 + 1 + 2 * 16 + 1 + 1 + 2 * 3)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(list.length)
    expect(result[0]).to.equal(1)
    expect(result[9]).to.equal(1)
    expect(result[16]).to.equal(0)
    expect(result[18]).to.equal(1)
    expect(input._offset).to.equal(2 + 1 + 2 * 16 + 1 + 1 + 2 * 3)
  })

  it('test_32bit_number_list_combo4', function () {
    // zebra + non-block
    let list = [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 + 1 + 2 * 11 + 1 + 2 * 16)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(list.length)
    expect(result[0]).to.equal(1)
    expect(result[14]).to.equal(0)
    expect(result[15]).to.equal(1)
    expect(result[30]).to.equal(2)
    expect(input._offset).to.equal(2 + 1 + 2 * 11 + 1 + 2 * 16)
  })

  it('test_32bit_number_list_combo5', function () {
    // zero + zebra
    let list = [0, 0, 0, 0, 0, 0, 1]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 + 1 + 1 + 2)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(list.length)
    expect(result[0]).to.equal(0)
    expect(result[6]).to.equal(1)
    expect(input._offset).to.equal(2 + 1 + 1 + 2)
  })

  it('test_32bit_number_list_combo6', function () {
    // zebra + zero
    let list = [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    let output = new BinaryOutput()
    output.dump32bitNumberList(list)
    expect(output.result().length).to.equal(2 + 1 + 2 * 12 + 1)

    let input = new BinaryInput(output.result())
    let result = input.load32bitNumberList()
    expect(result.length).to.equal(list.length)
    expect(result[0]).to.equal(1)
    expect(result[14]).to.equal(1)
    expect(result[15]).to.equal(0)
    expect(result[23]).to.equal(0)
    expect(input._offset).to.equal(2 + 1 + 2 * 12 + 1)
  })
})

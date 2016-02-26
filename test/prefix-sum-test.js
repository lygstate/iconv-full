import { PrefixSum } from '../src/PrefixSum'

describe('Testing PrefixSum performance', function () {
  it('Initial test with small values', function () {
    let prefixSum = new PrefixSum(1024, 2)
    expect(prefixSum.buffer.length).to.equal(64)
    prefixSum.initWithRandomData()
  })
})

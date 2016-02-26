export class BitVector {
  static SMALL_BLOCK_SIZE = 32
  static LARGE_BLOCK_SIZE = 256
  static BLOCK_RATE = 8

  static popcount (bits) {
    const SK5 = 0x55555555
    const SK3 = 0x33333333
    const SKF0 = 0x0f0f0f0f

    bits -= (bits >> 1) & SK5
    bits = (bits & SK3) + ((bits >> 2) & SK3)
    bits = (bits & SKF0) + ((bits >> 4) & SKF0)
    bits += bits >> 8

    return (bits + (bits >> 15)) & 63
  }

  static rank32 (x, i) {
    x <<= (BitVector.SMALL_BLOCK_SIZE - i)
    return BitVector.popcount(x)
  }
}

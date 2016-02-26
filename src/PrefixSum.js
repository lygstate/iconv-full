// Returns a random integer between min (included) and max (excluded)
// Using Math.round() will give you a non-uniform distribution!
function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

export class PrefixSum {
  constructor (size, bitWidth) {
    let bitCount = size * bitWidth
    this.buffer = new Uint32Array(bitCount >> 5)
    this.sumBuffer = new Uint32Array(bitCount >> 5)
  }

  initWithRandomData () {
    for (let i = 0; i < this.buffer.length; ++i) {
      this.buffer[i] = getRandomInt(0, (1 << 31) * 2)
    }
  }

  initSum () {

  }
}

'use strict'

// const assert = require('assert')

import { BurrowsWheelerTransform } from '../src/BurrowsWheelerTransform'

describe('testing BurrowsWheelerTransform', function () {
  it('bwtOriginal', function () {
    let bwt = BurrowsWheelerTransform.bwtOriginal('abracadabra')
    expect(bwt.index).to.equal(2)
    /*
    aabracadabr
    abraabracad
    abracadabra
    acadabraabr
    adabraabrac
    braabracada
    bracadabraa
    cadabraabra
    dabraabraca
    raabracadab
    racadabraab
    */
  })
})

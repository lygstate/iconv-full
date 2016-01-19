'use strict'

export class BurrowsWheelerTransform {
  static bwtOriginal (str) {
    let i = 0
    let prevStr = str
    let rows = []
    for (i = 0; i < str.length; ++i) {
      rows.push(prevStr)
      prevStr = prevStr[str.length - 1] + prevStr.substring(0, str.length - 1)
    }
    rows = rows.sort()
    return {
      rows: rows,
      index: rows.indexOf(str)
    }
  }
}

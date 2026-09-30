import { describe, expect, it } from 'vitest'
import { formatXrp, parseXrp } from './drops'

describe('parseXrp', () => {
  it('converts XRP to drops exactly', () => {
    expect(parseXrp('1')).toBe(1_000_000n)
    expect(parseXrp('12.5')).toBe(12_500_000n)
    expect(parseXrp('0.000001')).toBe(1n)
    expect(parseXrp(' 3.25 ')).toBe(3_250_000n)
    expect(parseXrp('100000000000')).toBe(100_000_000_000_000_000n)
  })

  it('rejects anything that is not a plain positive amount with up to 6 decimals', () => {
    for (const bad of ['', '.', '1.', '.5', '-1', '1.0000001', 'abc', '1e3', '1,000', '1 000']) {
      expect(parseXrp(bad), bad).toBeNull()
    }
  })
})

describe('formatXrp', () => {
  it('trims trailing zeros', () => {
    expect(formatXrp(12_500_000n)).toBe('12.5')
    expect(formatXrp(1n)).toBe('0.000001')
    expect(formatXrp(3_000_000n)).toBe('3')
    expect(formatXrp(0n)).toBe('0')
  })

  it('round-trips with parseXrp', () => {
    for (const text of ['0.1', '7', '123.456789', '0.000001']) {
      expect(formatXrp(parseXrp(text)!)).toBe(text)
    }
  })
})

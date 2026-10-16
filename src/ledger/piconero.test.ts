import { describe, expect, it } from 'vitest'
import { formatXmr, formatXmrShort, isXmrDraft, parseXmr } from './piconero'

describe('parseXmr', () => {
  it('converts XMR to piconero exactly', () => {
    expect(parseXmr('1')).toBe(1_000_000_000_000n)
    expect(parseXmr('12.5')).toBe(12_500_000_000_000n)
    expect(parseXmr('0.000000000001')).toBe(1n)
    expect(parseXmr('0.004213')).toBe(4_213_000_000n)
    expect(parseXmr(' 3.25 ')).toBe(3_250_000_000_000n)
    expect(parseXmr('100000000000')).toBe(100_000_000_000_000_000_000_000n)
  })

  it('rejects anything that is not a plain positive amount with up to 12 decimals', () => {
    for (const bad of ['', '.', '1.', '.5', '-1', '1.0000000000001', 'abc', '1e3', '1,000', '1 000']) {
      expect(parseXmr(bad), bad).toBeNull()
    }
  })
})

describe('formatXmr', () => {
  it('shows all twelve decimal places', () => {
    expect(formatXmr(12_500_000_000_000n)).toBe('12.500000000000')
    expect(formatXmr(1n)).toBe('0.000000000001')
    expect(formatXmr(3_000_000_000_000n)).toBe('3.000000000000')
    expect(formatXmr(0n)).toBe('0.000000000000')
  })

  it('round-trips with parseXmr', () => {
    for (const text of ['0.100000000000', '7.000000000000', '123.456789012345', '0.000000000001']) {
      expect(formatXmr(parseXmr(text)!)).toBe(text)
    }
  })
})

describe('formatXmrShort', () => {
  it('cuts to four decimal places without rounding', () => {
    expect(formatXmrShort(12_500_000_000_000n)).toBe('12.5000')
    expect(formatXmrShort(4_213_000_000n)).toBe('0.0042')
    expect(formatXmrShort(999_999_999_999n)).toBe('0.9999')
    expect(formatXmrShort(1n)).toBe('0.0000')
    expect(formatXmrShort(-4_213_000_000n)).toBe('-0.0042')
  })
})

describe('isXmrDraft', () => {
  it('lets an amount be typed one character at a time, up to twelve decimal places', () => {
    for (const draft of ['', '1', '12.', '.5', '0.123456789012']) expect(isXmrDraft(draft)).toBe(true)
  })

  it('refuses a thirteenth decimal place, a second point, and anything that is not a digit', () => {
    for (const draft of ['0.1234567890123', '1.2.3', '1a', '-1', '1 ', '1,5']) expect(isXmrDraft(draft)).toBe(false)
  })
})

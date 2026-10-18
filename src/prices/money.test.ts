import { describe, expect, it } from 'vitest'
import { sumDollars, toDollars, usd, usd5 } from './money'

describe('dollar format', () => {
  it('shows two decimals, rounded normally, with commas', () => {
    expect(usd(1234.567)).toBe('$1,234.57')
    expect(usd(0.004)).toBe('$0.00')
    expect(usd(0.005)).toBe('$0.01')
    expect(usd(1234567.8)).toBe('$1,234,567.80')
  })

  it('puts the minus before the dollar sign, and never on zero', () => {
    expect(usd(-51.709)).toBe('-$51.71')
    expect(usd(-0.001)).toBe('$0.00')
  })

  it('shows graph prices to five decimals', () => {
    expect(usd5(586.02)).toBe('$586.02000')
    expect(usd5(0.00130549)).toBe('$0.00131')
  })
})

describe('dollar values', () => {
  it('multiplies the coin amount by the price', () => {
    expect(toDollars(500_000_000_000n, 'XMR', 586.02)).toBeCloseTo(293.01, 10)
    expect(usd(toDollars(1_000_000_000_000_000_000n, 'ETH', 2337.36)!)).toBe('$2,337.36')
    expect(toDollars(-2_000_000n, 'XRP', 1.26)).toBeCloseTo(-2.52, 10)
  })

  it('is unknown with no price', () => {
    expect(toDollars(1n, 'BTC', undefined)).toBeNull()
    expect(toDollars(1n, 'BTC', null)).toBeNull()
  })

  it('adds up only when every part is known', () => {
    expect(sumDollars([1, 2.5])).toBe(3.5)
    expect(sumDollars([])).toBe(0)
    expect(sumDollars([1, null])).toBeNull()
  })
})

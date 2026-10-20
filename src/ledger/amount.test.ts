import { describe, expect, it } from 'vitest'
import { formatAmount, formatShort, isAmountDraft, MAX_WHOLE_DIGITS, parseAmount, tooLarge } from './amount'
import { COINS } from './coins'

// XMR (12 decimal places) carries over V2's tests; the other coins check their own precision.
const parseXmr = (input: string) => parseAmount(input, 12)
const formatXmr = (units: bigint) => formatAmount(units, 12)

describe('parseAmount', () => {
  it('converts XMR to piconero exactly', () => {
    expect(parseXmr('1')).toBe(1_000_000_000_000n)
    expect(parseXmr('12.5')).toBe(12_500_000_000_000n)
    expect(parseXmr('0.000000000001')).toBe(1n)
    expect(parseXmr('0.004213')).toBe(4_213_000_000n)
    expect(parseXmr(' 3.25 ')).toBe(3_250_000_000_000n)
    expect(parseXmr('100000000000')).toBe(100_000_000_000_000_000_000_000n)
  })

  it('rejects anything that is not a plain positive amount with up to 12 decimals', () => {
    for (const bad of ['', '.', ' . ', '..5', '5..', '-1', '1.0000000000001', 'abc', '1e3', '1,000', '1 000']) {
      expect(parseXmr(bad), bad).toBeNull()
    }
  })

  it('uses each coin’s own number of decimal places', () => {
    expect(parseAmount('1', 8)).toBe(100_000_000n)
    expect(parseAmount('0.00000001', 8)).toBe(1n)
    expect(parseAmount('0.000000001', 8)).toBeNull()
    expect(parseAmount('1', 6)).toBe(1_000_000n)
    expect(parseAmount('0.0000001', 6)).toBeNull()
    expect(parseAmount('1.000000000000000001', 18)).toBe(1_000_000_000_000_000_001n)
    expect(parseAmount('0.0000000000000000001', 18)).toBeNull()
  })
})

describe('0.4.1: a point with no digit on one side (B5)', () => {
  it('reads "5." as 5 and ".5" as 0.5, in every coin', () => {
    expect(parseXmr('5.')).toBe(5_000_000_000_000n)
    expect(parseXmr('123.')).toBe(123_000_000_000_000n)
    expect(parseXmr('.5')).toBe(500_000_000_000n)
    expect(parseXmr('.75')).toBe(750_000_000_000n)
    expect(parseAmount('.00000001', 8)).toBe(1n)
    expect(parseAmount('5.', 18)).toBe(5_000_000_000_000_000_000n)
  })

  it('tidies "5." and ".5" into the coin’s full format, as leaving the box does', () => {
    expect(formatXmr(parseXmr('5.')!)).toBe('5.000000000000')
    expect(formatXmr(parseXmr('.5')!)).toBe('0.500000000000')
    expect(formatAmount(parseAmount('123.', 8)!, 8)).toBe('123.00000000')
  })

  it('still refuses a lone point', () => {
    expect(parseXmr('.')).toBeNull()
    expect(parseAmount('.', 8)).toBeNull()
  })
})

describe('0.4.1: at most twelve whole-number digits (B8)', () => {
  it('reads twelve whole digits and refuses a thirteenth, in every coin', () => {
    expect(MAX_WHOLE_DIGITS).toBe(12)
    for (const { ticker, decimals } of COINS) {
      expect(parseAmount('9'.repeat(12), decimals), ticker).toBe(tooLarge(decimals) - 10n ** BigInt(decimals))
      expect(parseAmount('1'.repeat(13), decimals), ticker).toBeNull()
      expect(parseAmount('1'.repeat(13) + '.5', decimals), ticker).toBeNull()
    }
  })

  it('lets a twelfth whole digit be typed, but not a thirteenth, the way a thirteenth XMR decimal is refused', () => {
    expect(isAmountDraft('123456789012', 12)).toBe(true)
    expect(isAmountDraft('123456789012.123456789012', 12)).toBe(true)
    expect(isAmountDraft('1234567890123', 12)).toBe(false)
    expect(isAmountDraft('1234567890123.', 8)).toBe(false)
    expect(isAmountDraft('' + '9'.repeat(300), 6)).toBe(false)
  })
})

describe('formatAmount', () => {
  it('shows all twelve decimal places for XMR', () => {
    expect(formatXmr(12_500_000_000_000n)).toBe('12.500000000000')
    expect(formatXmr(1n)).toBe('0.000000000001')
    expect(formatXmr(3_000_000_000_000n)).toBe('3.000000000000')
    expect(formatXmr(0n)).toBe('0.000000000000')
  })

  it('round-trips with parseAmount', () => {
    for (const text of ['0.100000000000', '7.000000000000', '123.456789012345', '0.000000000001']) {
      expect(formatXmr(parseXmr(text)!)).toBe(text)
    }
  })

  it('round-trips the smallest unit and a large amount for every coin, without rounding', () => {
    for (const { ticker, decimals } of COINS) {
      const smallest = `0.${'0'.repeat(decimals - 1)}1`
      const large = `123456789012.${'9'.repeat(decimals)}`
      expect(parseAmount(smallest, decimals), ticker).toBe(1n)
      expect(formatAmount(parseAmount(smallest, decimals)!, decimals), ticker).toBe(smallest)
      expect(formatAmount(parseAmount(large, decimals)!, decimals), ticker).toBe(large)
    }
  })
})

describe('formatShort', () => {
  it('cuts to six decimal places without rounding', () => {
    expect(formatShort(12_500_000_000_000n, 12)).toBe('12.500000')
    expect(formatShort(4_213_000_000n, 12)).toBe('0.004213')
    expect(formatShort(999_999_999_999n, 12)).toBe('0.999999')
    expect(formatShort(1n, 12)).toBe('0.000000')
    expect(formatShort(-4_213_000_000n, 12)).toBe('-0.004213')
    expect(formatShort(999_999_999_999_999_999n, 18)).toBe('0.999999')
    expect(formatShort(123_456_789n, 8)).toBe('1.234567')
  })

  it('shows every place of a coin with six or fewer', () => {
    expect(formatShort(1n, 6)).toBe('0.000001')
    expect(formatShort(12_500_000n, 6)).toBe('12.500000')
  })
})

describe('isAmountDraft', () => {
  it('lets an amount be typed one character at a time, up to twelve decimal places for XMR', () => {
    for (const draft of ['', '1', '12.', '.5', '0.123456789012']) expect(isAmountDraft(draft, 12)).toBe(true)
  })

  it('refuses a place past the coin’s last, a second point, and anything that is not a digit', () => {
    for (const draft of ['0.1234567890123', '1.2.3', '1a', '-1', '1 ', '1,5']) expect(isAmountDraft(draft, 12)).toBe(false)
    expect(isAmountDraft('0.12345678', 8)).toBe(true)
    expect(isAmountDraft('0.123456789', 8)).toBe(false)
    expect(isAmountDraft('0.123456789012345678', 18)).toBe(true)
    expect(isAmountDraft('0.1234567', 6)).toBe(false)
  })
})

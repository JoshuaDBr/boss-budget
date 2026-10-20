import { describe, expect, it } from 'vitest'
import { FLOOR, cut, fitValue, letters, type Measure } from './fit'

// A stand-in for the screen: every character is half the font size wide.
const measure: Measure = (text, size) => [...text].length * size * 0.5
/** The room, in px, that holds exactly `n` characters at `size`. */
const room = (n: number, size: number) => n * size * 0.5

describe('0.4.1: letters (D1–D4)', () => {
  it('uses K, M and B with two decimals, rounded', () => {
    expect(letters('1,234.56')).toBe('1.23K')
    expect(letters('12345678.90')).toBe('12.35M')
    expect(letters('$4,567,890,123.00')).toBe('$4.57B')
    expect(letters('1999.995')).toBe('2.00K')
  })

  it('carries a rounding up to the next letter: 999,999 is 1.00M', () => {
    expect(letters('999999')).toBe('1.00M')
    expect(letters('999,995')).toBe('1.00M')
    expect(letters('999,994.99')).toBe('999.99K')
    expect(letters('999999999.999')).toBe('1.00B')
    expect(letters('$999,999.99')).toBe('$1.00M')
  })

  it('keeps the sign in front, the $ on dollars, and the ticker after', () => {
    expect(letters('-12345.678')).toBe('-12.35K')
    expect(letters('+$1,234.57')).toBe('+$1.23K')
    expect(letters('-$1,000,000.00')).toBe('-$1.00M')
    expect(letters('123456.789012 XTM')).toBe('123.46K XTM')
  })

  it('stops at B, and leaves amounts under 1,000 alone', () => {
    expect(letters('999999999999')).toBe('1000.00B')
    expect(letters('999.999')).toBeNull()
    expect(letters('0.000000000001')).toBeNull()
  })
})

describe('0.4.1: the cut "…" (D1–D4)', () => {
  const fitsIn = (n: number) => (text: string) => [...text].length <= n

  it('drops decimals from the end, never rounding, until the text fits', () => {
    expect(cut('123.456789', fitsIn(8))).toBe('123.456…')
    expect(cut('0.999999999999', fitsIn(6))).toBe('0.999…')
    expect(cut('-$5.678', fitsIn(6))).toBe('-$5.6…')
    expect(cut('123.456789 XMR', fitsIn(10))).toBe('123.4… XMR')
  })

  it('never touches a whole-number digit, even when nothing fits', () => {
    expect(cut('987.654321', fitsIn(2))).toBe('987…')
    expect(cut('-987.6', fitsIn(1))).toBe('-987…')
    expect(cut('987', fitsIn(2))).toBeNull()
  })
})

describe('0.4.1: fitting a value to its box (D1–D4)', () => {
  it('shows the full value when it fits, at the normal size', () => {
    expect(fitValue('$12.34', room(6, 17), measure, { size: 17 })).toEqual({ text: '$12.34', shortened: false })
  })

  it('without shrinking (full views, pop-up dollar box), goes straight to letters or the cut, at the same size', () => {
    expect(fitValue('$1,234,567.89', room(10, 17), measure, { size: 17 })).toEqual({ text: '$1.23M', shortened: true })
    expect(fitValue('0.123456789012', room(8, 19), measure, { size: 19 })).toEqual({ text: '0.12345…', shortened: true })
  })

  it('leaves room for the expand symbol once a value is shortened', () => {
    const fit = fitValue('0.123456789012', room(10, 10), measure, { size: 10, reserve: room(2, 10) })
    expect(fit).toEqual({ text: '0.12345…', shortened: true })
  })

  it('with shrinking (corner box, holdings), shrinks first and stops at 11px', () => {
    expect(fitValue('0.12345678', room(8, 14), measure, { size: 14, shrink: true })).toEqual({ text: '0.12345678', size: 11, shortened: false })
    expect(fitValue('0.123456789012', room(8, 14), measure, { size: 14, shrink: true })).toEqual({ text: '0.1234567…', size: FLOOR, shortened: true })
    expect(fitValue('-123456.789', room(5, 16), measure, { size: 16, shrink: true })).toEqual({ text: '-123.46K', size: FLOOR, shortened: true })
  })

  it('never shrinks below 11px or cuts a whole digit, even in a box too small for it', () => {
    const fit = fitValue('555.5555', room(2, 14), measure, { size: 14, shrink: true })
    expect(fit).toEqual({ text: '555…', size: FLOOR, shortened: true })
  })
})

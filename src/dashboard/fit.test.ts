import { describe, expect, it } from 'vitest'
import { fitFont } from './fit'

describe('fitFont', () => {
  it('leaves text that fits at the normal size', () => {
    expect(fitFont('0.000000000000000000', 20, 19)).toBeUndefined()
  })

  it('shrinks longer text in proportion, but never below 11px', () => {
    expect(fitFont('123456.123456789012345678', 20, 19)).toBe(15)
    expect(fitFont('9'.repeat(60), 20, 19)).toBe(11)
  })
})

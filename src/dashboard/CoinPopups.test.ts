import { describe, expect, it } from 'vitest'
import { confirmsDelete } from './CoinPopups'

describe('deleting a coin', () => {
  it('is confirmed only by typing "delete", in any case', () => {
    expect(confirmsDelete('delete')).toBe(true)
    expect(confirmsDelete('DeLeTe')).toBe(true)
    expect(confirmsDelete('')).toBe(false)
    expect(confirmsDelete('delet')).toBe(false)
    expect(confirmsDelete('deleted')).toBe(false)
  })
})

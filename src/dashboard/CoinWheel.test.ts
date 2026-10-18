import { describe, expect, it } from 'vitest'
import { slots, step } from './CoinWheel'

describe('the coin wheel', () => {
  it('is empty with no coin, and fills only the centre with one', () => {
    expect(slots([], null)).toEqual([])
    expect(slots(['XMR'], 'XMR')).toEqual([['XMR', 0]])
  })

  it('puts the other of two coins on the right when the coin on screen comes first, else on the left', () => {
    expect(slots(['BTC', 'XMR'], 'BTC')).toEqual([['BTC', 0], ['XMR', 1]])
    expect(slots(['BTC', 'XMR'], 'XMR')).toEqual([['XMR', 0], ['BTC', -1]])
  })

  it('shows the previous and next coins either side, wrapping round', () => {
    expect(slots(['BTC', 'XMR', 'ZEC'], 'XMR')).toEqual([['BTC', -1], ['XMR', 0], ['ZEC', 1]])
    expect(slots(['BTC', 'XMR', 'ZEC'], 'ZEC')).toEqual([['XMR', -1], ['ZEC', 0], ['BTC', 1]])
    expect(slots(['ARRR', 'BTC', 'XMR', 'ZEC'], 'ARRR')).toEqual([['ZEC', -1], ['ARRR', 0], ['BTC', 1]])
  })

  it('steps with the arrows, wrapping round', () => {
    expect(step(['BTC', 'XMR', 'ZEC'], 'ZEC', 1)).toBe('BTC')
    expect(step(['BTC', 'XMR', 'ZEC'], 'BTC', -1)).toBe('ZEC')
    expect(step(['BTC', 'XMR'], 'BTC', -1)).toBe('XMR')
  })
})

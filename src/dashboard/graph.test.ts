import { describe, expect, it } from 'vitest'
import { COINS } from '../ledger/coins'
import { COLORS, GRID_DECIMALS, gridLabel, niceTicks, nudge, percentChange } from './graph'

describe('graph settings', () => {
  it('gives every coin a color and fixed gridline decimals', () => {
    for (const c of COINS) {
      expect(COLORS[c.ticker]).toMatch(/^#[0-9A-F]{6}$/)
      expect(GRID_DECIMALS[c.ticker]).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('gridlines', () => {
  it('steps by 1, 2 or 5 times a power of ten', () => {
    expect(niceTicks(503, 612)).toEqual([520, 540, 560, 580, 600])
    expect(niceTicks(0.21, 0.29, 0.001)).toEqual([0.22, 0.24, 0.26, 0.28])
  })

  it('never steps finer than the coin’s decimals allow', () => {
    const ticks = niceTicks(80_000.2, 80_001.1, 1)
    expect(ticks).toEqual([80_001])
    ticks.forEach(t => expect(Number.isInteger(t)).toBe(true))
  })

  it('labels with the coin’s fixed decimals, whatever the price', () => {
    expect(gridLabel(500, GRID_DECIMALS.XMR)).toBe('$500')
    expect(gridLabel(80_000, GRID_DECIMALS.BTC)).toBe('$80,000')
    expect(gridLabel(1.25, GRID_DECIMALS.XRP)).toBe('$1.25')
    expect(gridLabel(0.25, GRID_DECIMALS.ARRR)).toBe('$0.250')
    expect(gridLabel(0.0013, GRID_DECIMALS.XTM)).toBe('$0.00130')
  })
})

describe('Boss graph', () => {
  it('shows percent change from the first day', () => {
    expect(percentChange([100, 110, 90])).toEqual([0, 10.000000000000009, -9.999999999999998])
  })

  it('nudges line-end labels apart and keeps them inside the graph', () => {
    expect(nudge([50, 52, 51], 13, 0, 200)).toEqual([50, 76, 63])
    expect(nudge([195, 199], 13, 0, 200)).toEqual([187, 200])
  })
})

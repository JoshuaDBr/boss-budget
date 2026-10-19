import { describe, expect, it } from 'vitest'
import { COINS } from '../ledger/coins'
import { GECKO_ID, graphUrl, lastDays, parseGraph, parsePrices, pricesUrl } from './coingecko'

describe('CoinGecko requests', () => {
  it('names every coin', () => {
    expect(Object.keys(GECKO_ID).sort()).toEqual(COINS.map(c => c.ticker).sort())
  })

  it('always asks for all twelve prices in one request, whatever has been added', () => {
    const ids = new URL(pricesUrl()).searchParams.get('ids')!.split(',')
    expect(ids).toHaveLength(12)
    expect(ids).toContain('monero')
    expect(ids).toContain('zcoin')
  })

  it('asks for 90 daily points', () => {
    expect(graphUrl('XTM')).toBe('https://api.coingecko.com/api/v3/coins/minotari/market_chart?vs_currency=usd&days=90&interval=daily')
  })
})

describe('reading replies', () => {
  it('reads prices by ticker and skips coins missing from the reply', () => {
    expect(parsePrices({ monero: { usd: 577.28 }, bitcoin: { usd: 80725 }, zano: {} })).toEqual({ XMR: 577.28, BTC: 80725 })
  })

  it('refuses a reply with no prices', () => {
    expect(() => parsePrices({ status: { error_code: 429 } })).toThrow()
    expect(() => parsePrices(null)).toThrow()
  })

  it('reads a graph, oldest first', () => {
    expect(parseGraph({ prices: [[1, 2.5], [2, 3], [3, 3.25]] })).toEqual([2.5, 3, 3.25])
  })

  it('refuses a graph it cannot read', () => {
    expect(() => parseGraph({ prices: [] })).toThrow()
    expect(() => parseGraph({ prices: [[1, 2], [2, 'x']] })).toThrow()
    expect(() => parseGraph('nope')).toThrow()
  })

  it('cuts a 90-day graph to the last 30 or 60 days', () => {
    const ninety = Array.from({ length: 91 }, (_, i) => i)
    expect(lastDays(ninety, 30)).toHaveLength(31)
    expect(lastDays(ninety, 30)[30]).toBe(90)
    expect(lastDays(ninety, 60)[0]).toBe(30)
    expect(lastDays(ninety, 90)).toHaveLength(91)
  })
})

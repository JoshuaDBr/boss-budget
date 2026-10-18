import { describe, expect, it } from 'vitest'
import { COINS, byName, coinLabel, findCoin } from './coins'

describe('coins', () => {
  it('lists the twelve coins in ticker order, each with its checked number of decimal places', () => {
    expect(COINS.map(c => `${c.ticker} ${c.decimals}`)).toEqual([
      'ARRR 8', 'BCH 8', 'BTC 8', 'DASH 8', 'ETH 18', 'FIRO 8', 'SOL 9', 'XMR 12', 'XRP 6', 'XTM 6', 'ZANO 12', 'ZEC 8',
    ])
  })

  it('lists them alphabetically by full name for Add a Currency', () => {
    expect(byName(COINS).map(coinLabel)).toEqual([
      'Bitcoin (BTC)', 'Bitcoin Cash (BCH)', 'Dash (DASH)', 'Ethereum (ETH)', 'Firo (FIRO)', 'Monero (XMR)',
      'Pirate Chain (ARRR)', 'Ripple (XRP)', 'Solana (SOL)', 'Tari (XTM)', 'Zano (ZANO)', 'Zcash (ZEC)',
    ])
  })

  it('finds a coin by ticker', () => {
    expect(findCoin('XMR')?.name).toBe('Monero')
    expect(findCoin('DOGE')).toBeUndefined()
  })
})

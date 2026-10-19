// CoinGecko's free, keyless feed: one request for every coin's price, and one request per coin for its graph.
// Nothing is sent but which coins to look up, and the all-coins request always names all twelve.

import { COINS } from '../ledger/coins'

export const API = 'https://api.coingecko.com/api/v3'

/** CoinGecko's name for each coin. */
export const GECKO_ID: Record<string, string> = {
  ARRR: 'pirate-chain',
  BCH: 'bitcoin-cash',
  BTC: 'bitcoin',
  DASH: 'dash',
  ETH: 'ethereum',
  FIRO: 'zcoin',
  SOL: 'solana',
  XMR: 'monero',
  XRP: 'ripple',
  XTM: 'minotari',
  ZANO: 'zano',
  ZEC: 'zcash',
}

/** Every graph is fetched at 90 days. The 30 and 60 day graphs are its last 31 and 61 points. */
export const GRAPH_DAYS = 90

export const pricesUrl = () => `${API}/simple/price?ids=${COINS.map(c => GECKO_ID[c.ticker]).join(',')}&vs_currencies=usd`

export const graphUrl = (ticker: string) =>
  `${API}/coins/${GECKO_ID[ticker]}/market_chart?vs_currency=usd&days=${GRAPH_DAYS}&interval=daily`

const isPrice = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/** The all-coins reply: { monero: { usd: 577.28 }, ... }. Coins missing from it are left out. Throws if none are there. */
export function parsePrices(body: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (body && typeof body === 'object') {
    for (const c of COINS) {
      const usd = (body as Record<string, { usd?: unknown } | undefined>)[GECKO_ID[c.ticker]]?.usd
      if (isPrice(usd)) out[c.ticker] = usd
    }
  }
  if (!Object.keys(out).length) throw new Error('The price reply held no prices')
  return out
}

/** A graph reply: { prices: [[time, price], ...] }, oldest first. Returns the prices alone. Throws if unreadable. */
export function parseGraph(body: unknown): number[] {
  const rows = body && typeof body === 'object' ? (body as { prices?: unknown }).prices : undefined
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('The graph reply held no prices')
  const points = rows.map(r => (Array.isArray(r) ? r[1] : undefined))
  if (!points.every(isPrice)) throw new Error('The graph reply held a price that could not be read')
  return points as number[]
}

/** The last `days` days of a 90-day graph: days + 1 daily points, ending now. */
export const lastDays = (points: readonly number[], days: number) => points.slice(Math.max(0, points.length - (days + 1)))

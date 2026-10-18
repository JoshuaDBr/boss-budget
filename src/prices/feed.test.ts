import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COINS } from '../ledger/coins'
import { GECKO_ID } from './coingecko'
import { bossRefreshJobs, coinRefreshJobs, countdownText, Feed, launchJobs, newestTime, remaining, SPACING, type Get } from './feed'

const ALL_PRICES = Object.fromEntries(COINS.map((c, i) => [GECKO_ID[c.ticker], { usd: i + 1 }]))
const graph = (last: number) => ({ prices: [[0, last - 1], [1, last]] })

/** A fake feed: records each request and when it was sent, and answers from `answer`. */
function fake(answer: (url: string) => unknown | Promise<unknown>) {
  const sent: { url: string; at: number }[] = []
  const get: Get = async url => {
    sent.push({ url, at: Date.now() })
    const reply = await answer(url)
    if (reply instanceof Error) throw reply
    return reply
  }
  return { sent, get }
}
const ok = (url: string) => (url.includes('simple/price') ? ALL_PRICES : graph(100))
const tickerOf = (url: string) => COINS.find(c => url.includes(`/coins/${GECKO_ID[c.ticker]}/`))?.ticker ?? 'prices'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 18, 13, 42))
})
afterEach(() => vi.useRealTimers())

describe('request order', () => {
  it('launch: prices, the featured coin, other added coins by ticker, then the rest by ticker', () => {
    const jobs = launchJobs(['XRP', 'BTC', 'XMR'], 'XMR')
    expect(jobs).toHaveLength(13)
    expect(jobs.map(j => (j.kind === 'prices' ? 'prices' : j.ticker))).toEqual([
      'prices', 'XMR', 'BTC', 'XRP', 'ARRR', 'BCH', 'DASH', 'ETH', 'FIRO', 'SOL', 'XTM', 'ZANO', 'ZEC',
    ])
  })

  it('launch with no coin added still fetches every graph', () => {
    expect(launchJobs([], null)).toHaveLength(13)
  })

  it('a coin refresh is prices then that coin; a Boss refresh is prices then all 12, added first', () => {
    expect(coinRefreshJobs('XMR')).toEqual([{ kind: 'prices' }, { kind: 'graph', ticker: 'XMR' }])
    const boss = bossRefreshJobs(['XTM', 'BTC'])
    expect(boss.slice(0, 3)).toEqual([{ kind: 'prices' }, { kind: 'graph', ticker: 'BTC' }, { kind: 'graph', ticker: 'XTM' }])
    expect(boss).toHaveLength(13)
  })
})

describe('the queue', () => {
  it('sends one request at a time, 12 seconds apart', async () => {
    const { sent, get } = fake(ok)
    const feed = new Feed(get)
    feed.launch(launchJobs(['XMR'], 'XMR'))
    await vi.runAllTimersAsync()
    expect(sent).toHaveLength(13)
    const start = sent[0].at
    sent.forEach((s, i) => expect(s.at - start).toBe(i * SPACING))
    expect(feed.getState().running).toBe(false)
  })

  it('launch counts down from 2:24 with 13 requests', () => {
    const feed = new Feed(fake(ok).get)
    feed.launch(launchJobs([], null))
    expect(countdownText(remaining(feed.getState(), Date.now()))).toBe('2:24')
  })

  it('waits for a slow reply before sending the next request', async () => {
    const { sent, get } = fake(url => (url.includes('simple') ? new Promise(r => setTimeout(() => r(ALL_PRICES), 20_000)) : graph(1)))
    const feed = new Feed(get)
    feed.launch(coinRefreshJobs('BTC'))
    await vi.runAllTimersAsync()
    expect(sent[1].at - sent[0].at).toBe(20_000)
  })

  it('keeps every price and graph from the launch, and the graph’s last point becomes the price', async () => {
    const feed = new Feed(fake(ok).get)
    feed.launch(launchJobs(['XMR'], 'XMR'))
    await vi.advanceTimersByTimeAsync(0)
    expect(feed.getState().prices.XMR.price).toBe(8)
    await vi.advanceTimersByTimeAsync(SPACING)
    expect(feed.getState().prices.XMR.price).toBe(100)
    expect(feed.getState().graphs.XMR).toEqual([99, 100])
  })

  it('moves a waiting graph to the front without changing the spacing or sending anything twice', async () => {
    const { sent, get } = fake(ok)
    const feed = new Feed(get)
    feed.launch(launchJobs(['XMR'], 'XMR'))
    await vi.advanceTimersByTimeAsync(SPACING + 1) // prices and XMR sent
    feed.prioritize('ZEC')
    expect(feed.getState().waiting[0]).toBe('ZEC')
    await vi.runAllTimersAsync()
    expect(tickerOf(sent[2].url)).toBe('ZEC')
    expect(sent[2].at - sent[1].at).toBe(SPACING)
    expect(sent).toHaveLength(13)
    expect(new Set(sent.map(s => s.url)).size).toBe(13)
  })

  it('a refresh cannot start while another is running', async () => {
    const { sent, get } = fake(ok)
    const feed = new Feed(get)
    expect(feed.refresh(coinRefreshJobs('XMR'))).toBe(true)
    expect(feed.refresh(coinRefreshJobs('XMR'))).toBe(false)
    await vi.runAllTimersAsync()
    expect(sent).toHaveLength(2)
    expect(feed.refresh(coinRefreshJobs('XMR'))).toBe(true)
  })

  it('a refresh right after the launch still keeps 12 seconds from the last request', async () => {
    const { sent, get } = fake(ok)
    const feed = new Feed(get)
    feed.launch([{ kind: 'prices' }])
    await vi.advanceTimersByTimeAsync(1000)
    feed.refresh([{ kind: 'prices' }])
    await vi.runAllTimersAsync()
    expect(sent[1].at - sent[0].at).toBe(SPACING)
  })
})

describe('failures', () => {
  it('a failure in the launch cancels the rest of the queue but keeps what arrived', async () => {
    const { sent, get } = fake(url => (url.includes('/ripple/') ? new Error('429') : ok(url)))
    const feed = new Feed(get)
    feed.launch(launchJobs(['XMR', 'XRP', 'BTC'], 'XMR'))
    await vi.runAllTimersAsync()
    expect(sent.map(s => tickerOf(s.url))).toEqual(['prices', 'XMR', 'BTC', 'XRP'])
    const s = feed.getState()
    expect(s.running).toBe(false)
    expect(s.failures).toBe(1)
    expect(Object.keys(s.graphs).sort()).toEqual(['BTC', 'XMR'])
    expect(s.waiting).toEqual([])
  })

  it('a failed refresh cancels everything and puts back the earlier prices, graphs and time', async () => {
    let fail = false
    let price = 10
    const { get } = fake(url => {
      if (url.includes('simple')) return { monero: { usd: price } }
      return fail ? new Error('offline') : graph(price + 0.5)
    })
    const feed = new Feed(get)
    feed.launch(coinRefreshJobs('XMR'))
    await vi.runAllTimersAsync()
    const before = feed.getState()
    expect(before.prices.XMR.price).toBe(10.5)

    vi.advanceTimersByTime(60_000)
    price = 20
    fail = true
    feed.refresh(coinRefreshJobs('XMR'))
    await vi.advanceTimersByTimeAsync(0)
    expect(feed.getState().prices.XMR.price).toBe(20) // shown as it arrives
    await vi.runAllTimersAsync()
    const after = feed.getState()
    expect(after.running).toBe(false)
    expect(after.failures).toBe(1)
    expect(after.prices).toEqual(before.prices)
    expect(after.graphs).toEqual(before.graphs)
  })

  it('a successful refresh keeps its results', async () => {
    let price = 10
    const feed = new Feed(fake(url => (url.includes('simple') ? { monero: { usd: price } } : graph(price))).get)
    feed.launch([{ kind: 'prices' }])
    await vi.runAllTimersAsync()
    price = 20
    feed.refresh(coinRefreshJobs('XMR'))
    await vi.runAllTimersAsync()
    expect(feed.getState().prices.XMR.price).toBe(20)
    expect(feed.getState().graphs.XMR).toEqual([19, 20])
  })

  it('an unreadable reply counts as a failure', async () => {
    const feed = new Feed(fake(() => ({ error: 'rate limited' })).get)
    feed.launch([{ kind: 'prices' }])
    await vi.runAllTimersAsync()
    expect(feed.getState().failures).toBe(1)
    expect(feed.getState().prices).toEqual({})
  })

  it('the launch runs only once', async () => {
    const { sent, get } = fake(ok)
    const feed = new Feed(get)
    feed.launch([{ kind: 'prices' }])
    feed.launch([{ kind: 'prices' }])
    await vi.runAllTimersAsync()
    expect(sent).toHaveLength(1)
  })
})

describe('countdown and label', () => {
  it('reads minutes and seconds until under a minute, then seconds only', () => {
    expect(countdownText(144_000)).toBe('2:24')
    expect(countdownText(60_000)).toBe('1:00')
    expect(countdownText(59_001)).toBe('1:00')
    expect(countdownText(59_000)).toBe('59')
    expect(countdownText(12_000)).toBe('12')
    expect(countdownText(0)).toBe('0')
  })

  it('counts to the moment the last request is sent', () => {
    expect(remaining({ left: 2, nextAt: 5_000 }, 0)).toBe(5_000 + SPACING)
    expect(remaining({ left: 1, nextAt: -Infinity }, 0)).toBe(0)
    expect(remaining({ left: 0, nextAt: 0 }, 0)).toBe(0)
  })

  it('a coin refresh counts down from 12', () => {
    const feed = new Feed(fake(ok).get)
    feed.refresh(coinRefreshJobs('XMR'))
    expect(countdownText(remaining(feed.getState(), Date.now()))).toBe('12')
  })

  it('labels the time of the newest price', () => {
    expect(newestTime({})).toBeNull()
    const at = new Date(2026, 9, 18, 13, 42).getTime()
    expect(newestTime({ XMR: { price: 1, at }, BTC: { price: 1, at: at - 3_600_000 } })).toBe('1:42 PM')
  })
})

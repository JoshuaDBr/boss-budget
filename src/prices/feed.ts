// The price feed: one queue, one request at a time, at least 12 seconds apart (the free feed allows about five a
// minute; see the V4 pace test). Prices live in memory only, so an app opened offline shows $-,-- until one arrives.
//
// The launch queue keeps each result as it arrives; if a request fails, the rest of the queue is dropped. A refresh
// holds its results apart from the loaded ones: they show as they arrive, are kept once the whole refresh succeeds,
// and are thrown away if any request in it fails, which puts back the prices (and graphs) loaded before it.

import { COINS } from '../ledger/coins'
import { graphUrl, parseGraph, parsePrices, pricesUrl } from './coingecko'

export const SPACING = 12_000

export type Job = { kind: 'prices' } | { kind: 'graph'; ticker: string }

export interface Price {
  price: number
  /** When it was fetched (ms). */
  at: number
}

interface Loaded {
  prices: Record<string, Price>
  graphs: Record<string, number[]>
}

export interface FeedState extends Loaded {
  /** True while the launch queue or a refresh is running. Refresh cannot be clicked until it ends. */
  running: boolean
  /** Requests still waiting to be sent. */
  left: number
  /** The earliest the next waiting request may be sent (ms). */
  nextAt: number
  /** Coins whose graph is waiting or on its way. */
  waiting: string[]
  /** Counts failures, so a new one can show the pop-up again. */
  failures: number
}

/** Fetches a URL and returns its JSON. Throws on a lost connection or a refusal. */
export type Get = (url: string) => Promise<unknown>

export const httpGet: Get = async url => {
  const reply = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!reply.ok) throw new Error(`The price feed answered ${reply.status}`)
  return reply.json()
}

/** Launch order: the all-coins price request, the featured coin's graph, the other added coins' graphs by ticker,
 * then the graphs of coins not added, by ticker. Always 13 requests. */
export function launchJobs(added: readonly string[], featured: string | null): Job[] {
  const tickers = COINS.map(c => c.ticker)
  const order = [
    ...(featured ? [featured] : []),
    ...tickers.filter(t => t !== featured && added.includes(t)),
    ...tickers.filter(t => t !== featured && !added.includes(t)),
  ]
  return [{ kind: 'prices' }, ...order.map(ticker => ({ kind: 'graph' as const, ticker }))]
}

/** A refresh on a coin's dashboard: the all-coins price request, then that coin's graph. */
export const coinRefreshJobs = (ticker: string | null): Job[] =>
  [{ kind: 'prices' }, ...(ticker ? [{ kind: 'graph' as const, ticker }] : [])]

/** A refresh in the Boss View: the all-coins price request, then all 12 graphs, added coins first. */
export const bossRefreshJobs = (added: readonly string[]): Job[] => launchJobs(added, null)

const urlOf = (job: Job) => (job.kind === 'prices' ? pricesUrl() : graphUrl(job.ticker))

export class Feed {
  private loaded: Loaded = { prices: {}, graphs: {} }
  /** A refresh's results, until it finishes. */
  private staged: Loaded | null = null
  private queue: Job[] = []
  private sending: Job | null = null
  private lastSend = -Infinity
  private timer: ReturnType<typeof setTimeout> | undefined
  /** Bumped when a batch starts or is cancelled, so a late reply from an old batch is ignored. */
  private batch = 0
  private failures = 0
  private listeners = new Set<() => void>()
  private state: FeedState
  launched = false

  constructor(private get: Get = httpGet) {
    this.state = this.build()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  getState = () => this.state

  /** Starts the launch queue. Only the first call does anything. */
  launch(jobs: Job[]) {
    if (this.launched) return
    this.launched = true
    this.start(jobs, false)
  }

  /** Starts a refresh. Refused (false) while the launch queue or another refresh is running. */
  refresh(jobs: Job[]) {
    if (this.state.running) return false
    this.start(jobs, true)
    return true
  }

  /** Moves a coin's waiting graph to the front of the queue, behind the prices if they are still waiting. The spacing
   * does not change. */
  prioritize(ticker: string) {
    const i = this.queue.findIndex(j => j.kind === 'graph' && j.ticker === ticker)
    const front = this.queue[0]?.kind === 'prices' ? 1 : 0
    if (i <= front) return
    const [job] = this.queue.splice(i, 1)
    this.queue.splice(front, 0, job)
    this.publish()
  }

  private start(jobs: Job[], staged: boolean) {
    this.batch++
    this.queue = jobs
    this.staged = staged ? { prices: {}, graphs: {} } : null
    this.publish()
    this.schedule()
  }

  private schedule() {
    clearTimeout(this.timer)
    if (this.sending || !this.queue.length) return
    this.timer = setTimeout(() => void this.send(), Math.max(0, this.lastSend + SPACING - Date.now()))
  }

  private async send() {
    const job = this.queue.shift()
    if (!job) return
    const batch = this.batch
    this.sending = job
    this.lastSend = Date.now()
    this.publish()
    try {
      const body = await this.get(urlOf(job))
      if (batch !== this.batch) return
      const into = this.staged ?? this.loaded
      const at = Date.now()
      if (job.kind === 'prices') {
        for (const [ticker, price] of Object.entries(parsePrices(body))) into.prices[ticker] = { price, at }
      } else {
        const points = parseGraph(body)
        into.graphs[job.ticker] = points
        into.prices[job.ticker] = { price: points[points.length - 1], at }
      }
      this.sending = null
      if (!this.queue.length && this.staged) {
        this.loaded = {
          prices: { ...this.loaded.prices, ...this.staged.prices },
          graphs: { ...this.loaded.graphs, ...this.staged.graphs },
        }
        this.staged = null
      }
      this.schedule()
    } catch {
      if (batch !== this.batch) return
      this.batch++
      this.sending = null
      this.queue = []
      this.staged = null
      this.failures++
    }
    this.publish()
  }

  private build(): FeedState {
    const shown = this.staged
      ? { prices: { ...this.loaded.prices, ...this.staged.prices }, graphs: { ...this.loaded.graphs, ...this.staged.graphs } }
      : { prices: { ...this.loaded.prices }, graphs: { ...this.loaded.graphs } }
    const graphJobs = [...(this.sending ? [this.sending] : []), ...this.queue]
    return {
      ...shown,
      running: this.sending !== null || this.queue.length > 0,
      left: this.queue.length,
      nextAt: this.lastSend + SPACING,
      waiting: graphJobs.flatMap(j => (j.kind === 'graph' ? [j.ticker] : [])),
      failures: this.failures,
    }
  }

  private publish() {
    this.state = this.build()
    for (const l of this.listeners) l()
  }
}

/** Milliseconds until the last waiting request is sent; 0 while only the last reply is awaited. */
export function remaining(state: Pick<FeedState, 'left' | 'nextAt'>, now: number) {
  if (!state.left) return 0
  return Math.max(now, state.nextAt) + SPACING * (state.left - 1) - now
}

/** 2:24 until under a minute, then 59. Whole seconds, rounded up. */
export function countdownText(ms: number) {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  return s < 60 ? String(s) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The time of the newest price, for the label under the refresh button: "1:42 PM". Null with no price yet. */
export function newestTime(prices: Record<string, Price>) {
  const times = Object.values(prices).map(p => p.at)
  if (!times.length) return null
  return new Date(Math.max(...times)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

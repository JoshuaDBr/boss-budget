import type { Coin } from '../ledger/coins'

// The coin wheel (the approved "wheel 1" lens). The coin on screen sits in the centre, the previous coin on the left
// and the next on the right, in ticker order, wrapping round. No coin shows twice.

/**
 * The coins to show and where: -1 left, 0 centre, 1 right. With two coins the other one sits on the right if the coin
 * on screen comes first in ticker order, and on the left if it comes second.
 */
export function slots(coins: readonly string[], on: string | null): [string, number][] {
  if (on === null) return []
  const i = coins.indexOf(on), n = coins.length
  if (n === 2) return [[on, 0], [coins[1 - i], i === 0 ? 1 : -1]]
  if (n >= 3) return [[coins[(i - 1 + n) % n], -1], [on, 0], [coins[(i + 1) % n], 1]]
  return [[on, 0]]
}

/** The coin a step away from the one on screen, wrapping round. */
export function step(coins: readonly string[], on: string, by: 1 | -1): string {
  const n = coins.length
  return coins[(coins.indexOf(on) + by + n) % n]
}

// A shallow lens tilted toward the viewer. t runs across it from -1 to 1; u = 1 - t².
const CX = 280, HW = 266, HUB_Y = 146, TAB_STEP = 0.66
const wx = (t: number) => CX + HW * t
const wu = (t: number) => 1 - t * t
const wTop = (t: number) => 88 - 66 * wu(t)
const wIn = (t: number) => 108 - 46 * wu(t)
const wBot = (t: number) => 116 + 30 * wu(t)
const wRim = (t: number) => wBot(t) + 2 + 8 * wu(t)

const T = Array.from({ length: 41 }, (_, k) => -1 + k / 20)
const fwd = (f: (t: number) => number) => T.map((t, k) => `${k ? 'L' : 'M'}${wx(t).toFixed(1)} ${f(t).toFixed(1)}`).join(' ')
const back = (f: (t: number) => number) => [...T].reverse().map(t => `L${wx(t).toFixed(1)} ${f(t).toFixed(1)}`).join(' ')

function tabTransform(d: number) {
  const t = d * TAB_STEP, u = wu(t)
  const x = wx(t), y = 98 - 56 * u
  const angle = (Math.atan((112 * t) / (2 * HW)) * 180) / Math.PI
  const scale = Math.max(0.5, 0.62 + 0.48 * u)
  return `translate(${(x - 35).toFixed(1)}px,${(y - 17).toFixed(1)}px) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)})`
}

interface Props {
  /** The coins added, in ticker order. */
  coins: readonly Coin[]
  /** The coin on screen, or null while none has been added. */
  on: string | null
  /** Why the wheel cannot turn right now (a pop-up is open), if it cannot. */
  blocked: string | null
  onView: (ticker: string) => void
}

export default function CoinWheel({ coins, on, blocked, onView }: Props) {
  const tickers = coins.map(c => c.ticker)
  const turns = on !== null && tickers.length > 1 && !blocked
  const go = (ticker: string) => turns && onView(ticker)
  const nav = (by: 1 | -1) => ({
    type: 'button' as const,
    className: turns ? 'arcNav' : 'arcNav dull',
    'aria-disabled': turns ? undefined : true,
    title: blocked ?? undefined,
    onClick: turns ? () => go(step(tickers, on!, by)) : undefined,
  })
  const spokes = [-1, -0.6, -0.2, 0.2, 0.6, 1]
  return (
    <section id="arcC" className="comp" aria-label="Coin wheel">
      <svg id="arcSvg" viewBox="0 0 560 170" aria-hidden="true">
        <defs>
          <linearGradient id="w1face" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#ecebe4" /></linearGradient>
          <linearGradient id="w1rim" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#b9b8ae" /><stop offset=".5" stopColor="#8d8c83" /><stop offset="1" stopColor="#6f6e66" /></linearGradient>
        </defs>
        <path d={`${fwd(wBot)} ${back(wRim)} Z`} fill="url(#w1rim)" stroke="#333" strokeWidth="1.3" strokeLinejoin="round" />
        <path d={`${fwd(wTop)} L${wx(1)} ${wBot(1)} ${back(wBot)} Z`} fill="url(#w1face)" stroke="#333" strokeWidth="1.8" strokeLinejoin="round" />
        <path d={`${fwd(wTop)} ${back(wIn)} Z`} fill="#f6f6f0" />
        <path d={fwd(wIn)} fill="none" stroke="#333" strokeWidth="1.4" />
        {spokes.filter(t => Math.abs(t) < 1).map(t => (
          <line key={`d${t}`} x1={wx(t).toFixed(1)} y1={wTop(t).toFixed(1)} x2={wx(t).toFixed(1)} y2={wIn(t).toFixed(1)} stroke="#aaa" strokeWidth="1" />
        ))}
        {spokes.map(t => (
          <line key={`s${t}`} x1={wx(t).toFixed(1)} y1={wIn(t).toFixed(1)} x2={CX} y2={HUB_Y} stroke="#777" strokeWidth="1.3" />
        ))}
        <ellipse cx={CX} cy={HUB_Y} rx="17" ry="6.5" fill="#d9d8d0" stroke="#333" strokeWidth="1.5" />
        <ellipse cx={CX} cy={HUB_Y - 1.5} rx="7" ry="2.6" fill="#fff" />
        <path d={`M${CX - 8} 2 L${CX + 8} 2 L${CX} 12 Z`} fill="#4f7fa8" />
      </svg>
      <div id="arcTabs">
        {slots(tickers, on).map(([coin, d]) => (
          <button
            key={coin}
            type="button"
            className={`tab${d === 0 ? ' act' : ''}${d !== 0 && !turns ? ' dull' : ''}`}
            style={{ transform: tabTransform(d) }}
            aria-pressed={d === 0}
            aria-disabled={d === 0 || !turns ? true : undefined}
            onClick={d === 0 ? undefined : () => go(coin)}
          >
            {coin}
          </button>
        ))}
      </div>
      <button id="arcPrev" aria-label="Previous coin" {...nav(-1)}>‹</button>
      <button id="arcNext" aria-label="Next coin" {...nav(1)}>›</button>
    </section>
  )
}

import { lastDays } from '../prices/coingecko'
import { usd5 } from '../prices/money'
import { COLORS, DAY_LABELS, GRID_DECIMALS, gridLabel, niceTicks, type Range } from './graph'

// The price graph: the featured coin's real price over the chosen range, in the coin's color.
const W = 788, H = 178, PAD_T = 12, PAD_B = 24

export interface GraphLine {
  ticker: string
  /** The 90-day graph, oldest first; undefined until it arrives. */
  points: number[] | undefined
  /** True while its graph is waiting or on its way. */
  waiting: boolean
  price: number | null
}

/** With no coin added yet, the graph is blank. */
export default function PriceChart({ line, range }: { line: GraphLine | null; range: Range }) {
  return (
    <section id="chartC" className="comp box" aria-label="Price graph">
      {line && <CoinGraph line={line} range={range} />}
    </section>
  )
}

function CoinGraph({ line, range }: { line: GraphLine; range: Range }) {
  const L = 168, R = 14
  const { ticker, price } = line
  const points = line.points && lastDays(line.points, range)
  let body
  if (!points) {
    body = <Note left={L} right={R} text={line.waiting ? 'loading' : 'Failed to load.'} />
  } else {
    const lo0 = Math.min(...points), hi0 = Math.max(...points), pad = (hi0 - lo0) * 0.08 || hi0 * 0.01
    const lo = lo0 - pad, hi = hi0 + pad
    const decimals = GRID_DECIMALS[ticker]
    const ticks = niceTicks(lo, hi, 10 ** -decimals)
    const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1)
    const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B)
    body = (
      <>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#ddd" strokeDasharray="3 5" />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" fontSize="11" fill="#888">{gridLabel(t, decimals)}</text>
          </g>
        ))}
        <path d={path(points, x, y)} fill="none" stroke={COLORS[ticker]} strokeWidth="2" strokeLinejoin="round" />
      </>
    )
  }
  return (
    <svg id="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${ticker} price graph, ${range} days`}>
      {body}
      <Axes left={L} right={R} range={range} />
      <text x="10" y="34" fontSize="28" fill="#333">{ticker}</text>
      <text x="10" y="56" fontSize="14" fill="#555">{price === null ? '$-,--' : usd5(price)}</text>
      <text x="10" y="128" fontSize="24" fill="#333">USD</text>
    </svg>
  )
}

const path = (values: readonly number[], x: (i: number) => number, y: (v: number) => number) =>
  values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

/** "loading" or "Failed to load.", centered on the empty axes. */
function Note({ left, right, text }: { left: number; right: number; text: string }) {
  return (
    <text x={(left + W - right) / 2} y={(PAD_T + H - PAD_B) / 2 + 6} textAnchor="middle" fontSize="18" fill="#888">{text}</text>
  )
}

function Axes({ left, right, range }: { left: number; right: number; range: Range }) {
  return (
    <>
      <path d={`M${left} ${PAD_T - 4} L${left - 1} ${H - PAD_B} L${W - right} ${H - PAD_B + 1}`} fill="none" stroke="#333" strokeWidth="1.4" />
      {DAY_LABELS[range].map((l, i) => (
        <text key={l} x={left + (i * (W - right - left)) / 3} y={H - 6} textAnchor="middle" fontSize="11" fill="#888">{l}</text>
      ))}
    </>
  )
}

// The arithmetic behind the price graphs: gridlines, labels and colors. Drawing is in PriceChart.tsx.

/** Each coin's fixed line color, the same in every graph. */
export const COLORS: Record<string, string> = {
  ARRR: '#7A5C1E', BCH: '#0AC18E', BTC: '#E8380D', DASH: '#008DE4', ETH: '#627EEA', FIRO: '#9B1C2E',
  SOL: '#9945FF', XMR: '#FF6600', XRP: '#23292F', XTM: '#7DB800', ZANO: '#14A3A3', ZEC: '#E8B800',
}

/** Decimals on each coin's gridline labels, fixed ahead of time (V4 Q93). */
export const GRID_DECIMALS: Record<string, number> = {
  BTC: 0, ETH: 0, ZEC: 0, XMR: 0, BCH: 0, SOL: 0, DASH: 0,
  ZANO: 2, XRP: 2, FIRO: 2,
  ARRR: 3,
  XTM: 5,
}

export type Range = 30 | 60 | 90
export const RANGES: readonly Range[] = [30, 60, 90]

/** Four day labels per range, evenly spaced, ending at now. */
export const DAY_LABELS: Record<Range, string[]> = {
  30: ['-30d', '-20d', '-10d', 'now'],
  60: ['-60d', '-40d', '-20d', 'now'],
  90: ['-90d', '-60d', '-30d', 'now'],
}

/**
 * Gridline values: about `count` steps across [lo, hi], the step being the nearest of 1, 2 or 5 times a power of ten, and never finer than
 * `minStep` (so every label can be written with the coin's fixed decimals).
 */
export function niceTicks(lo: number, hi: number, minStep = 0, count = 4): number[] {
  const raw = Math.max((hi - lo) / count, minStep, Number.MIN_VALUE)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const nearest = [1, 2, 5, 10].map(m => m * mag).reduce((a, b) => (Math.abs(Math.log(b / raw)) < Math.abs(Math.log(a / raw)) ? b : a))
  const step = Math.max(nearest, minStep)
  const ticks: number[] = []
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-9; k++) ticks.push(+(k * step).toPrecision(12))
  return ticks
}

/** A gridline's dollar label, with the coin's fixed decimals: $500, $1.25, $0.250, $0.00130. */
export const gridLabel = (value: number, decimals: number) =>
  '$' + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/** Percent change from the first point: the Boss graph's lines. */
export const percentChange = (points: readonly number[]) => points.map(p => (p / points[0] - 1) * 100)

/**
 * Nudges label positions (top to bottom) at least `gap` apart, kept within [top, bottom]. Returns the new positions in
 * the order given.
 */
export function nudge(ys: readonly number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 0; k < order.length; k++) order[k].y = Math.max(order[k].y, k ? order[k - 1].y + gap : top)
  for (let k = order.length - 1; k >= 0; k--) order[k].y = Math.min(order[k].y, k < order.length - 1 ? order[k + 1].y - gap : bottom)
  const out = new Array<number>(ys.length)
  for (const o of order) out[o.i] = o.y
  return out
}

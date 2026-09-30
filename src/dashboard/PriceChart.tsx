// Placeholder price chart: axes, grid and a fixed sample line. No price data in V1.
const W = 788, H = 178, PAD_L = 112, PAD_R = 14, PAD_T = 12, PAD_B = 24
const POINTS = 61

const sample = Array.from({ length: POINTS }, (_, i) => 0.5 + 0.22 * Math.sin(i / 6) + 0.1 * Math.sin(i / 2.3))
const x = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / (POINTS - 1)
const y = (v: number) => PAD_T + (1 - v) * (H - PAD_T - PAD_B)
const line = sample.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
const ticks = [0.2, 0.4, 0.6, 0.8]
const days = [{ i: 0, label: '-30d' }, { i: 20, label: '-20d' }, { i: 40, label: '-10d' }, { i: 60, label: 'now' }]

export default function PriceChart() {
  return (
    <section id="chartC" className="comp box" aria-label="Price chart (placeholder)">
      <svg id="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Price chart placeholder">
        {ticks.map(t => (
          <line key={t} x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#ddd" strokeDasharray="3 5" />
        ))}
        <path d={`M${PAD_L} ${PAD_T - 4} L${PAD_L - 1} ${H - PAD_B} L${W - PAD_R} ${H - PAD_B + 1}`} fill="none" stroke="#333" strokeWidth="1.4" />
        {days.map(d => (
          <text key={d.label} x={x(d.i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#888">{d.label}</text>
        ))}
        <path d={line} fill="none" stroke="#bbb" strokeWidth="1.6" strokeDasharray="5 4" />
        <text x="10" y="34" fontSize="28" fill="#333">XRP</text>
        <text x="10" y="54" fontSize="11" fill="#888">$0.00</text>
        <text x="10" y="72" fontSize="11" fill="#888">sample line</text>
        <text x="10" y="128" fontSize="24" fill="#333">USD</text>
      </svg>
    </section>
  )
}

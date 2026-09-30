import { OUT_OF_SCOPE } from './placeholder'

// Placeholder 30 / 60 / 90 day selector, fixed on 30 days.
const CX = 125, CY = 100, R = 88, ROTATION = -90
const RANGES = [30, 60, 90]
const SELECTED = 30

export default function DayRangeWheel() {
  return (
    <section id="pieC" className="comp" title={OUT_OF_SCOPE}>
      <svg id="pie" viewBox="0 0 230 200" role="img" aria-label="Chart day range: 30 days (placeholder)">
        <path d="M8 88 L28 100 L8 112 Z" fill="#333" />
        <g style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${ROTATION}deg)` }}>
          {RANGES.map((v, i) => {
            const c = -90 + i * 120
            const a0 = ((c - 60) * Math.PI) / 180, a1 = ((c + 60) * Math.PI) / 180, cr = (c * Math.PI) / 180
            const lx = CX + Math.cos(cr) * 50, ly = CY + Math.sin(cr) * 50
            return (
              <g key={v} className={`wedge${v === SELECTED ? ' sel' : ''}`}>
                <path d={`M${CX} ${CY} L${CX + Math.cos(a0) * R} ${CY + Math.sin(a0) * R} A${R} ${R} 0 0 1 ${CX + Math.cos(a1) * R} ${CY + Math.sin(a1) * R} Z`} />
                <text x={lx} y={ly + 9} textAnchor="middle" style={{ transformOrigin: `${lx}px ${ly}px`, transform: `rotate(${-ROTATION}deg)` }}>{v}</text>
              </g>
            )
          })}
        </g>
      </svg>
      <div id="pieCap">chart: {SELECTED} days</div>
    </section>
  )
}

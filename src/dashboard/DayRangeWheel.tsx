import { RANGES, type Range } from './graph'

// The 30 / 60 / 90 day disc. Clicking a wedge selects that range; every graph follows.
const CX = 125, CY = 100, R = 88, ROTATION = -90

export default function DayRangeWheel({ range, onRange }: { range: Range; onRange: (range: Range) => void }) {
  return (
    <section id="pieC" className="comp">
      <svg id="pie" viewBox="0 0 230 200" role="group" aria-label={`Graph day range: ${range} days`}>
        <path d="M8 88 L28 100 L8 112 Z" fill="#333" />
        <g style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${ROTATION}deg)` }}>
          {RANGES.map((v, i) => {
            const c = -90 + i * 120
            const a0 = ((c - 60) * Math.PI) / 180, a1 = ((c + 60) * Math.PI) / 180, cr = (c * Math.PI) / 180
            const lx = CX + Math.cos(cr) * 50, ly = CY + Math.sin(cr) * 50
            return (
              <g
                key={v}
                className={`wedge${v === range ? ' sel' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${v} days`}
                aria-pressed={v === range}
                onClick={() => onRange(v)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onRange(v)}
              >
                <path d={`M${CX} ${CY} L${CX + Math.cos(a0) * R} ${CY + Math.sin(a0) * R} A${R} ${R} 0 0 1 ${CX + Math.cos(a1) * R} ${CY + Math.sin(a1) * R} Z`} />
                <text x={lx} y={ly + 9} textAnchor="middle" style={{ transformOrigin: `${lx}px ${ly}px`, transform: `rotate(${-ROTATION}deg)` }}>{v}</text>
              </g>
            )
          })}
        </g>
      </svg>
      <div id="pieCap">graph: {range} days</div>
    </section>
  )
}

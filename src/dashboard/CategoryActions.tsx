import type { Mode } from './categoryMode'
import { startAdd, startDelete, startMove } from './categoryMode'

// Small square tabs attached to the top edge of the categories box, at its left end.
// Absolutely positioned in the gap above the box, so nothing else moves.
// Icons are drawn as SVG so they do not depend on the fonts installed.
const ACTIONS = [
  { label: 'Add', title: 'Add a category', icon: 'M8 3 V13 M3 8 H13', start: startAdd },
  { label: 'Move', title: 'Move XRP between categories', icon: 'M5 13 V3 M2.5 5.5 L5 3 L7.5 5.5 M11 3 V13 M8.5 10.5 L11 13 L13.5 10.5', start: startMove },
  { label: 'Delete', title: 'Delete a category', icon: 'M3 8 H13', start: startDelete },
]

interface Props {
  /** Why the buttons cannot be used right now (a pop-up is open, or the saved budget is damaged), if they cannot. */
  blocked: string | null
  onStart: (mode: Mode) => void
}

export default function CategoryActions({ blocked, onStart }: Props) {
  return (
    <div id="catTools" className="comp" role="group" aria-label="Category actions">
      {ACTIONS.map(a => (
        <button
          key={a.label}
          type="button"
          className={blocked ? 'sq dull' : 'sq'}
          aria-label={a.label}
          aria-disabled={blocked ? true : undefined}
          title={blocked ?? a.title}
          onClick={blocked ? undefined : () => onStart(a.start())}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d={a.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}

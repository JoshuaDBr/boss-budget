import type { Coin } from '../ledger/coins'
import type { Mode } from './categoryMode'
import { startDeposit, startSpend } from './categoryMode'

// Rounded buttons below the bottom-right corner of the categories box, separate from it.
// Absolutely positioned in the gap under the box, so nothing else moves.
// Dulled while a pop-up is open.
const ACTIONS = [
  { label: 'Deposit', start: startDeposit },
  { label: 'Spend', start: startSpend },
]

interface Props {
  coin: Coin | null
  /** Why the buttons cannot be used right now (a pop-up is open, or the saved budget is damaged), if they cannot. */
  blocked: string | null
  onStart: (mode: Mode) => void
}

export default function BudgetActions({ coin, blocked, onStart }: Props) {
  return (
    <div id="moneyTools" className="comp" role="group" aria-label="Deposit and spend">
      {ACTIONS.map(a => (
        <button
          key={a.label}
          type="button"
          className={blocked ? 'rr dull' : 'rr'}
          aria-disabled={blocked ? true : undefined}
          title={coin ? `${a.label} ${coin.ticker}` : a.label}
          onClick={blocked ? undefined : () => onStart(a.start())}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

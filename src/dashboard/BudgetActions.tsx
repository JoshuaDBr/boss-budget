import { placeholder } from './placeholder'

// Rounded buttons below the bottom-right corner of the categories box, separate from it.
// Absolutely positioned in the gap under the box, so nothing else moves.
export default function BudgetActions() {
  return (
    <div id="moneyTools" className="comp" role="group" aria-label="Deposit and spend">
      <button className="rr" {...placeholder('Deposit XRP (coming in Stage 5)')}>Deposit</button>
      <button className="rr" {...placeholder('Spend XRP (coming in Stage 5)')}>Spend</button>
    </div>
  )
}

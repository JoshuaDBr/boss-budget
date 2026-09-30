import { placeholder } from './placeholder'

// Rounded buttons below the bottom-right corner of the categories box, separate from it.
// Absolutely positioned in the gap under the box, so nothing else moves.
// Dulled while a category pop-up is open.
export default function BudgetActions({ dull }: { dull: boolean }) {
  const className = dull ? 'rr dull' : 'rr'
  return (
    <div id="moneyTools" className="comp" role="group" aria-label="Deposit and spend">
      <button className={className} {...placeholder('Deposit XRP (coming in Stage 5)')}>Deposit</button>
      <button className={className} {...placeholder('Spend XRP (coming in Stage 5)')}>Spend</button>
    </div>
  )
}

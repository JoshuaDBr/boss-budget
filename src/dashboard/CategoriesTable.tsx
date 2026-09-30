import { formatXrp } from '../ledger/drops'
import { READY_TO_ASSIGN } from '../ledger/ledger'
import type { BudgetState } from '../useBudget'
import { placeholder } from './placeholder'

export default function CategoriesTable({ budget }: { budget: BudgetState }) {
  return (
    <>
      <section id="tableC" className="comp box" aria-label="Budget categories">
        <div id="tblScroll">
          <table className="bud">
            <tbody>
              {budget.snapshot ? (
                budget.snapshot.categories.map(c => (
                  <tr key={c.id} className={c.id === READY_TO_ASSIGN ? 'ready' : undefined}>
                    <td className="cat">
                      {c.name}
                      {c.id === READY_TO_ASSIGN && <small>deposits land here</small>}
                    </td>
                    <td>{formatXrp(c.balance)}</td>
                    <td>$0.00</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty" colSpan={3}>
                    The budget saved in this browser could not be read, so it has been left untouched.
                    <br />
                    <small>{budget.error}</small>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="tfoot">
          <div className="c1">category</div>
          <div className="c2">XRP</div>
          <div className="c3">USD</div>
        </div>
      </section>
      <div id="tblArrowC" className="comp">
        <button className="arrow" aria-label="Show all categories" {...placeholder('Coming in a later stage')}>
          ↓<span className="lab">more</span>
        </button>
      </div>
    </>
  )
}

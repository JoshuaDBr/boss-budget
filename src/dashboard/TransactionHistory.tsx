import { isoToUs } from '../ledger/dates'
import type { Category, Snapshot, Transaction } from '../ledger/ledger'
import { formatXmr, formatXmrShort } from '../ledger/piconero'

// The history and the budget trade places. Normally the budget is in the central box and the corner shows the mini
// history. The corner arrow swaps them: the full history goes to the center and the corner shows the mini budget.

/** Newest first: by date, then by the order recorded. */
export const newestFirst = (transactions: readonly Transaction[]) =>
  [...transactions].sort((a, b) => (a.date === b.date ? b.order - a.order : a.date < b.date ? 1 : -1))

/** "+" before a deposit's XMR, "-" before a spend's. */
const sign = (t: Transaction) => (t.kind === 'deposit' ? '+' : '-')

/** A spend's category, or null if that category has been deleted. Deposits land in Ready to Assign. */
const categoryOf = (t: Transaction, categories: readonly Category[]) => categories.find(c => c.id === t.from) ?? null

interface CornerProps {
  snapshot?: Snapshot
  view: 'budget' | 'history'
  /** Why the arrow cannot be used right now (a pop-up is open), if it cannot. */
  blocked: string | null
  onSwap: () => void
}

/** The corner box: the mini history (display only), or the mini budget while the history is in the center. */
export function Corner({ snapshot, view, blocked, onSwap }: CornerProps) {
  return (
    <>
      <section key={view} id="txC" className="comp" aria-label={view === 'budget' ? 'Transaction history' : 'Budget'}>
        <table className="tx">
          <tbody>
            {view === 'budget'
              ? newestFirst(snapshot?.transactions ?? []).map(t => (
                  <tr key={t.id}>
                    <td className="date">{isoToUs(t.date)}</td>
                    <td className="note">{t.note}</td>
                    <td className="usd muted">$-,--</td>
                    <td className="num">{sign(t)}{formatXmrShort(t.amount)}</td>
                  </tr>
                ))
              : snapshot?.categories.map(c => (
                  <tr key={c.id}>
                    <td className="note">{c.name}</td>
                    <td className="usd muted">$-,--</td>
                    <td className={c.balance < 0n ? 'num neg' : 'num'}>{formatXmrShort(c.balance)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </section>
      <div id="txArrowC" className="comp">
        <button
          type="button"
          className={blocked ? 'arrow dull' : 'arrow'}
          aria-label={view === 'budget' ? 'Show the full history' : 'Show the budget'}
          aria-disabled={blocked ? true : undefined}
          onClick={blocked ? undefined : onSwap}
        >
          ↓{view === 'budget' && <span className="lab">all</span>}
        </button>
      </div>
    </>
  )
}

interface HistoryProps {
  snapshot: Snapshot
  /** Whether rows can be clicked right now (not while a pop-up is open). */
  editable: boolean
  onEdit: (transaction: Transaction) => void
}

/** The full history in the central box. Clicking a row opens it for editing. */
export function HistoryTable({ snapshot, editable, onEdit }: HistoryProps) {
  return (
    <section id="tableC" className="comp box" aria-label="Transaction history">
      <div id="tblScroll">
        <table className="bud hist">
          <tbody>
            {newestFirst(snapshot.transactions).map(t => {
              const category = categoryOf(t, snapshot.categories)
              return (
                <tr key={t.id} className={editable ? 'choosable' : undefined} onClick={editable ? () => onEdit(t) : undefined}>
                  <td className="date">{isoToUs(t.date)}</td>
                  <td className="note">{t.note}</td>
                  <td className="hcat">
                    {t.kind === 'deposit' ? 'Ready to Assign' : category ? category.name : <span className="unassigned">Unassigned</span>}
                  </td>
                  <td>$-,--</td>
                  <td>{sign(t)}{formatXmr(t.amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="tfoot hist">
        <div className="c1">date</div>
        <div className="c1 note">note</div>
        <div className="c1 hcat">category</div>
        <div className="c2">USD</div>
        <div className="c3">XMR</div>
      </div>
    </section>
  )
}

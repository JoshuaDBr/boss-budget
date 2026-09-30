import { useEffect, useRef } from 'react'
import { formatXrp } from '../ledger/drops'
import { MAX_NAME_LENGTH, READY_TO_ASSIGN, type Category } from '../ledger/ledger'
import type { BudgetState } from '../useBudget'
import { isChoosable, type Mode } from './categoryMode'
import { nameProblem } from './categoryRules'
import { placeholder } from './placeholder'

interface Props {
  budget: BudgetState
  mode: Mode | null
  onChoose: (category: Category) => void
  onName: (name: string) => void
  onSaveName: () => void
}

/** What a chosen row is labelled with while Move or Delete is open. */
function chosenAs(mode: Mode | null, id: string): string | null {
  if (mode?.kind === 'move') return mode.from === id ? 'from' : mode.to === id ? 'to' : null
  if (mode?.kind === 'delete') return mode.id === id ? 'delete' : null
  return null
}

export default function CategoriesTable({ budget, mode, onChoose, onName, onSaveName }: Props) {
  const nameBox = useRef<HTMLInputElement>(null)
  const adding = mode?.kind === 'add'

  // The new row sits at the bottom of the table; bring it into view with the cursor already in it.
  useEffect(() => {
    if (!adding) return
    nameBox.current?.scrollIntoView({ block: 'nearest' })
    nameBox.current?.focus()
  }, [adding])

  return (
    <>
      <section id="tableC" className="comp box" aria-label="Budget categories">
        <div id="tblScroll">
          <table className="bud">
            <tbody>
              {budget.snapshot ? (
                budget.snapshot.categories.map(c => {
                  const choosable = isChoosable(mode, c)
                  const chosen = chosenAs(mode, c.id)
                  const classes = [c.id === READY_TO_ASSIGN && 'ready', choosable && 'choosable', chosen && 'chosen']
                  return (
                    <tr
                      key={c.id}
                      className={classes.filter(Boolean).join(' ') || undefined}
                      onClick={choosable ? () => onChoose(c) : undefined}
                    >
                      <td className="cat">
                        {c.name}
                        {c.id === READY_TO_ASSIGN && <small>deposits land here</small>}
                        {chosen ? <span className="tag">{chosen}</span> : choosable && <span className="pick">select</span>}
                      </td>
                      <td>{formatXrp(c.balance)}</td>
                      <td>$0.00</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="empty" colSpan={3}>
                    The budget saved in this browser could not be read, so it has been left untouched.
                    <br />
                    <small>{budget.error}</small>
                  </td>
                </tr>
              )}
              {mode?.kind === 'add' && budget.snapshot && (
                // Green outline once the name can be saved; no outline while it is blank or a duplicate.
                <tr className={nameProblem(mode.name, budget.snapshot.categories) ? 'draft' : 'draft ok'}>
                  <td className="cat">
                    <input
                      ref={nameBox}
                      data-naming
                      aria-label="New category name"
                      value={mode.name}
                      maxLength={MAX_NAME_LENGTH}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={e => onName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onSaveName()}
                    />
                  </td>
                  <td>0</td>
                  <td>$0.00</td>
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

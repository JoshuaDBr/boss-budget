import { useEffect, useRef, useState } from 'react'
import type { Category, Transaction } from '../ledger/ledger'
import { formatAmount } from '../ledger/amount'
import type { BookStore } from '../useBook'
import BossButton from './BossButton'
import BudgetActions from './BudgetActions'
import CategoriesTable from './CategoriesTable'
import CategoryActions from './CategoryActions'
import CategoryPopup from './CategoryPopup'
import { choose, confirmsSave, deleteChange, pendingChange, scopeOf, startEdit, type Mode } from './categoryMode'
import CoinWheel from './CoinWheel'
import DayRangeWheel from './DayRangeWheel'
import Filters from './Filters'
import Holdings from './Holdings'
import PriceChart from './PriceChart'
import Refresh from './Refresh'
import { Corner, HistoryTable } from './TransactionHistory'
import './dashboard.css'

// Desktop layout: a fixed 1280 x 800 stage. Every component is absolutely
// positioned, so adding or resizing one never moves another.
export default function Dashboard({ store }: { store: BookStore }) {
  const { state, update } = store
  const [mode, setMode] = useState<Mode | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Which view is in the central box. The other one shows in the corner.
  const [view, setView] = useState<'budget' | 'history'>('budget')

  const coin = state.coin ?? null
  const change = mode && state.snapshot ? pendingChange(mode, state.snapshot.categories, coin) : null
  const cancel = () => {
    setMode(null)
    setError(null)
  }
  const record = (apply: NonNullable<typeof change>) => {
    const refused = mode ? update(apply, scopeOf(mode)) : null
    if (refused) setError(refused)
    else cancel()
  }
  // Deposit, Spend and edits ask first: Save shows the question, and Yes records.
  const save = () => {
    if (!mode || !change) return
    if (confirmsSave(mode)) edit({ ...mode, confirm: 'save', ...(mode.kind === 'edit' && { listOpen: false }) })
    else record(change)
  }
  const confirm = () => {
    if (mode?.kind === 'edit' && mode.confirm === 'delete') record(deleteChange(mode))
    else if (change) record(change)
  }
  const edit = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  // Escape is the same as Cancel in every pop-up.
  const latest = useRef({ mode, cancel })
  latest.current = { mode, cancel }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && latest.current.mode) latest.current.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // While a new category is being named, only the name box, Save and Cancel respond to clicks.
  // With the box still empty, a click anywhere else is the same as Cancel.
  const adding = mode?.kind === 'add'
  useEffect(() => {
    if (!adding) return
    const allowed = (e: Event) => e.target instanceof Element && e.target.closest('[data-naming]') !== null
    const hold = (e: Event) => {
      if (allowed(e)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const click = (e: Event) => {
      if (allowed(e)) return
      hold(e)
      const current = latest.current.mode
      if (current?.kind === 'add' && !current.name.trim()) latest.current.cancel()
    }
    const options = { capture: true }
    window.addEventListener('pointerdown', hold, options)
    window.addEventListener('mousedown', hold, options)
    window.addEventListener('click', click, options)
    return () => {
      window.removeEventListener('pointerdown', hold, options)
      window.removeEventListener('mousedown', hold, options)
      window.removeEventListener('click', click, options)
    }
  }, [adding])

  const busy = mode ? 'Finish or cancel the open pop-up first' : null
  const blocked = state.error
    ? 'The saved budget could not be read, so it cannot be changed'
    : (busy ?? (view === 'history' ? 'Swap the budget back to the center first' : null))

  return (
    <main id="stage">
      <h1 className="sr">Boss Budget</h1>
      <Refresh />
      <PriceChart coin={coin} />
      <DayRangeWheel />
      <Holdings coin={coin} total={state.snapshot?.total} />
      <CategoryActions coin={coin} blocked={blocked} onStart={edit} />
      {view === 'history' && state.snapshot ? (
        <HistoryTable
          snapshot={state.snapshot}
          coin={coin}
          editable={!mode && coin !== null}
          onEdit={(t: Transaction) => coin && edit(startEdit(t, formatAmount(t.amount, coin.decimals)))}
        />
      ) : (
        <CategoriesTable
          budget={state}
          mode={mode}
          onChoose={(category: Category) => mode && edit(choose(mode, category))}
          onName={name => edit({ kind: 'add', name })}
          onSaveName={save}
        />
      )}
      <BudgetActions coin={coin} blocked={blocked ?? (coin ? null : 'Add a currency first')} onStart={edit} />
      <Filters />
      <CoinWheel />
      <BossButton />
      <Corner snapshot={state.snapshot} coin={coin} view={view} blocked={state.error ?? busy} onSwap={() => setView(view === 'budget' ? 'history' : 'budget')} />
      {mode && state.snapshot && (
        <CategoryPopup
          snapshot={state.snapshot}
          coin={coin}
          mode={mode}
          ready={change !== null}
          error={error}
          onChange={edit}
          onSave={save}
          onCancel={cancel}
          onConfirm={confirm}
        />
      )}
    </main>
  )
}

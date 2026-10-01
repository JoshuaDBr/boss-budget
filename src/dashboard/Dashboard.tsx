import { useEffect, useRef, useState } from 'react'
import type { Category } from '../ledger/ledger'
import type { BudgetStore } from '../useBudget'
import BossButton from './BossButton'
import BudgetActions from './BudgetActions'
import CategoriesTable from './CategoriesTable'
import CategoryActions from './CategoryActions'
import CategoryPopup from './CategoryPopup'
import { choose, pendingChange, type Mode } from './categoryMode'
import CoinWheel from './CoinWheel'
import DayRangeWheel from './DayRangeWheel'
import Filters from './Filters'
import Holdings from './Holdings'
import PriceChart from './PriceChart'
import Refresh from './Refresh'
import TransactionHistory from './TransactionHistory'
import './dashboard.css'

// Desktop layout: a fixed 1280 x 800 stage. Every component is absolutely
// positioned, so adding or resizing one never moves another.
export default function Dashboard({ store }: { store: BudgetStore }) {
  const { state, update } = store
  const [mode, setMode] = useState<Mode | null>(null)
  const [error, setError] = useState<string | null>(null)

  const change = mode && state.snapshot ? pendingChange(mode, state.snapshot.categories) : null
  const cancel = () => {
    setMode(null)
    setError(null)
  }
  const save = () => {
    if (!change) return
    const refused = update(change)
    if (refused) setError(refused)
    else cancel()
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

  const blocked = state.error
    ? 'The saved budget could not be read, so it cannot be changed'
    : mode
      ? 'Finish or cancel the open pop-up first'
      : null

  return (
    <main id="stage">
      <h1 className="sr">Boss Budget</h1>
      <Refresh />
      <PriceChart />
      <DayRangeWheel />
      <Holdings total={state.snapshot?.total} />
      <CategoryActions blocked={blocked} onStart={edit} />
      <CategoriesTable
        budget={state}
        mode={mode}
        onChoose={(category: Category) => mode && edit(choose(mode, category))}
        onName={name => edit({ kind: 'add', name })}
        onSaveName={save}
      />
      <BudgetActions blocked={blocked} onStart={edit} />
      <Filters />
      <CoinWheel />
      <BossButton />
      <TransactionHistory />
      {mode && state.snapshot && (
        <CategoryPopup
          snapshot={state.snapshot}
          mode={mode}
          ready={change !== null}
          error={error}
          onChange={edit}
          onSave={save}
          onCancel={cancel}
        />
      )}
    </main>
  )
}

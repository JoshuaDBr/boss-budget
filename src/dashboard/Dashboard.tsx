import { useEffect, useMemo, useRef, useState } from 'react'
import type { Category, Transaction } from '../ledger/ledger'
import { formatAmount } from '../ledger/amount'
import { addedCoins } from '../ledger/book'
import { renameCategory, snapshot } from '../ledger/ledger'
import type { BookStore } from '../useBook'
import BossButton from './BossButton'
import BudgetActions from './BudgetActions'
import CategoriesTable, { BossTable } from './CategoriesTable'
import CategoryActions from './CategoryActions'
import CategoryPopup from './CategoryPopup'
import { choose, confirmsSave, deleteChange, pendingChange, scopeOf, startEdit, type Mode } from './categoryMode'
import { holders } from './categoryRules'
import CoinPopup, { type CoinPop } from './CoinPopups'
import CoinWheel from './CoinWheel'
import DayRangeWheel from './DayRangeWheel'
import Filters from './Filters'
import Holdings from './Holdings'
import PriceChart, { type GraphLine } from './PriceChart'
import Refresh, { FailedPopup } from './Refresh'
import { PricesContext, feed, useFeed } from '../prices/prices'
import { bossRefreshJobs, coinRefreshJobs, launchJobs } from '../prices/feed'
import { BOSS_MIN, bossData, holdingCount } from './boss'
import type { Range } from './graph'
import { BossHistoryTable, Corner, HistoryTable } from './TransactionHistory'
import './dashboard.css'

// Desktop layout: a fixed 1280 x 800 stage. Every component is absolutely
// positioned, so adding or resizing one never moves another.
export default function Dashboard({ store }: { store: BookStore }) {
  const { state, update } = store
  const [mode, setMode] = useState<Mode | null>(null)
  // Add a Currency and Delete a coin: centered pop-ups of their own, outside the category modes.
  const [coinPop, setCoinPop] = useState<CoinPop | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Which view is in the central box. The other one shows in the corner.
  const [view, setView] = useState<'budget' | 'history'>('budget')
  const prices = useFeed()
  const today = useMemo(() => Object.fromEntries(Object.entries(prices.prices).map(([t, p]) => [t, p.price])), [prices.prices])
  // The graphs always open at 90 days.
  const [range, setRange] = useState<Range>(90)
  // The launch queue starts once, when the app opens.
  useEffect(() => {
    if (state.book) feed.launch(launchJobs(addedCoins(state.book).map(c => c.ticker), state.coin?.ticker ?? null))
    else feed.launch(launchJobs([], null))
  }, [])
  // A coin whose graph is still waiting moves to the front of the queue when it comes on screen.
  const ticker = state.coin?.ticker ?? null
  useEffect(() => {
    if (ticker) feed.prioritize(ticker)
  }, [ticker])

  const coin = state.coin ?? null
  // The Boss View needs at least two coins holding money outside Ready to Assign. A delete that leaves fewer exits it.
  const [bossOn, setBossOn] = useState(false)
  const holding = holdingCount(state.book)
  const boss = bossOn && holding >= BOSS_MIN && state.book !== undefined
  useEffect(() => {
    if (bossOn && holding < BOSS_MIN) setBossOn(false)
  }, [bossOn, holding])
  const combined = useMemo(() => (boss && state.book ? bossData(state.book) : null), [boss, state.book])
  const change = mode && state.snapshot ? pendingChange(mode, state.snapshot.categories, coin) : null
  const cancel = () => {
    setMode(null)
    setCoinPop(null)
    setError(null)
  }
  const coinDone = (refused: string | null) => {
    if (refused) setError(refused)
    else cancel()
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
  const latest = useRef({ open: false, cancel })
  latest.current = { open: mode !== null || coinPop !== null, cancel }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && latest.current.open) latest.current.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // While a new category is being named, only the name box, Save and Cancel respond to clicks.
  // With the box still empty, a click anywhere else is the same as Cancel.
  const adding = mode?.kind === 'add'
  const latestMode = useRef<{ name: string } | null>(null)
  latestMode.current = mode?.kind === 'add' ? mode : null
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
      if (!latestMode.current?.name.trim()) latest.current.cancel()
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

  const busy = mode || coinPop ? 'Finish or cancel the open pop-up first' : null
  const holdings = state.book ? addedCoins(state.book).map(c => ({ coin: c, total: snapshot(state.book.coins[c.ticker]).total })) : []
  const lineOf = (t: string): GraphLine => ({ ticker: t, points: prices.graphs[t], waiting: prices.waiting.includes(t), price: today[t] ?? null })
  const rename = (id: string, name: string) => update(budget => renameCategory(budget, id, name), 'categories')
  const blocked = state.error
    ? 'The saved budget could not be read, so it cannot be changed'
    : (busy ?? (view === 'history' ? 'Swap the budget back to the center first' : null))

  return (
    <PricesContext.Provider value={today}>
    <main id="stage">
      <h1 className="sr">Boss Budget</h1>
      <Refresh
        feed={prices}
        onRefresh={() => feed.refresh(boss ? bossRefreshJobs(holdings.map(h => h.coin.ticker)) : coinRefreshJobs(ticker))}
      />
      <PriceChart line={coin && lineOf(coin.ticker)} boss={boss ? holdings.map(h => lineOf(h.coin.ticker)) : null} range={range} />
      <DayRangeWheel range={range} onRange={setRange} />
      <Holdings
        holdings={holdings}
        blocked={state.error ? 'The saved budget could not be read, so it cannot be changed' : busy}
        onAdd={() => setCoinPop({ kind: 'addCoin', pick: null })}
        onDelete={ticker => setCoinPop({ kind: 'deleteCoin', ticker, typed: '' })}
        boss={boss}
      />
      {!boss && <CategoryActions coin={coin} blocked={blocked} onStart={edit} />}
      {combined && state.book ? (
        view === 'history' ? (
          <BossHistoryTable boss={combined} />
        ) : (
          <BossTable data={combined} categories={snapshot(state.book.categories).categories} renamable={!blocked} onRename={rename} />
        )
      ) : view === 'history' && state.snapshot ? (
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
          renamable={!blocked}
          onRename={rename}
        />
      )}
      {!boss && <BudgetActions coin={coin} blocked={blocked ?? (coin ? null : 'Add a currency first')} onStart={edit} />}
      <Filters />
      {!boss && <CoinWheel coins={holdings.map(h => h.coin)} on={coin?.ticker ?? null} blocked={busy} onView={store.view} />}
      <BossButton
        blocked={state.error ?? busy ?? (holding < BOSS_MIN ? 'Two coins must each hold money outside Ready to Assign' : null)}
        on={boss}
        onToggle={() => setBossOn(!boss)}
      />
      <Corner
        snapshot={state.snapshot}
        coin={coin}
        view={view}
        blocked={state.error ?? busy}
        onSwap={() => setView(view === 'budget' ? 'history' : 'budget')}
        boss={combined}
      />
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
          holders={id => (state.book ? holders(state.book, id) : [])}
        />
      )}
      {coinPop && (
        <CoinPopup
          pop={coinPop}
          added={holdings.map(h => h.coin)}
          error={error}
          onChange={next => {
            setCoinPop(next)
            setError(null)
          }}
          onAdd={ticker => {
            // Adding a coin in the Boss View opens that coin's dashboard.
            const refused = store.add(ticker)
            if (!refused) setBossOn(false)
            coinDone(refused)
          }}
          onDelete={ticker => coinDone(store.remove(ticker))}
          onCancel={cancel}
        />
      )}
      <FailedPopup failures={prices.failures} />
    </main>
    </PricesContext.Provider>
  )
}

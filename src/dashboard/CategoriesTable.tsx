import { useEffect, useRef, useState } from 'react'
import { formatAmount } from '../ledger/amount'
import { fitFont } from './fit'
import { MAX_NAME_LENGTH, READY_TO_ASSIGN, type Category } from '../ledger/ledger'
import type { BookState } from '../useBook'
import { isChoosable, type Mode } from './categoryMode'
import { nameProblem } from './categoryRules'
import { placeholder } from './placeholder'
import { useDollars } from '../prices/prices'
import { sumDollars } from '../prices/money'
import type { BossData } from './boss'
import Usd from './Usd'

interface Props {
  budget: BookState
  mode: Mode | null
  onChoose: (category: Category) => void
  onName: (name: string) => void
  onSaveName: () => void
  /** Whether a held click may rename a category right now: only with no pop-up open. */
  renamable: boolean
  /** Renames a category in every coin. Returns null on success, or the reason it was refused. */
  onRename: (id: string, name: string) => string | null
}

/** How long a click must be held on a category name to rename it. */
export const HOLD_MS = 500

/** What a chosen row is labelled with while Move, Delete or Spend is open. */
function chosenAs(mode: Mode | null, id: string): string | null {
  if (mode?.kind === 'move') return mode.from === id ? 'from' : mode.to === id ? 'to' : null
  if (mode?.kind === 'spend') return mode.from === id ? 'from' : null
  if (mode?.kind === 'delete') return mode.id === id ? 'delete' : null
  return null
}

export default function CategoriesTable({ budget, mode, onChoose, onName, onSaveName, renamable, onRename }: Props) {
  const nameBox = useRef<HTMLInputElement>(null)
  const dollars = useDollars()
  const adding = mode?.kind === 'add'
  const { renaming, setRenaming, release, press } = useRename(renamable)

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
                      <td
                        className="cat"
                        onPointerDown={e => e.button === 0 && press(c)}
                        onPointerUp={release}
                        onPointerLeave={release}
                      >
                        {renaming === c.id && budget.snapshot ? (
                          <RenameBox
                            category={c}
                            categories={budget.snapshot.categories}
                            onSave={name => onRename(c.id, name)}
                            onDone={() => setRenaming(null)}
                          />
                        ) : (
                          c.name
                        )}
                        {c.id === READY_TO_ASSIGN && <small>deposits land here</small>}
                        {chosen ? <span className="tag">{chosen}</span> : choosable && <span className="pick">select</span>}
                      </td>
                      <td>{budget.coin ? <Usd value={dollars(c.balance, budget.coin.ticker)} /> : ''}</td>
                      <CoinCell text={budget.coin ? formatAmount(c.balance, budget.coin.decimals) : ''} negative={c.balance < 0n} />
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
                  <td>{budget.coin ? <Usd value={dollars(0n, budget.coin.ticker)} /> : ''}</td>
                  <td>{budget.coin ? 0 : ''}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="tfoot">
          <div className="c1">category</div>
          <div className="c2">USD</div>
          <div className="c3">{budget.coin?.ticker ?? 'Crypto'}</div>
        </div>
      </section>
      <MoreArrow />
    </>
  )
}

interface BossProps {
  data: BossData
  /** Every category, Ready to Assign included, so a rename cannot take another's name. */
  categories: readonly Category[]
  renamable: boolean
  onRename: (id: string, name: string) => string | null
}

/** The Boss View's budget: each category's total in dollars across every coin. Ready to Assign is not listed. */
export function BossTable({ data, categories, renamable, onRename }: BossProps) {
  const dollars = useDollars()
  const { renaming, setRenaming, release, press } = useRename(renamable)
  return (
    <>
      <section id="tableC" className="comp box" aria-label="Budget categories, every coin">
        <div id="tblScroll">
          <table className="bud boss">
            <tbody>
              {data.categories.map(c => (
                <tr key={c.id}>
                  <td className="cat" onPointerDown={e => e.button === 0 && press(c)} onPointerUp={release} onPointerLeave={release}>
                    {renaming === c.id ? (
                      <RenameBox category={c} categories={categories} onSave={name => onRename(c.id, name)} onDone={() => setRenaming(null)} />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td>
                    <Usd value={sumDollars(c.balances.map(b => dollars(b.units, b.ticker)))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tfoot">
          <div className="c1">category</div>
          <div className="c2 wide">USD</div>
        </div>
      </section>
      <MoreArrow />
    </>
  )
}

function MoreArrow() {
  return (
    <div id="tblArrowC" className="comp">
      <button className="arrow" aria-label="Show all categories" {...placeholder('Coming in a later stage')}>
        ↓<span className="lab">more</span>
      </button>
    </div>
  )
}

/** A click held on a category name opens it for renaming, but only while `renamable`. */
function useRename(renamable: boolean) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const hold = useRef<number | undefined>(undefined)
  const release = () => window.clearTimeout(hold.current)
  const press = (c: Category) => {
    release()
    if (renamable && c.id !== READY_TO_ASSIGN) hold.current = window.setTimeout(() => setRenaming(c.id), HOLD_MS)
  }
  useEffect(() => release, [])
  useEffect(() => {
    if (!renamable) setRenaming(null)
  }, [renamable])
  return { renaming, setRenaming, release, press }
}

interface RenameProps {
  category: Category
  categories: readonly Category[]
  onSave: (name: string) => string | null
  onDone: () => void
}

/** How many times the outline turns red, and how long each red and each bold phase lasts. */
const BLINKS = 2
const BLINK_MS = 160

/**
 * The name in place, in a box with a bold outline. Enter saves; Escape or a click elsewhere cancels. A blank name, or
 * another category's name (ignoring capitals), blinks the outline red twice and keeps the typed text.
 */
function RenameBox({ category, categories, onSave, onDone }: RenameProps) {
  const [name, setName] = useState(category.name)
  const [phase, setPhase] = useState(0)
  const box = useRef<HTMLInputElement>(null)

  useEffect(() => {
    box.current?.focus()
    box.current?.select()
  }, [])
  // phase counts down through red, bold, red, bold.
  useEffect(() => {
    if (phase === 0) return
    const timer = window.setTimeout(() => setPhase(phase - 1), BLINK_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  const save = () => {
    if (name.trim() === category.name) return onDone()
    const others = categories.filter(c => c.id !== category.id)
    if (nameProblem(name, others) || onSave(name)) setPhase(BLINKS * 2)
    else onDone()
  }

  return (
    <input
      ref={box}
      className={phase % 2 ? 'renameBox bad' : 'renameBox'}
      aria-label={`New name for ${category.name}`}
      value={name}
      maxLength={MAX_NAME_LENGTH}
      spellCheck={false}
      autoComplete="off"
      onChange={e => setName(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') save()
        if (e.key === 'Escape') onDone()
      }}
      onBlur={onDone}
    />
  )
}

/** A coin amount in the table, shrunk to fit when it is long. */
function CoinCell({ text, negative }: { text: string; negative: boolean }) {
  const size = fitFont(text, 20, 19)
  return (
    <td className={negative ? 'neg' : undefined} style={size ? { fontSize: size } : undefined}>
      {text}
    </td>
  )
}

import { useEffect, useRef } from 'react'
import { MAX_NAME_LENGTH, type Snapshot } from '../ledger/ledger'
import type { Mode, MoveField, MoveMode } from './categoryMode'
import { checkAmount, deleteMessage, nameProblem } from './categoryRules'

// The Add, Move and Delete pop-up. It is as wide as the categories table and sits just below it,
// over the wheel area, so nothing underneath has to move.

interface Props {
  snapshot: Snapshot
  mode: Mode
  ready: boolean
  /** Why the last Save was refused, if it was. */
  error: string | null
  onChange: (mode: Mode) => void
  onSave: () => void
  onCancel: () => void
}

const TITLES = { add: 'Add a category', move: 'Move XRP', delete: 'Delete a category' }

export default function CategoryPopup({ snapshot, mode, ready, error, onChange, onSave, onCancel }: Props) {
  const nameOf = (id?: string) => snapshot.categories.find(c => c.id === id)?.name

  return (
    <section id="popC" className={`comp box pop-${mode.kind}`} role="dialog" aria-label={TITLES[mode.kind]}>
      <div className="popTitle">{TITLES[mode.kind]}</div>
      {mode.kind === 'move' && (
        <MoveFields
          mode={mode}
          fromName={nameOf(mode.from)}
          toName={nameOf(mode.to)}
          problem={checkAmount(mode.amount, snapshot.categories.find(c => c.id === mode.from)).problem}
          ready={ready}
          onChange={onChange}
          onSave={onSave}
        />
      )}
      {mode.kind === 'delete' && (
        <div className="popGrid">
          <Field label="category" value={nameOf(mode.id)} active onFocus={() => {}} />
        </div>
      )}
      <div className="popFoot">
        <div className={error ? 'popNote err' : 'popNote'}>{error ?? note(mode, snapshot)}</div>
        <button type="button" className="pb" data-naming onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={ready ? 'pb main' : 'pb main dull'}
          data-naming
          aria-disabled={ready ? undefined : true}
          onClick={ready ? onSave : undefined}
        >
          {mode.kind === 'delete' ? 'Delete Category' : 'Save'}
        </button>
      </div>
    </section>
  )
}

/** The guidance line beside the buttons. */
function note(mode: Mode, snapshot: Snapshot): string {
  switch (mode.kind) {
    case 'add': {
      const problem = nameProblem(mode.name, snapshot.categories)
      if (problem === 'duplicate') return 'A category with that name already exists.'
      return `Name the new category (up to ${MAX_NAME_LENGTH} characters). Enter saves, Escape cancels.`
    }
    case 'move': {
      if (mode.active === 'from') return 'Select the category to move XRP from.'
      if (mode.active === 'to') return 'Select the category to move XRP to.'
      const from = snapshot.categories.find(c => c.id === mode.from)
      return checkAmount(mode.amount, from).problem || 'Type the amount of XRP to move.'
    }
    case 'delete': {
      const category = snapshot.categories.find(c => c.id === mode.id)
      return category ? deleteMessage(category) : 'Select the category to delete.'
    }
  }
}

interface MoveProps {
  mode: MoveMode
  fromName?: string
  toName?: string
  problem?: string
  ready: boolean
  onChange: (mode: Mode) => void
  onSave: () => void
}

function MoveFields({ mode, fromName, toName, problem, ready, onChange, onSave }: MoveProps) {
  const amountBox = useRef<HTMLInputElement>(null)
  const activate = (active: MoveField) => mode.active !== active && onChange({ ...mode, active })

  // When the emphasis reaches the amount, so does the typing focus.
  useEffect(() => {
    if (mode.active === 'amount') amountBox.current?.focus()
  }, [mode.active])

  return (
    <div className="popGrid">
      <Field label="from" value={fromName} active={mode.active === 'from'} onFocus={() => activate('from')} />
      <label className={`fld num amt${mode.active === 'amount' ? ' on' : ''}${problem ? ' bad' : ''}`}>
        <input
          ref={amountBox}
          aria-label="XRP to move"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={mode.amount}
          onFocus={() => activate('amount')}
          onChange={e => onChange({ ...mode, amount: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && ready && onSave()}
        />
      </label>
      <div className="fld num usd" aria-label="US dollars (not available yet)" title="USD prices are not part of version 1">
        $0.00
      </div>
      <Field label="to" value={toName} active={mode.active === 'to'} onFocus={() => activate('to')} />
    </div>
  )
}

function Field({ label, value, active, onFocus }: { label: string; value?: string; active: boolean; onFocus: () => void }) {
  return (
    <button type="button" className={active ? 'fld on' : 'fld'} onClick={onFocus}>
      <span className="lab">{label}</span>
      {value ?? <span className="muted">select a category</span>}
    </button>
  )
}

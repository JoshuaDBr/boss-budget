import { useEffect, useRef } from 'react'
import type { Snapshot } from '../ledger/ledger'
import type { DepositMode, Mode, MoveField, MoveMode, SpendMode } from './categoryMode'
import { checkAmount, deleteMessage, nameProblem } from './categoryRules'

// The Add, Move, Delete, Deposit and Spend pop-up. It is as wide as the categories table and sits just below it,
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

const LABELS = { add: 'Add a category', move: 'Move XRP', delete: 'Delete a category', deposit: 'Deposit XRP', spend: 'Spend XRP' }

/** The pop-ups that show their name as a title. */
const TITLED = new Set<Mode['kind']>(['add', 'deposit', 'spend'])

export default function CategoryPopup({ snapshot, mode, ready, error, onChange, onSave, onCancel }: Props) {
  const nameOf = (id?: string) => snapshot.categories.find(c => c.id === id)?.name

  return (
    <section id="popC" className={`comp box pop-${mode.kind}`} role="dialog" aria-label={LABELS[mode.kind]}>
      {TITLED.has(mode.kind) && <div className="popTitle">{LABELS[mode.kind]}</div>}
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
      {(mode.kind === 'deposit' || mode.kind === 'spend') && (
        <MoneyFields
          mode={mode}
          fromName={mode.kind === 'spend' ? nameOf(mode.from) : undefined}
          problem={mode.kind === 'spend' ? checkAmount(mode.amount, snapshot.categories.find(c => c.id === mode.from)).problem : undefined}
          ready={ready}
          onChange={onChange}
          onSave={onSave}
        />
      )}
      {mode.kind === 'delete' && (
        <div className="popGrid">
          <Field label="Category" value={nameOf(mode.id)} active onFocus={() => {}} />
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

/**
 * The line beside the buttons. It only speaks up for a duplicate name, a move or spend larger than the
 * From balance, and the delete confirmation; otherwise it is empty.
 */
function note(mode: Mode, snapshot: Snapshot): string {
  switch (mode.kind) {
    case 'add':
      return nameProblem(mode.name, snapshot.categories) === 'duplicate' ? 'A category with that name already exists.' : ''
    case 'deposit':
      return ''
    case 'move':
    case 'spend':
      return checkAmount(mode.amount, snapshot.categories.find(c => c.id === mode.from)).problem ?? ''
    case 'delete': {
      const category = snapshot.categories.find(c => c.id === mode.id)
      return category ? deleteMessage(category) : ''
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
      <Field label="From" value={fromName} active={mode.active === 'from'} onFocus={() => activate('from')} />
      <div className="fld num usd" aria-label="US dollars (not available yet)">
        $0.00
      </div>
      <label className={`fld num amt${mode.active === 'amount' ? ' on' : ''}${problem ? ' bad' : ''}`}>
        <input
          ref={amountBox}
          aria-label="XRP to move"
          inputMode="decimal"
          autoComplete="off"
          value={mode.amount}
          onFocus={() => activate('amount')}
          onChange={e => onChange({ ...mode, amount: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && ready && onSave()}
        />
      </label>
      <Field label="To" value={toName} active={mode.active === 'to'} onFocus={() => activate('to')} />
    </div>
  )
}

interface MoneyProps {
  mode: DepositMode | SpendMode
  fromName?: string
  problem?: string
  ready: boolean
  onChange: (mode: Mode) => void
  onSave: () => void
}

/**
 * Spend: From, USD and XRP, then Note and Date. Deposit: USD and XRP (under their columns), then Note and Date.
 * Note and Date are placeholders in this stage and cannot be used yet.
 */
function MoneyFields({ mode, fromName, problem, ready, onChange, onSave }: MoneyProps) {
  const amountBox = useRef<HTMLInputElement>(null)
  const amountActive = mode.kind === 'deposit' || mode.active === 'amount'

  // A deposit opens with the cursor in the amount; a spend moves it there once From is chosen.
  useEffect(() => {
    if (amountActive) amountBox.current?.focus()
  }, [amountActive])

  return (
    <div className="popGrid">
      {mode.kind === 'spend' ? (
        <Field label="From" value={fromName} active={mode.active === 'from'} onFocus={() => onChange({ ...mode, active: 'from' })} />
      ) : (
        <div />
      )}
      <div className="fld num usd" aria-label="US dollars (not available yet)">
        $0.00
      </div>
      <label className={`fld num amt${amountActive ? ' on' : ''}${problem ? ' bad' : ''}`}>
        <input
          ref={amountBox}
          aria-label={mode.kind === 'deposit' ? 'XRP to deposit' : 'XRP to spend'}
          inputMode="decimal"
          autoComplete="off"
          value={mode.amount}
          onFocus={() => mode.kind === 'spend' && mode.active !== 'amount' && onChange({ ...mode, active: 'amount' })}
          onChange={e => onChange({ ...mode, amount: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && ready && onSave()}
        />
      </label>
      <Placeholder label="Note" />
      <Placeholder label="Date" wide />
    </div>
  )
}

function Placeholder({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div className={wide ? 'fld ph wide' : 'fld ph'} aria-disabled="true" aria-label={`${label} (not available yet)`}>
      <span className="lab">{label}</span>
    </div>
  )
}

function Field({ label, value, active, onFocus }: { label: string; value?: string; active: boolean; onFocus: () => void }) {
  return (
    <button type="button" className={active ? 'fld on' : 'fld'} onClick={onFocus}>
      <span className="lab">{label}</span>
      {value}
    </button>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatDateDigits } from '../ledger/dates'
import { formatXmr, formatXmrShort, parseXmr } from '../ledger/piconero'
import { MAX_NOTE_LENGTH, type Category, type Snapshot } from '../ledger/ledger'
import { editableFrom, entryDate, type EditMode, type EntryMode, type Mode, type MoveField, type MoveMode, type SpendField, type SpendMode } from './categoryMode'
import { checkAmount, deleteMessage, nameProblem } from './categoryRules'

// The Add, Move, Delete, Deposit, Spend and Edit pop-up. It is as wide as the categories table and sits just below it,
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
  /** Yes on a confirmation. */
  onConfirm: () => void
}

const LABELS = { add: 'Add a category', move: 'Move XMR', delete: 'Delete a category', deposit: 'Deposit XMR', spend: 'Spend XMR' }

/** The pop-ups that show their name as a title. */
const TITLED = new Set<Mode['kind']>(['add', 'deposit', 'spend', 'edit'])

const label = (mode: Mode) => (mode.kind === 'edit' ? (mode.spend ? 'Edit spend' : 'Edit deposit') : LABELS[mode.kind])

export default function CategoryPopup({ snapshot, mode, ready, error, onChange, onSave, onCancel, onConfirm }: Props) {
  const nameOf = (id?: string) => snapshot.categories.find(c => c.id === id)?.name
  const entry = mode.kind === 'deposit' || mode.kind === 'spend' || mode.kind === 'edit' ? mode : null
  const asking = entry?.confirm !== undefined && entry.confirm

  return (
    <section id="popC" className={`comp box pop-${mode.kind}`} role="dialog" aria-label={label(mode)}>
      {TITLED.has(mode.kind) && <div className="popTitle">{label(mode)}</div>}
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
      {entry && asking && <Question mode={entry} amount={confirmedAmount(entry, snapshot)} />}
      {entry && !asking && (
        <EntryFields
          mode={entry}
          snapshot={snapshot}
          problem={entry.kind === 'spend' ? checkAmount(entry.amount, snapshot.categories.find(c => c.id === entry.from)).problem : undefined}
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
        {mode.kind === 'edit' && !asking && (
          <button type="button" className="pb del" onClick={() => onChange({ ...mode, confirm: 'delete', listOpen: false })}>
            Delete
          </button>
        )}
        <div className={error ? 'popNote err' : 'popNote'}>{error ?? (asking ? '' : note(mode, snapshot))}</div>
        {entry && asking ? (
          <>
            <button type="button" className="pb" onClick={() => onChange({ ...entry, confirm: undefined })}>
              No
            </button>
            <button type="button" className="pb main" onClick={onConfirm}>
              Yes
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </section>
  )
}

/** The amount a confirmation names: the typed amount for Save, and the recorded amount for Delete. */
function confirmedAmount(mode: EntryMode, snapshot: Snapshot): bigint {
  if (mode.kind === 'edit' && mode.confirm === 'delete') return snapshot.transactions.find(t => t.id === mode.id)?.amount ?? 0n
  return parseXmr(mode.amount) ?? 0n
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
    case 'edit':
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
  const activate = (active: MoveField) => mode.active !== active && onChange({ ...mode, active })

  return (
    <div className="popGrid">
      <Field label="From" value={fromName} active={mode.active === 'from'} onFocus={() => activate('from')} />
      <div className="fld num usd" aria-label="US dollars (not available yet)">
        $-,--
      </div>
      <AmountBox
        label="XMR to move"
        value={mode.amount}
        active={mode.active === 'amount'}
        problem={problem}
        onActivate={() => activate('amount')}
        onChange={amount => onChange({ ...mode, amount })}
        onEnter={() => ready && onSave()}
      />
      <Field label="To" value={toName} active={mode.active === 'to'} onFocus={() => activate('to')} />
    </div>
  )
}

interface EntryProps {
  mode: EntryMode
  snapshot: Snapshot
  problem?: string
  ready: boolean
  onChange: (mode: Mode) => void
  onSave: () => void
}

/**
 * Spend and Edit spend: From, USD and XMR, then Note and Date. Deposit and Edit deposit: USD and XMR (under their columns),
 * then Note and Date.
 */
function EntryFields({ mode, snapshot, problem, ready, onChange, onSave }: EntryProps) {
  // Moving to another field closes Edit spend's From list.
  const activate = (active: SpendField) =>
    mode.active !== active && onChange({ ...mode, active, ...(mode.kind === 'edit' && { listOpen: false }) } as Mode)
  const enter = () => ready && onSave()
  const hasFrom = mode.kind === 'spend' || (mode.kind === 'edit' && mode.spend)

  return (
    <div className="popGrid">
      {mode.kind === 'edit' && mode.spend ? (
        <FromList mode={mode} categories={snapshot.categories} onChange={onChange} />
      ) : hasFrom ? (
        <Field
          label="From"
          value={snapshot.categories.find(c => c.id === (mode as SpendMode).from)?.name}
          active={mode.active === 'from'}
          onFocus={() => activate('from')}
        />
      ) : (
        <div />
      )}
      <div className="fld num usd" aria-label="US dollars (not available yet)">
        $-,--
      </div>
      <AmountBox
        label={`XMR to ${mode.kind === 'edit' ? (mode.spend ? 'spend' : 'deposit') : mode.kind}`}
        value={mode.amount}
        active={mode.active === 'amount'}
        problem={problem}
        onActivate={() => activate('amount')}
        onChange={amount => onChange({ ...mode, amount })}
        onEnter={enter}
      />
      <NoteBox
        value={mode.note}
        active={mode.active === 'note'}
        onActivate={() => activate('note')}
        onChange={note => onChange({ ...mode, note })}
        onEnter={enter}
      />
      <DateBox
        digits={mode.date}
        active={mode.active === 'date'}
        onActivate={() => activate('date')}
        onChange={date => onChange({ ...mode, date })}
        onEnter={enter}
      />
    </div>
  )
}

/**
 * Edit spend's From box. Clicking it opens a list under it of every category except Ready to Assign, each with its
 * dollar amount and its XMR to four decimal places, cut. A spend whose category was deleted shows "Unassigned" in red.
 */
function FromList({ mode, categories, onChange }: { mode: EditMode; categories: readonly Category[]; onChange: (mode: Mode) => void }) {
  const from = categories.find(c => c.id === mode.from)
  const choices = editableFrom(categories)

  return (
    <div className="fromWrap">
      <button
        type="button"
        className={`fld${mode.active === 'from' ? ' on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={mode.listOpen}
        onClick={() => onChange({ ...mode, active: 'from', listOpen: !mode.listOpen })}
      >
        <span className="lab">From</span>
        {from ? from.name : <span className="unassigned">Unassigned</span>}
      </button>
      {mode.listOpen && (
        <ul className="fromList" role="listbox" aria-label="From">
          {choices.map(c => (
            <li key={c.id} role="option" aria-selected={c.id === mode.from}>
              <button type="button" onClick={() => onChange({ ...mode, from: c.id, listOpen: false, active: 'amount' })}>
                <span className="cat">{c.name}</span>
                <span className="usd">$-,--</span>
                <span className={c.balance < 0n ? 'xmr neg' : 'xmr'}>{formatXmrShort(c.balance)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface TextProps {
  active: boolean
  onActivate: () => void
  onEnter: () => void
}

/** The optional note, up to 30 characters. */
function NoteBox({ value, active, onActivate, onChange, onEnter }: TextProps & { value: string; onChange: (note: string) => void }) {
  return (
    <label className={active ? 'fld on' : 'fld'}>
      <span className="lab">Note</span>
      <input
        value={value}
        maxLength={MAX_NOTE_LENGTH}
        autoComplete="off"
        onFocus={onActivate}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter()}
      />
    </label>
  )
}

/**
 * The date, mm/dd/yyyy. The slashes stay in their places and only digits can be typed; anything else is rejected.
 * A date that is not real, or is after today, shows in red and keeps Save dull.
 */
function DateBox({ digits, active, onActivate, onChange, onEnter }: TextProps & { digits: string; onChange: (digits: string) => void }) {
  const box = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const shown = formatDateDigits(digits)
  const bad = digits.length === 8 && entryDate(digits) === null

  // After the slashes are put back, the cursor goes after the same number of digits as before.
  useLayoutEffect(() => {
    if (caret.current === null || !box.current) return
    let position = 0
    for (let seen = 0; position < shown.length && seen < caret.current; position++) if (shown[position] !== '/') seen++
    box.current.setSelectionRange(position, position)
    caret.current = null
  })

  return (
    <label className={`fld wide${active ? ' on' : ''}${bad ? ' bad' : ''}`}>
      <span className="lab">Date</span>
      <input
        ref={box}
        value={shown}
        inputMode="numeric"
        autoComplete="off"
        onFocus={onActivate}
        onChange={e => {
          const typed = e.target.value
          const before = typed.slice(0, e.target.selectionStart ?? typed.length).replace(/\D/g, '').length
          caret.current = Math.min(before, 8)
          onChange(typed.replace(/\D/g, '').slice(0, 8))
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') onEnter()
          // Backspace just after a slash deletes the digit before it.
          const input = e.currentTarget
          const at = input.selectionStart ?? 0
          if (e.key === 'Backspace' && at === input.selectionEnd && shown[at - 1] === '/') input.setSelectionRange(at - 1, at - 1)
        }}
      />
    </label>
  )
}

/** Style A: the question replaces the fields, and the pop-up keeps its title. */
function Question({ mode, amount }: { mode: EntryMode; amount: bigint }) {
  const verb = mode.kind === 'edit' ? (mode.spend ? 'spend' : 'deposit') : mode.kind
  const xmr = <strong>{formatXmr(amount)} XMR</strong>
  return (
    <div className="question">
      {mode.confirm === 'delete' ? (
        <>
          Delete this {verb} of {xmr}?
        </>
      ) : (
        <>
          Did you {verb} precisely {xmr}?
        </>
      )}
    </div>
  )
}

interface AmountProps {
  label: string
  value: string
  active: boolean
  problem?: string
  onActivate: () => void
  onChange: (value: string) => void
  onEnter: () => void
}

/**
 * The XMR amount. The box in the row shows four decimal places, cut. Typing happens in a full box laid over the
 * entry line, which opens whenever the amount gets the cursor and shows all twelve. On leaving it, a valid amount is
 * written out to twelve places, so digits past the fourth read as zeros until changed.
 */
function AmountBox({ label, value, active, problem, onActivate, onChange, onEnter }: AmountProps) {
  const [open, setOpen] = useState(active)
  const fullBox = useRef<HTMLInputElement>(null)
  const piconero = parseXmr(value)

  // When the emphasis reaches the amount, the full box opens with the cursor in it.
  useEffect(() => {
    if (active) setOpen(true)
  }, [active])
  useEffect(() => {
    if (open) fullBox.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    if (piconero !== null) onChange(formatXmr(piconero))
  }

  return (
    <>
      <button
        type="button"
        className={`fld num amt${active ? ' on' : ''}${problem ? ' bad' : ''}`}
        aria-label={label}
        onClick={() => {
          onActivate()
          setOpen(true)
        }}
      >
        {piconero === null ? value : formatXmrShort(piconero)}
      </button>
      {open && active && (
        <label className={problem ? 'fullAmt bad' : 'fullAmt'}>
          <input
            ref={fullBox}
            aria-label={label}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={close}
            onKeyDown={e => e.key === 'Enter' && onEnter()}
          />
        </label>
      )}
    </>
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

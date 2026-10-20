import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { formatDateDigits } from '../ledger/dates'
import { formatAmount, formatShort, isAmountDraft, parseAmount } from '../ledger/amount'
import type { Coin } from '../ledger/coins'
import type { Category, Snapshot } from '../ledger/ledger'
import { answerAfterTab, editableFrom, entryDate, nextField, type EditMode, type EntryMode, type Mode, type MoveField, type MoveMode, type SpendField, type SpendMode } from './categoryMode'
import { capNote, checkAmount, deleteMessage, nameProblem } from './categoryRules'
import { useDollars } from '../prices/prices'
import Usd, { FittedUsd } from './Usd'

/** The dollar box: the typed coin amount at today's price. An empty amount is $0.00; one still being typed, $-,--. */
function typedDollars(amount: string, coin: Coin, dollars: ReturnType<typeof useDollars>) {
  const units = amount.trim() === '' ? 0n : parseAmount(amount, coin.decimals)
  return units === null ? null : dollars(units, coin.ticker)
}

// The Add, Move, Delete, Deposit, Spend and Edit pop-up. It is as wide as the categories table and sits just below it,
// over the wheel area, so nothing underneath has to move.

interface Props {
  snapshot: Snapshot
  /** The coin on screen. Deposit, Spend, Move and the edits only open while there is one. */
  coin: Coin | null
  mode: Mode
  ready: boolean
  /** Why the last Save was refused, if it was. */
  error: string | null
  onChange: (mode: Mode) => void
  onSave: () => void
  onCancel: () => void
  /** Yes on a confirmation. */
  onConfirm: () => void
  /** The coins in which a category holds a balance, for the Delete a category warning (see holders). */
  holders: (id: string) => string[]
}

const LABELS = { add: 'Add a category', move: 'Move', delete: 'Delete a category', deposit: 'Deposit', spend: 'Spend' }

/** The pop-ups that show their name as a title. */
const TITLED = new Set<Mode['kind']>(['add', 'deposit', 'spend', 'edit'])

/** The pop-up's name. Move, Deposit and Spend name the coin on screen ("Deposit BTC"). */
function label(mode: Mode, coin: Coin | null) {
  if (mode.kind === 'edit') return mode.spend ? 'Edit spend' : 'Edit deposit'
  const name = LABELS[mode.kind]
  return coin && (mode.kind === 'move' || mode.kind === 'deposit' || mode.kind === 'spend') ? `${name} ${coin.ticker}` : name
}

export default function CategoryPopup({ snapshot, coin, mode, ready, error, onChange, onSave, onCancel, onConfirm, holders }: Props) {
  const nameOf = (id?: string) => snapshot.categories.find(c => c.id === id)?.name
  const entry = mode.kind === 'deposit' || mode.kind === 'spend' || mode.kind === 'edit' ? mode : null
  const asking = entry?.confirm !== undefined && entry.confirm
  const yes = useRef<HTMLButtonElement>(null)
  const no = useRef<HTMLButtonElement>(null)

  // A confirmation opens with the cursor on Yes, so Enter answers it and Escape (like Cancel) backs out.
  useEffect(() => {
    if (asking) yes.current?.focus()
  }, [asking])

  // Tab and Shift+Tab step through the fields. Leaving the amount writes it out to every decimal place, as clicking away does.
  // On a confirmation they go between No and Yes.
  const tab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    if (asking) {
      e.preventDefault()
      const on = document.activeElement === yes.current ? 'yes' : document.activeElement === no.current ? 'no' : null
      ;(answerAfterTab(on, e.shiftKey) === 'yes' ? yes : no).current?.focus()
      return
    }
    const next = nextField(mode, e.shiftKey)
    if (next === mode) return
    e.preventDefault()
    const units = coin && 'amount' in next ? parseAmount(next.amount, coin.decimals) : null
    onChange(units === null || !coin ? next : ({ ...next, amount: formatAmount(units, coin.decimals) } as Mode))
  }

  return (
    <section id="popC" className={`comp box pop-${mode.kind}`} role="dialog" aria-label={label(mode, coin)} onKeyDown={tab}>
      {TITLED.has(mode.kind) && <div className="popTitle">{label(mode, coin)}</div>}
      {mode.kind === 'move' && coin && (
        <MoveFields
          mode={mode}
          coin={coin}
          fromName={nameOf(mode.from)}
          toName={nameOf(mode.to)}
          problem={checkAmount(mode.amount, coin, snapshot.categories.find(c => c.id === mode.from)).problem}
          ready={ready}
          onChange={onChange}
          onSave={onSave}
        />
      )}
      {entry && coin && asking && <Question mode={entry} coin={coin} amount={confirmedAmount(entry, snapshot, coin)} />}
      {entry && coin && !asking && (
        <EntryFields
          mode={entry}
          coin={coin}
          snapshot={snapshot}
          problem={entry.kind === 'spend' ? checkAmount(entry.amount, coin, snapshot.categories.find(c => c.id === entry.from)).problem : undefined}
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
        <div className={error ? 'popNote err' : 'popNote'}>{error ?? (asking ? '' : note(mode, snapshot, coin, holders))}</div>
        {entry && asking ? (
          <>
            <button ref={no} type="button" className="pb" onClick={() => onChange({ ...entry, confirm: undefined })}>
              No
            </button>
            <button ref={yes} type="button" className="pb main" onClick={onConfirm}>
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
function confirmedAmount(mode: EntryMode, snapshot: Snapshot, coin: Coin): bigint {
  if (mode.kind === 'edit' && mode.confirm === 'delete') return snapshot.transactions.find(t => t.id === mode.id)?.amount ?? 0n
  return parseAmount(mode.amount, coin.decimals) ?? 0n
}

/**
 * The line beside the buttons. It only speaks up for a duplicate name, a move or spend larger than the
 * From balance, and the delete confirmation; otherwise it is empty.
 */
function note(mode: Mode, snapshot: Snapshot, coin: Coin | null, holders: (id: string) => string[]): string {
  switch (mode.kind) {
    case 'add':
      return nameProblem(mode.name, snapshot.categories) === 'duplicate' ? 'A category with that name already exists.' : ''
    case 'deposit':
    case 'edit':
      return ''
    case 'move':
    case 'spend':
      return coin ? (checkAmount(mode.amount, coin, snapshot.categories.find(c => c.id === mode.from)).problem ?? '') : ''
    case 'delete': {
      const category = snapshot.categories.find(c => c.id === mode.id)
      return category ? deleteMessage(category.name, holders(category.id)) : ''
    }
  }
}

interface MoveProps {
  mode: MoveMode
  coin: Coin
  fromName?: string
  toName?: string
  problem?: string
  ready: boolean
  onChange: (mode: Mode) => void
  onSave: () => void
}

function MoveFields({ mode, coin, fromName, toName, problem, ready, onChange, onSave }: MoveProps) {
  const dollars = useDollars()
  const activate = (active: MoveField) => mode.active !== active && onChange({ ...mode, active })

  return (
    <div className="popGrid">
      <Field label="From" value={fromName} active={mode.active === 'from'} onFocus={() => activate('from')} />
      <div className="fld num usd" aria-label="US dollars">
        <FittedUsd value={typedDollars(mode.amount, coin, dollars)} />
      </div>
      <AmountBox
        label={`${coin.ticker} to move`}
        coin={coin}
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
  coin: Coin
  snapshot: Snapshot
  problem?: string
  ready: boolean
  onChange: (mode: Mode) => void
  onSave: () => void
}

/**
 * Spend and Edit spend: From, USD and the coin, then Note and Date. Deposit and Edit deposit: USD and the coin (under their columns),
 * then Note and Date.
 */
function EntryFields({ mode, coin, snapshot, problem, ready, onChange, onSave }: EntryProps) {
  const dollars = useDollars()
  // Moving to another field closes Edit spend's From list.
  const activate = (active: SpendField) =>
    mode.active !== active && onChange({ ...mode, active, ...(mode.kind === 'edit' && { listOpen: false }) } as Mode)
  const enter = () => ready && onSave()
  const hasFrom = mode.kind === 'spend' || (mode.kind === 'edit' && mode.spend)

  return (
    <div className="popGrid">
      {mode.kind === 'edit' && mode.spend ? (
        <FromList mode={mode} coin={coin} categories={snapshot.categories} onChange={onChange} />
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
      <div className="fld num usd" aria-label="US dollars">
        <FittedUsd value={typedDollars(mode.amount, coin, dollars)} />
      </div>
      <AmountBox
        label={`${coin.ticker} to ${mode.kind === 'edit' ? (mode.spend ? 'spend' : 'deposit') : mode.kind}`}
        coin={coin}
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
 * dollar amount and its amount in the coin to six decimal places, cut. A spend whose category was deleted shows "Unassigned" in red.
 */
function FromList({ mode, coin, categories, onChange }: { mode: EditMode; coin: Coin; categories: readonly Category[]; onChange: (mode: Mode) => void }) {
  const dollars = useDollars()
  const from = categories.find(c => c.id === mode.from)
  const choices = editableFrom(categories)
  const box = useFocusWhen(mode.active === 'from')

  return (
    <div className="fromWrap">
      <button
        ref={box}
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
                <span className="usd"><Usd value={dollars(c.balance, coin.ticker)} /></span>
                <span className={c.balance < 0n ? 'amt neg' : 'amt'}>{formatShort(c.balance, coin.decimals)}</span>
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

/** The optional note, up to 30 characters, counted as the ledger counts them (see capNote). */
/**
 * Enter in a field saves. Its key press is cancelled: Save may open a confirmation and move the cursor to Yes, and the
 * same press must not then reach Yes and answer it.
 */
function pressEnter(e: KeyboardEvent, onEnter: () => void) {
  e.preventDefault()
  onEnter()
}

function NoteBox({ value, active, onActivate, onChange, onEnter }: TextProps & { value: string; onChange: (note: string) => void }) {
  const box = useFocusWhen<HTMLInputElement>(active)
  return (
    <label className={active ? 'fld on' : 'fld'}>
      <span className="lab">Note</span>
      <input
        ref={box}
        value={value}
        autoComplete="off"
        onFocus={onActivate}
        onChange={e => onChange(capNote(e.target.value, value))}
        onKeyDown={e => e.key === 'Enter' && pressEnter(e, onEnter)}
      />
    </label>
  )
}

/**
 * The date, mm/dd/yyyy. The slashes stay in their places and only digits can be typed; anything else is rejected.
 * A date that is not real, or is after today, shows in red and keeps Save dull.
 */
function DateBox({ digits, active, onActivate, onChange, onEnter }: TextProps & { digits: string; onChange: (digits: string) => void }) {
  const box = useFocusWhen<HTMLInputElement>(active)
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
          if (e.key === 'Enter') pressEnter(e, onEnter)
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
function Question({ mode, coin, amount }: { mode: EntryMode; coin: Coin; amount: bigint }) {
  const verb = mode.kind === 'edit' ? (mode.spend ? 'spend' : 'deposit') : mode.kind
  const shown = <strong>{formatAmount(amount, coin.decimals)} {coin.ticker}</strong>
  return (
    <div className="question">
      {mode.confirm === 'delete' ? (
        <>
          Delete this {verb} of {shown}?
        </>
      ) : (
        <>
          Did you {verb} precisely {shown}?
        </>
      )}
    </div>
  )
}

interface AmountProps {
  label: string
  coin: Coin
  value: string
  active: boolean
  problem?: string
  onActivate: () => void
  onChange: (value: string) => void
  onEnter: () => void
}

/**
 * The amount, in the coin on screen, typed straight into the row's box. It shows every place the coin has; an amount
 * too long for the box scrolls inside it, like any text box. On leaving it, a valid amount is written out to every
 * place, so digits past those typed read as zeros until changed.
 */
function AmountBox({ label, coin, value, active, problem, onActivate, onChange, onEnter }: AmountProps) {
  const box = useFocusWhen<HTMLInputElement>(active)
  const units = parseAmount(value, coin.decimals)
  return (
    <label className={`fld num amt${active ? ' on' : ''}${problem ? ' bad' : ''}`}>
      <input
        ref={box}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onFocus={() => !active && onActivate()}
        onChange={e => isAmountDraft(e.target.value, coin.decimals) && onChange(e.target.value)}
        onBlur={() => units !== null && onChange(formatAmount(units, coin.decimals))}
        onKeyDown={e => e.key === 'Enter' && pressEnter(e, onEnter)}
      />
    </label>
  )
}

function Field({ label, value, active, onFocus }: { label: string; value?: string; active: boolean; onFocus: () => void }) {
  const box = useFocusWhen(active)
  return (
    <button ref={box} type="button" className={active ? 'fld on' : 'fld'} onClick={onFocus}>
      <span className="lab">{label}</span>
      {value}
    </button>
  )
}

/** A ref that puts the cursor in its element whenever the field gets the emphasis, so typing and Tab start there. */
function useFocusWhen<T extends HTMLElement = HTMLButtonElement>(active: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (active) ref.current?.focus()
  }, [active])
  return ref
}

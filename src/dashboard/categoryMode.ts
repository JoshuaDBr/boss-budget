import { digitsToIso, isoToDigits, todayIso } from '../ledger/dates'
import {
  addCategory,
  deleteCategory,
  deleteTransaction,
  deposit,
  editTransaction,
  move,
  spend,
  type Budget,
  type Category,
  type Transaction,
} from '../ledger/ledger'
import { canDelete, canMoveFrom, canMoveTo, canSpendFrom, checkAmount, nameProblem } from './categoryRules'

// Which pop-up is open (Add, Move, Delete, Deposit, Spend or an edit), and what has been filled in so far. Nothing here
// touches the ledger; the ledger only changes when Save (or Delete Category), or Yes on a confirmation, is pressed.

export type MoveField = 'from' | 'to' | 'amount'
export type SpendField = 'from' | 'amount' | 'note' | 'date'
export type DepositField = Exclude<SpendField, 'from'>

/** What a deposit, spend or edit pop-up holds besides its amount. The date is the digits typed so far, "mmddyyyy". */
interface Entry {
  amount: string
  note: string
  date: string
  /** Which question has replaced the fields: the Save confirmation, or (edits only) the Delete confirmation. */
  confirm?: 'save' | 'delete'
}

export type Mode =
  | { kind: 'add'; name: string }
  | { kind: 'move'; from?: string; to?: string; amount: string; active: MoveField }
  | { kind: 'delete'; id?: string }
  | ({ kind: 'deposit'; active: DepositField } & Entry)
  | ({ kind: 'spend'; from?: string; active: SpendField } & Entry)
  /** Editing a past deposit (no From) or spend. \`listOpen\` is the From list, which opens under the From box. */
  | ({ kind: 'edit'; id: string; spend: boolean; from?: string; active: SpendField | null; listOpen: boolean } & Entry)

export type AddMode = Extract<Mode, { kind: 'add' }>
export type MoveMode = Extract<Mode, { kind: 'move' }>
export type DeleteMode = Extract<Mode, { kind: 'delete' }>
export type DepositMode = Extract<Mode, { kind: 'deposit' }>
export type SpendMode = Extract<Mode, { kind: 'spend' }>
export type EditMode = Extract<Mode, { kind: 'edit' }>
export type EntryMode = DepositMode | SpendMode | EditMode

const blankEntry = () => ({ amount: '', note: '', date: isoToDigits(todayIso()) })

export const startAdd = (): AddMode => ({ kind: 'add', name: '' })
export const startMove = (): MoveMode => ({ kind: 'move', amount: '', active: 'from' })
export const startDelete = (): DeleteMode => ({ kind: 'delete' })
export const startDeposit = (): DepositMode => ({ kind: 'deposit', active: 'amount', ...blankEntry() })
export const startSpend = (): SpendMode => ({ kind: 'spend', active: 'from', ...blankEntry() })

/** Opens a past transaction for editing, filled with its current values. Nothing starts with the emphasis. */
export const startEdit = (t: Transaction, amount: string): EditMode => ({
  kind: 'edit',
  id: t.id,
  spend: t.kind === 'spend',
  from: t.from,
  amount,
  note: t.note,
  date: isoToDigits(t.date),
  active: null,
  listOpen: false,
})

/** The order Tab walks through each pop-up's fields, top left to bottom right. */
function fieldOrder(mode: MoveMode | EntryMode): readonly (MoveField | SpendField)[] {
  if (mode.kind === 'move') return ['from', 'amount', 'to']
  if (mode.kind === 'spend' || (mode.kind === 'edit' && mode.spend)) return ['from', 'amount', 'note', 'date']
  return ['amount', 'note', 'date']
}

/**
 * Tab (or Shift+Tab, with `back`) passes the emphasis to the next (or previous) field, wrapping round at the ends.
 * An edit, which starts with nothing emphasized, goes to its first (or last) field. Add, Delete and an open
 * confirmation stay as they are.
 */
export function nextField(mode: Mode, back = false): Mode {
  if (mode.kind === 'add' || mode.kind === 'delete' || (mode.kind !== 'move' && mode.confirm)) return mode
  const order = fieldOrder(mode)
  const at = mode.active === null ? (back ? 0 : -1) : order.indexOf(mode.active)
  const active = order[(at + (back ? -1 : 1) + order.length) % order.length]
  return { ...mode, active, ...(mode.kind === 'edit' && { listOpen: false }) } as Mode
}

/** Whether clicking this category's row would choose it right now (and so whether it shows a "select" marker). */
export function isChoosable(mode: Mode | null, category: Category): boolean {
  if (mode?.kind === 'delete') return canDelete(category)
  if (mode?.kind === 'spend') return mode.active === 'from' && canSpendFrom(category)
  if (mode?.kind !== 'move') return false
  if (mode.active === 'from') return canMoveFrom(category, mode.to)
  if (mode.active === 'to') return canMoveTo(category, mode.from)
  return false
}

/**
 * Chooses a category for the active field. Move then passes the emphasis on:
 * From goes to To (or to the amount if To is already chosen), and To goes to the amount
 * (or back to From if From is still empty). Spend goes from From to the amount. Clicking a category that is not choosable does nothing.
 */
export function choose(mode: Mode, category: Category): Mode {
  if (!isChoosable(mode, category)) return mode
  if (mode.kind === 'delete') return { ...mode, id: category.id }
  if (mode.kind === 'spend') return { ...mode, from: category.id, active: 'amount' }
  if (mode.kind !== 'move') return mode
  if (mode.active === 'from') return { ...mode, from: category.id, active: mode.to ? 'amount' : 'to' }
  return { ...mode, to: category.id, active: mode.from ? 'amount' : 'from' }
}

/** The typed date as "yyyy-mm-dd", or null unless it is a real date that is today or earlier. */
export function entryDate(digits: string, today: string = todayIso()): string | null {
  const iso = digitsToIso(digits)
  return iso !== null && iso <= today ? iso : null
}

/**
 * The ledger operation that Save would apply, or null while the pop-up is not ready
 * (which is when Save is dull and cannot be clicked). For Deposit, Spend and edits, Save first asks for confirmation,
 * and this is the operation that Yes applies.
 */
export function pendingChange(mode: Mode, categories: readonly Category[]): ((budget: Budget) => Budget) | null {
  switch (mode.kind) {
    case 'add':
      return nameProblem(mode.name, categories) ? null : budget => addCategory(budget, mode.name)
    case 'move': {
      const from = categories.find(c => c.id === mode.from)
      const to = categories.find(c => c.id === mode.to)
      const { piconero } = checkAmount(mode.amount, from)
      if (!from || !to || piconero === undefined) return null
      return budget => move(budget, from.id, to.id, piconero)
    }
    case 'delete': {
      const category = categories.find(c => c.id === mode.id)
      return category && canDelete(category) ? budget => deleteCategory(budget, category.id) : null
    }
    case 'deposit': {
      const { piconero } = checkAmount(mode.amount)
      const date = entryDate(mode.date)
      if (piconero === undefined || date === null) return null
      return budget => deposit(budget, piconero, { note: mode.note.trim(), date })
    }
    case 'spend': {
      const from = categories.find(c => c.id === mode.from)
      const { piconero } = checkAmount(mode.amount, from)
      const date = entryDate(mode.date)
      if (!from || !canSpendFrom(from) || piconero === undefined || date === null) return null
      return budget => spend(budget, from.id, piconero, { note: mode.note.trim(), date })
    }
    case 'edit': {
      // An edit has no "holds only" limit, and any category except Ready to Assign can be From.
      const { piconero } = checkAmount(mode.amount)
      const date = entryDate(mode.date)
      const from = mode.spend ? editableFrom(categories).find(c => c.id === mode.from) : undefined
      if (piconero === undefined || date === null || (mode.spend && !from)) return null
      return budget => editTransaction(budget, mode.id, { from: from?.id, amount: piconero, note: mode.note.trim(), date })
    }
  }
}

/** The categories an edited spend can come from: all of them except Ready to Assign, even those holding 0 XMR. */
export const editableFrom = (categories: readonly Category[]) => categories.filter(c => canDelete(c))

/** The operation Yes applies on an edit's Delete confirmation. */
export const deleteChange = (mode: EditMode) => (budget: Budget) => deleteTransaction(budget, mode.id)

/** Deposit, Spend and edits confirm before saving; Add, Move and Delete Category do not. */
export const confirmsSave = (mode: Mode): mode is EntryMode => mode.kind === 'deposit' || mode.kind === 'spend' || mode.kind === 'edit'

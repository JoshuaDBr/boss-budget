import { addCategory, deleteCategory, deposit, move, spend, type Budget, type Category } from '../ledger/ledger'
import { canDelete, canMoveFrom, canMoveTo, canSpendFrom, checkAmount, nameProblem } from './categoryRules'

// Which pop-up is open (Add, Move, Delete, Deposit or Spend), and what has been filled in so far. Nothing here touches the ledger;
// the ledger only changes when Save (or Delete Category) is pressed.

export type MoveField = 'from' | 'to' | 'amount'
export type SpendField = 'from' | 'amount'

export type Mode =
  | { kind: 'add'; name: string }
  | { kind: 'move'; from?: string; to?: string; amount: string; active: MoveField }
  | { kind: 'delete'; id?: string }
  | { kind: 'deposit'; amount: string }
  | { kind: 'spend'; from?: string; amount: string; active: SpendField }

export type AddMode = Extract<Mode, { kind: 'add' }>
export type MoveMode = Extract<Mode, { kind: 'move' }>
export type DeleteMode = Extract<Mode, { kind: 'delete' }>
export type DepositMode = Extract<Mode, { kind: 'deposit' }>
export type SpendMode = Extract<Mode, { kind: 'spend' }>

export const startAdd = (): AddMode => ({ kind: 'add', name: '' })
export const startMove = (): MoveMode => ({ kind: 'move', amount: '', active: 'from' })
export const startDelete = (): DeleteMode => ({ kind: 'delete' })
export const startDeposit = (): DepositMode => ({ kind: 'deposit', amount: '' })
export const startSpend = (): SpendMode => ({ kind: 'spend', amount: '', active: 'from' })

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

/**
 * The ledger operation that Save would apply, or null while the pop-up is not ready
 * (which is when Save is dull and cannot be clicked).
 */
export function pendingChange(mode: Mode, categories: readonly Category[]): ((budget: Budget) => Budget) | null {
  switch (mode.kind) {
    case 'add':
      return nameProblem(mode.name, categories) ? null : budget => addCategory(budget, mode.name)
    case 'move': {
      const from = categories.find(c => c.id === mode.from)
      const to = categories.find(c => c.id === mode.to)
      const { drops } = checkAmount(mode.amount, from)
      if (!from || !to || drops === undefined) return null
      return budget => move(budget, from.id, to.id, drops)
    }
    case 'delete': {
      const category = categories.find(c => c.id === mode.id)
      return category && canDelete(category) ? budget => deleteCategory(budget, category.id) : null
    }
    case 'deposit': {
      const { drops } = checkAmount(mode.amount)
      return drops === undefined ? null : budget => deposit(budget, drops)
    }
    case 'spend': {
      const from = categories.find(c => c.id === mode.from)
      const { drops } = checkAmount(mode.amount, from)
      if (!from || !canSpendFrom(from) || drops === undefined) return null
      return budget => spend(budget, from.id, drops)
    }
  }
}

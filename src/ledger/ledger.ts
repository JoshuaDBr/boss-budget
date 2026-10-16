import { isIsoDate, todayIso } from './dates'
import { formatXmr } from './piconero'

// The budget is an append-only list of entries. Balances are never stored or
// edited directly; they are recalculated by replaying the entries in order.
// Every operation validates against the current balances, appends one entry,
// and re-checks the guardrail before the new state is accepted.
//
// Editing or deleting a past deposit or spend is itself an entry. When it is replayed, the
// transaction's old effect is undone and its new effect applied, so nothing else is erased.
// Only edits and deletes may leave a balance below zero (as in YNAB); new spends and moves never can.

export const READY_TO_ASSIGN = 'ready'
export const STARTER_CATEGORIES = ['Groceries', 'Gas', 'Emergency'] as const
/** Longest allowed category name, in characters. "Ready to Assign" is exactly this long. */
export const MAX_NAME_LENGTH = 15
/** Longest allowed transaction note, in characters. */
export const MAX_NOTE_LENGTH = 30

/** What a deposit or spend records besides its amount. The date is "yyyy-mm-dd". */
export interface Details {
  note: string
  date: string
}

export type Entry =
  | { kind: 'addCategory'; id: string; name: string }
  | { kind: 'deleteCategory'; id: string }
  | ({ kind: 'deposit'; id: string; amount: bigint } & Details)
  | ({ kind: 'spend'; id: string; from: string; amount: bigint } & Details)
  | { kind: 'move'; from: string; to: string; amount: bigint }
  /** Changes a past deposit or spend. `from` is given for a spend and left out for a deposit. */
  | ({ kind: 'editTransaction'; id: string; from?: string; amount: bigint } & Details)
  | { kind: 'deleteTransaction'; id: string }

/** A deposit or spend as it stands now, after any edits. */
export interface Transaction extends Details {
  id: string
  kind: 'deposit' | 'spend'
  /** The category a spend came from. It may since have been deleted, which leaves the spend unassigned. */
  from?: string
  amount: bigint
  /** Position in the order the transactions were first recorded. */
  order: number
}

export interface Category {
  id: string
  name: string
  balance: bigint
}

export interface Budget {
  readonly entries: readonly Entry[]
}

export interface Snapshot {
  /** Ready to Assign first, then categories in the order they were added. */
  categories: Category[]
  /** Deposits minus spends: the fixed amount the categories must add up to. */
  total: bigint
  /** Every deposit and spend that has not been deleted, in the order first recorded. */
  transactions: Transaction[]
}

export class BudgetError extends Error {}

export function emptyBudget(): Budget {
  return { entries: [{ kind: 'addCategory', id: READY_TO_ASSIGN, name: 'Ready to Assign' }] }
}

export function starterBudget(): Budget {
  let budget = emptyBudget()
  STARTER_CATEGORIES.forEach((name, i) => {
    budget = addCategory(budget, name, `starter-${i + 1}`)
  })
  return budget
}

/** Replays every entry. Throws BudgetError if the entries break any rule. */
export function snapshot(budget: Budget): Snapshot {
  const categories = new Map<string, Category>()
  const transactions = new Map<string, Transaction>()
  let total = 0n

  const existing = (id: string) => {
    const category = categories.get(id)
    if (!category) throw new BudgetError(`Unknown category: ${id}`)
    return category
  }
  const take = (category: Category, amount: bigint) => {
    if (category.balance < amount) {
      throw new BudgetError(
        `${category.name} holds ${formatXmr(category.balance)} XMR, which is less than ${formatXmr(amount)} XMR`,
      )
    }
    category.balance -= amount
  }

  // Adds a transaction's effect to the balances, or (sign -1n) takes it back out. Never refused:
  // a spend taken back returns to its category, or to Ready to Assign if that category is gone.
  const effect = (t: Transaction, sign: 1n | -1n) => {
    const ready = existing(READY_TO_ASSIGN)
    if (t.kind === 'deposit') {
      ready.balance += sign * t.amount
      total += sign * t.amount
    } else {
      const from = (t.from !== undefined && categories.get(t.from)) || ready
      from.balance -= sign * t.amount
      total -= sign * t.amount
    }
  }
  const recorded = (id: string) => {
    const t = transactions.get(id)
    if (!t) throw new BudgetError(`Unknown transaction: ${id}`)
    return t
  }
  const checkDetails = (details: Details) => {
    if (typeof details.note !== 'string' || [...details.note].length > MAX_NOTE_LENGTH) {
      throw new BudgetError(`Notes are limited to ${MAX_NOTE_LENGTH} characters`)
    }
    if (typeof details.date !== 'string' || !isIsoDate(details.date)) throw new BudgetError(`Invalid date: ${details.date}`)
  }
  const spendable = (id: string) => {
    if (id === READY_TO_ASSIGN) throw new BudgetError('Spending must come from a category, not Ready to Assign')
    return existing(id)
  }

  budget.entries.forEach((entry, index) => {
    if (index === 0 && !(entry.kind === 'addCategory' && entry.id === READY_TO_ASSIGN)) {
      throw new BudgetError('The first entry must create Ready to Assign')
    }
    if ('amount' in entry && entry.amount <= 0n) {
      throw new BudgetError('Amounts must be greater than zero')
    }

    switch (entry.kind) {
      case 'addCategory': {
        const name = entry.name.trim()
        if (!name) throw new BudgetError('Category name cannot be empty')
        if ([...name].length > MAX_NAME_LENGTH) {
          throw new BudgetError(`Category names are limited to ${MAX_NAME_LENGTH} characters`)
        }
        if (categories.has(entry.id)) throw new BudgetError(`Duplicate category id: ${entry.id}`)
        const lower = name.toLowerCase()
        for (const category of categories.values()) {
          if (category.name.toLowerCase() === lower) {
            throw new BudgetError(`A category named "${category.name}" already exists`)
          }
        }
        categories.set(entry.id, { id: entry.id, name, balance: 0n })
        break
      }
      case 'deleteCategory': {
        if (entry.id === READY_TO_ASSIGN) throw new BudgetError('Ready to Assign cannot be deleted')
        const category = existing(entry.id)
        // Its money goes back to Ready to Assign.
        existing(READY_TO_ASSIGN).balance += category.balance
        categories.delete(entry.id)
        break
      }
      case 'deposit':
      case 'spend': {
        checkDetails(entry)
        if (transactions.has(entry.id)) throw new BudgetError(`Duplicate transaction id: ${entry.id}`)
        if (entry.kind === 'spend') take(spendable(entry.from), entry.amount)
        else existing(READY_TO_ASSIGN).balance += entry.amount
        total += entry.kind === 'spend' ? -entry.amount : entry.amount
        const { id, kind, amount, note, date } = entry
        transactions.set(id, { id, kind, amount, note, date, order: transactions.size, ...(entry.kind === 'spend' && { from: entry.from }) })
        break
      }
      case 'editTransaction': {
        checkDetails(entry)
        const old = recorded(entry.id)
        if ((old.kind === 'spend') !== (entry.from !== undefined)) {
          throw new BudgetError('A spend is edited with a category, and a deposit without one')
        }
        if (entry.from !== undefined) spendable(entry.from)
        const edited: Transaction = { ...old, amount: entry.amount, note: entry.note, date: entry.date, from: entry.from }
        if (old.kind === 'deposit') delete edited.from
        effect(old, -1n)
        effect(edited, 1n)
        transactions.set(old.id, edited)
        break
      }
      case 'deleteTransaction': {
        effect(recorded(entry.id), -1n)
        transactions.delete(entry.id)
        break
      }
      case 'move': {
        if (entry.from === entry.to) throw new BudgetError('Cannot move money to the same category')
        const to = existing(entry.to)
        take(existing(entry.from), entry.amount)
        to.balance += entry.amount
        break
      }
    }
  })

  const result = { categories: [...categories.values()], total, transactions: [...transactions.values()] }
  checkGuardrail(result)
  return result
}

/**
 * The guardrail: categories (including Ready to Assign) add up to the total.
 * A balance may be negative, but only after an edit or delete; new spends and moves are checked as they are replayed.
 */
export function checkGuardrail({ categories, total }: Pick<Snapshot, 'categories' | 'total'>): void {
  let sum = 0n
  for (const category of categories) sum += category.balance
  if (sum !== total) {
    throw new BudgetError(`Guardrail broken: categories add up to ${sum} piconero, but the total is ${total}`)
  }
}

/** Appends an entry only if the budget still replays cleanly with it. The original budget is never modified. */
function apply(budget: Budget, entry: Entry): Budget {
  const next = { entries: [...budget.entries, entry] }
  snapshot(next)
  return next
}

let idCounter = 0
function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${++idCounter}`
}

export const addCategory = (budget: Budget, name: string, id: string = newId()) =>
  apply(budget, { kind: 'addCategory', id, name: name.trim() })
export const deleteCategory = (budget: Budget, id: string) => apply(budget, { kind: 'deleteCategory', id })
const noDetails = (): Details => ({ note: '', date: todayIso() })

export const deposit = (budget: Budget, amount: bigint, details: Details = noDetails(), id: string = newId()) =>
  apply(budget, { kind: 'deposit', id, amount, ...details })
export const spend = (budget: Budget, from: string, amount: bigint, details: Details = noDetails(), id: string = newId()) =>
  apply(budget, { kind: 'spend', id, from, amount, ...details })
/** Changes a past deposit or spend in place. Give `from` for a spend; leave it out for a deposit. */
export const editTransaction = (budget: Budget, id: string, change: { from?: string; amount: bigint } & Details) =>
  apply(budget, { kind: 'editTransaction', id, ...change })
export const deleteTransaction = (budget: Budget, id: string) => apply(budget, { kind: 'deleteTransaction', id })
export const move = (budget: Budget, from: string, to: string, amount: bigint) =>
  apply(budget, { kind: 'move', from, to, amount })

import { formatXrp } from './drops'

// The budget is an append-only list of entries. Balances are never stored or
// edited directly; they are recalculated by replaying the entries in order.
// Every operation validates against the current balances, appends one entry,
// and re-checks the guardrail before the new state is accepted.

export const READY_TO_ASSIGN = 'ready'
export const STARTER_CATEGORIES = ['Groceries', 'Gas', 'Emergency'] as const

export type Entry =
  | { kind: 'addCategory'; id: string; name: string }
  | { kind: 'deleteCategory'; id: string }
  | { kind: 'deposit'; amount: bigint }
  | { kind: 'spend'; from: string; amount: bigint }
  | { kind: 'move'; from: string; to: string; amount: bigint }

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
  let total = 0n

  const existing = (id: string) => {
    const category = categories.get(id)
    if (!category) throw new BudgetError(`Unknown category: ${id}`)
    return category
  }
  const take = (category: Category, amount: bigint) => {
    if (category.balance < amount) {
      throw new BudgetError(
        `${category.name} holds ${formatXrp(category.balance)} XRP, which is less than ${formatXrp(amount)} XRP`,
      )
    }
    category.balance -= amount
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
        existing(READY_TO_ASSIGN).balance += entry.amount
        total += entry.amount
        break
      case 'spend':
        if (entry.from === READY_TO_ASSIGN) {
          throw new BudgetError('Spending must come from a category, not Ready to Assign')
        }
        take(existing(entry.from), entry.amount)
        total -= entry.amount
        break
      case 'move': {
        if (entry.from === entry.to) throw new BudgetError('Cannot move money to the same category')
        const to = existing(entry.to)
        take(existing(entry.from), entry.amount)
        to.balance += entry.amount
        break
      }
    }
  })

  const result = { categories: [...categories.values()], total }
  checkGuardrail(result)
  return result
}

/** The guardrail: categories (including Ready to Assign) add up to the total, and none is negative. */
export function checkGuardrail({ categories, total }: Snapshot): void {
  let sum = 0n
  for (const category of categories) {
    if (category.balance < 0n) throw new BudgetError(`Guardrail broken: ${category.name} is negative`)
    sum += category.balance
  }
  if (sum !== total) {
    throw new BudgetError(`Guardrail broken: categories add up to ${sum} drops, but the total is ${total}`)
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
  return globalThis.crypto?.randomUUID?.() ?? `cat-${Date.now()}-${++idCounter}`
}

export const addCategory = (budget: Budget, name: string, id: string = newId()) =>
  apply(budget, { kind: 'addCategory', id, name: name.trim() })
export const deleteCategory = (budget: Budget, id: string) => apply(budget, { kind: 'deleteCategory', id })
export const deposit = (budget: Budget, amount: bigint) => apply(budget, { kind: 'deposit', amount })
export const spend = (budget: Budget, from: string, amount: bigint) => apply(budget, { kind: 'spend', from, amount })
export const move = (budget: Budget, from: string, to: string, amount: bigint) =>
  apply(budget, { kind: 'move', from, to, amount })

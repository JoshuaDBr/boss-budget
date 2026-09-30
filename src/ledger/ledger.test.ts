import { describe, expect, it } from 'vitest'
import {
  BudgetError,
  READY_TO_ASSIGN,
  addCategory,
  deleteCategory,
  deposit,
  emptyBudget,
  move,
  snapshot,
  spend,
  starterBudget,
} from './ledger'

const balances = (budget: Parameters<typeof snapshot>[0]) =>
  Object.fromEntries(snapshot(budget).categories.map((c) => [c.name, c.balance]))

describe('starter budget', () => {
  it('has Ready to Assign on top, then the three starter categories, all empty', () => {
    const { categories, total } = snapshot(starterBudget())
    expect(categories.map((c) => c.name)).toEqual(['Ready to Assign', 'Groceries', 'Gas', 'Emergency'])
    expect(categories.every((c) => c.balance === 0n)).toBe(true)
    expect(total).toBe(0n)
  })
})

describe('deposits', () => {
  it('land in Ready to Assign and raise the total', () => {
    const budget = deposit(starterBudget(), 5_000_000n)
    expect(balances(budget)['Ready to Assign']).toBe(5_000_000n)
    expect(snapshot(budget).total).toBe(5_000_000n)
  })

  it('refuse zero or negative amounts', () => {
    expect(() => deposit(starterBudget(), 0n)).toThrow(BudgetError)
    expect(() => deposit(starterBudget(), -1n)).toThrow(BudgetError)
  })
})

describe('moves', () => {
  const funded = deposit(starterBudget(), 10_000_000n)

  it('shift money between categories without changing the total', () => {
    const budget = move(funded, READY_TO_ASSIGN, 'starter-1', 4_000_000n)
    expect(balances(budget)).toMatchObject({ 'Ready to Assign': 6_000_000n, Groceries: 4_000_000n })
    expect(snapshot(budget).total).toBe(10_000_000n)
  })

  it('are refused if they would take a balance below zero', () => {
    expect(() => move(funded, READY_TO_ASSIGN, 'starter-1', 10_000_001n)).toThrow(BudgetError)
    expect(() => move(funded, 'starter-1', 'starter-2', 1n)).toThrow(BudgetError)
  })

  it('are refused to the same category or to an unknown one', () => {
    expect(() => move(funded, READY_TO_ASSIGN, READY_TO_ASSIGN, 1n)).toThrow(BudgetError)
    expect(() => move(funded, READY_TO_ASSIGN, 'nope', 1n)).toThrow(BudgetError)
  })
})

describe('spending', () => {
  const funded = move(deposit(starterBudget(), 10_000_000n), READY_TO_ASSIGN, 'starter-2', 3_000_000n)

  it('comes out of a category and lowers the total', () => {
    const budget = spend(funded, 'starter-2', 1_000_000n)
    expect(balances(budget).Gas).toBe(2_000_000n)
    expect(snapshot(budget).total).toBe(9_000_000n)
  })

  it('can empty a category exactly', () => {
    expect(balances(spend(funded, 'starter-2', 3_000_000n)).Gas).toBe(0n)
  })

  it('is refused if it would take the category below zero', () => {
    expect(() => spend(funded, 'starter-2', 3_000_001n)).toThrow(BudgetError)
  })

  it('is refused from Ready to Assign', () => {
    expect(() => spend(funded, READY_TO_ASSIGN, 1n)).toThrow(/Ready to Assign/)
  })
})

describe('categories', () => {
  it('can be added, with names trimmed and required to be unique', () => {
    const budget = addCategory(starterBudget(), '  Rent  ', 'rent')
    expect(snapshot(budget).categories.at(-1)?.name).toBe('Rent')
    expect(() => addCategory(budget, 'rent')).toThrow(/already exists/)
    expect(() => addCategory(budget, '   ')).toThrow(/empty/)
  })

  it('return their money to Ready to Assign when deleted', () => {
    let budget = deposit(starterBudget(), 10_000_000n)
    budget = move(budget, READY_TO_ASSIGN, 'starter-3', 7_000_000n)
    budget = deleteCategory(budget, 'starter-3')
    expect(balances(budget)).toEqual({ 'Ready to Assign': 10_000_000n, Groceries: 0n, Gas: 0n })
    expect(snapshot(budget).total).toBe(10_000_000n)
  })

  it('never allow Ready to Assign to be deleted', () => {
    expect(() => deleteCategory(starterBudget(), READY_TO_ASSIGN)).toThrow(BudgetError)
  })

  it('refuse operations on a deleted category', () => {
    const budget = deleteCategory(deposit(starterBudget(), 1_000_000n), 'starter-1')
    expect(() => move(budget, READY_TO_ASSIGN, 'starter-1', 1n)).toThrow(/Unknown category/)
  })
})

describe('refused operations', () => {
  it('leave the original budget untouched', () => {
    const budget = deposit(emptyBudget(), 1_000_000n)
    const before = budget.entries.length
    expect(() => spend(budget, READY_TO_ASSIGN, 1n)).toThrow()
    expect(budget.entries.length).toBe(before)
  })
})

describe('replay checks', () => {
  it('reject entry lists that do not start with Ready to Assign', () => {
    expect(() => snapshot({ entries: [{ kind: 'deposit', amount: 1n }] })).toThrow(BudgetError)
  })
})

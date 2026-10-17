import { describe, expect, it } from 'vitest'
import {
  BudgetError,
  READY_TO_ASSIGN,
  addCategory,
  deleteCategory,
  deleteTransaction,
  deposit,
  editTransaction,
  emptyBudget,
  move,
  renameCategory,
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

  it('have names of at most 15 characters', () => {
    expect(snapshot(addCategory(starterBudget(), 'Fifteen chars!!')).categories.at(-1)?.name).toBe('Fifteen chars!!')
    expect(() => addCategory(starterBudget(), 'Sixteen chars!!!')).toThrow(/15 characters/)
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
    expect(() => snapshot({ entries: [{ kind: 'deposit', id: 'd', amount: 1n, note: '', date: '2026-10-14' }] })).toThrow(BudgetError)
  })
})

describe('transaction records', () => {
  const day = (date: string, note = '') => ({ note, date })
  const funded = () => {
    let budget = addCategory(emptyBudget(), 'Food', 'food')
    budget = deposit(budget, 10n, day('2026-10-01', 'Paycheck'), 'd1')
    budget = move(budget, READY_TO_ASSIGN, 'food', 6n)
    return spend(budget, 'food', 4n, day('2026-10-02', 'Tacos'), 's1')
  }

  it('lists deposits and spends with their notes and dates, in order', () => {
    const { transactions } = snapshot(funded())
    expect(transactions.map((t) => [t.id, t.kind, t.amount, t.note, t.date, t.from])).toEqual([
      ['d1', 'deposit', 10n, 'Paycheck', '2026-10-01', undefined],
      ['s1', 'spend', 4n, 'Tacos', '2026-10-02', 'food'],
    ])
  })

  it('edits a spend in place, which may leave a category negative', () => {
    const budget = editTransaction(funded(), 's1', { from: 'food', amount: 9n, ...day('2026-10-03', 'Feast') })
    expect(balances(budget)).toEqual({ 'Ready to Assign': 4n, Food: -3n })
    const { transactions, total } = snapshot(budget)
    expect(total).toBe(1n)
    expect(transactions[1]).toMatchObject({ amount: 9n, note: 'Feast', date: '2026-10-03', order: 1 })
  })

  it('moves an edited spend to another category', () => {
    let budget = addCategory(funded(), 'Fun', 'fun')
    budget = editTransaction(budget, 's1', { from: 'fun', amount: 4n, ...day('2026-10-02') })
    expect(balances(budget)).toEqual({ 'Ready to Assign': 4n, Food: 6n, Fun: -4n })
  })

  it('edits a deposit, which may leave Ready to Assign negative', () => {
    const budget = editTransaction(funded(), 'd1', { amount: 1n, ...day('2026-10-01') })
    expect(balances(budget)).toEqual({ 'Ready to Assign': -5n, Food: 2n })
    expect(snapshot(budget).total).toBe(-3n)
  })

  it('deletes a spend and refunds its category', () => {
    const budget = deleteTransaction(funded(), 's1')
    expect(balances(budget)).toEqual({ 'Ready to Assign': 4n, Food: 6n })
    expect(snapshot(budget).transactions.map((t) => t.id)).toEqual(['d1'])
  })

  it('deletes a deposit and takes it back out of Ready to Assign', () => {
    const budget = deleteTransaction(funded(), 'd1')
    expect(balances(budget)).toEqual({ 'Ready to Assign': -6n, Food: 2n })
  })

  it('leaves a spend from a deleted category unassigned, refunding to Ready to Assign', () => {
    let budget = deleteCategory(funded(), 'food')
    expect(snapshot(budget).transactions[1].from).toBe('food')
    budget = deleteTransaction(budget, 's1')
    expect(balances(budget)).toEqual({ 'Ready to Assign': 10n })
  })

  it('still refuses new spends and moves beyond what a category holds', () => {
    const budget = editTransaction(funded(), 's1', { from: 'food', amount: 9n, ...day('2026-10-02') })
    expect(() => spend(budget, 'food', 1n)).toThrow(BudgetError)
    expect(() => move(budget, 'food', READY_TO_ASSIGN, 1n)).toThrow(BudgetError)
  })

  it('refuses bad edits', () => {
    const budget = funded()
    expect(() => editTransaction(budget, 'nope', { amount: 1n, ...day('2026-10-01') })).toThrow(BudgetError)
    expect(() => editTransaction(budget, 'd1', { from: 'food', amount: 1n, ...day('2026-10-01') })).toThrow(BudgetError)
    expect(() => editTransaction(budget, 's1', { amount: 1n, ...day('2026-10-01') })).toThrow(BudgetError)
    expect(() => editTransaction(budget, 's1', { from: READY_TO_ASSIGN, amount: 1n, ...day('2026-10-01') })).toThrow(BudgetError)
    expect(() => editTransaction(budget, 's1', { from: 'food', amount: 1n, ...day('2026-02-30') })).toThrow(BudgetError)
    expect(() => editTransaction(budget, 's1', { from: 'food', amount: 1n, ...day('2026-10-01', 'x'.repeat(31)) })).toThrow(BudgetError)
    expect(() => deleteTransaction(deleteTransaction(budget, 's1'), 's1')).toThrow(BudgetError)
  })
})

describe('renaming a category', () => {
  it('keeps its id, balance and place, with the name trimmed', () => {
    const budget = move(deposit(starterBudget(), 10n), READY_TO_ASSIGN, 'starter-2', 4n)
    const renamed = renameCategory(budget, 'starter-2', '  Fuel ')
    expect(snapshot(renamed).categories.map((c) => `${c.id} ${c.name} ${c.balance}`)).toEqual([
      'ready Ready to Assign 6', 'starter-1 Groceries 0', 'starter-2 Fuel 4', 'starter-3 Emergency 0',
    ])
  })

  it('may change only the capitals of its own name, but never take another category’s name', () => {
    expect(snapshot(renameCategory(starterBudget(), 'starter-2', 'GAS')).categories[2].name).toBe('GAS')
    expect(() => renameCategory(starterBudget(), 'starter-2', 'groceries')).toThrow(/already exists/)
  })

  it('refuses a blank or too-long name, an unknown category and Ready to Assign', () => {
    expect(() => renameCategory(starterBudget(), 'starter-2', '  ')).toThrow(/empty/)
    expect(() => renameCategory(starterBudget(), 'starter-2', 'Sixteen chars!!!')).toThrow(/15 characters/)
    expect(() => renameCategory(starterBudget(), 'nope', 'Fuel')).toThrow(/Unknown category/)
    expect(() => renameCategory(starterBudget(), READY_TO_ASSIGN, 'Inbox')).toThrow(/cannot be renamed/)
  })
})

describe('budgets kept in a coin', () => {
  it('name the coin and its full precision when refusing an amount', () => {
    const btc = { coin: 'BTC', ...move(deposit(starterBudget(), 150_000_000n), READY_TO_ASSIGN, 'starter-1', 50_000_000n) }
    expect(() => spend(btc, 'starter-1', 50_000_001n)).toThrow('Groceries holds 0.50000000 BTC, which is less than 0.50000001 BTC')
  })

  it('keep their coin through every operation', () => {
    expect(deposit({ coin: 'ETH', ...starterBudget() }, 1n).coin).toBe('ETH')
  })

  it('refuse a coin that is not on the list', () => {
    expect(() => snapshot({ coin: 'DOGE', ...starterBudget() })).toThrow(/Unknown coin/)
  })
})

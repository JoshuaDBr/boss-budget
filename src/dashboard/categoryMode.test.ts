import { describe, expect, it } from 'vitest'
import { isoToDigits, todayIso } from '../ledger/dates'
import { READY_TO_ASSIGN, deleteCategory, deposit, move, snapshot, spend, starterBudget, type Category } from '../ledger/ledger'
import {
  choose,
  confirmsSave,
  deleteChange,
  entryDate,
  isChoosable,
  pendingChange,
  startAdd,
  startDelete,
  startDeposit,
  startEdit,
  startMove,
  startSpend,
  type Mode,
} from './categoryMode'

const ready: Category = { id: READY_TO_ASSIGN, name: 'Ready to Assign', balance: 5_000_000_000_000n }
const groceries: Category = { id: 'g', name: 'Groceries', balance: 12_000_000_000_000n }
const gas: Category = { id: 'gas', name: 'Gas', balance: 0n }

describe('move pop-up', () => {
  it('starts on From and passes the emphasis From → To → amount', () => {
    let mode: Mode = startMove()
    expect(mode).toMatchObject({ active: 'from' })
    mode = choose(mode, groceries)
    expect(mode).toMatchObject({ from: 'g', active: 'to' })
    mode = choose(mode, ready)
    expect(mode).toMatchObject({ from: 'g', to: READY_TO_ASSIGN, active: 'amount' })
  })

  it('ignores categories with 0 XMR as From, and the From category as To', () => {
    const start = startMove()
    expect(isChoosable(start, gas)).toBe(false)
    expect(choose(start, gas)).toBe(start)
    const choosingTo = choose(start, groceries)
    expect(isChoosable(choosingTo, groceries)).toBe(false)
    expect(choose(choosingTo, groceries)).toBe(choosingTo)
    expect(isChoosable(choosingTo, gas)).toBe(true)
  })

  it('lets the fields be filled in any order', () => {
    let mode: Mode = { ...startMove(), active: 'to' }
    mode = choose(mode, groceries)
    expect(mode).toMatchObject({ to: 'g', active: 'from' })
    expect(isChoosable(mode, groceries)).toBe(false)
    mode = choose(mode, ready)
    expect(mode).toMatchObject({ from: READY_TO_ASSIGN, to: 'g', active: 'amount' })
  })

  it('shows no select markers while the amount box is active', () => {
    expect(isChoosable({ ...startMove(), active: 'amount' }, groceries)).toBe(false)
  })
})

describe('delete pop-up', () => {
  it('chooses any category except Ready to Assign, and can change its mind', () => {
    let mode = choose(startDelete(), ready)
    expect(mode).toEqual({ kind: 'delete' })
    mode = choose(mode, gas)
    expect(mode).toEqual({ kind: 'delete', id: 'gas' })
    expect(choose(mode, groceries)).toEqual({ kind: 'delete', id: 'g' })
  })
})

describe('spend pop-up', () => {
  it('chooses only categories that hold XMR, never Ready to Assign, then moves to the amount', () => {
    const start = startSpend()
    expect(isChoosable(start, ready)).toBe(false)
    expect(isChoosable(start, gas)).toBe(false)
    expect(choose(start, ready)).toBe(start)
    const chosen = choose(start, groceries)
    expect(chosen).toMatchObject({ from: 'g', active: 'amount' })
    expect(isChoosable(chosen, groceries)).toBe(false)
  })
})

describe('deposit pop-up', () => {
  it('never chooses rows', () => {
    expect(isChoosable(startDeposit(), groceries)).toBe(false)
  })
})

describe('add pop-up', () => {
  it('never chooses rows', () => {
    expect(isChoosable(startAdd(), groceries)).toBe(false)
    expect(isChoosable(null, groceries)).toBe(false)
  })
})

describe('Save', () => {
  const funded = move(deposit(starterBudget(), 10_000_000_000_000n), READY_TO_ASSIGN, 'starter-1', 4_000_000_000_000n)
  const categories = snapshot(funded).categories
  const after = (mode: Mode) => {
    const change = pendingChange(mode, categories)
    return change && snapshot(change(funded)).categories.map(c => `${c.name} ${c.balance}`)
  }

  it('is not ready until the pop-up is complete and valid', () => {
    expect(pendingChange(startAdd(), categories)).toBeNull()
    expect(pendingChange({ kind: 'add', name: 'gas' }, categories)).toBeNull()
    expect(pendingChange({ ...startMove(), from: 'starter-1', amount: '1' }, categories)).toBeNull()
    expect(pendingChange({ ...startMove(), from: 'starter-1', to: 'starter-2', amount: '4.000000000001' }, categories)).toBeNull()
    expect(pendingChange({ ...startMove(), from: 'starter-1', to: 'starter-2', amount: '0' }, categories)).toBeNull()
    expect(pendingChange(startDelete(), categories)).toBeNull()
    expect(pendingChange({ kind: 'delete', id: READY_TO_ASSIGN }, categories)).toBeNull()
    expect(pendingChange(startDeposit(), categories)).toBeNull()
    expect(pendingChange({ ...startDeposit(), amount: '1.0000000000001' }, categories)).toBeNull()
    expect(pendingChange({ ...startSpend(), amount: '1' }, categories)).toBeNull()
    expect(pendingChange({ ...startSpend(), from: 'starter-1', amount: '4.000000000001', active: 'amount' }, categories)).toBeNull()
    expect(pendingChange({ ...startSpend(), from: READY_TO_ASSIGN, amount: '1', active: 'amount' }, categories)).toBeNull()
  })

  it('adds, moves and deletes through the ledger', () => {
    expect(after({ kind: 'add', name: ' Rent ' })?.at(-1)).toBe('Rent 0')
    expect(after({ kind: 'move', from: 'starter-1', to: 'starter-3', amount: '4', active: 'amount' })).toEqual([
      'Ready to Assign 6000000000000',
      'Groceries 0',
      'Gas 0',
      'Emergency 4000000000000',
    ])
    expect(after({ kind: 'delete', id: 'starter-1' })).toEqual(['Ready to Assign 10000000000000', 'Gas 0', 'Emergency 0'])
  })

  it('deposits into Ready to Assign with no upper limit, and spends from a category', () => {
    expect(after({ ...startDeposit(), amount: '1000000000.5' })?.[0]).toBe('Ready to Assign 1000000006500000000000')
    expect(after({ ...startSpend(), from: 'starter-1', amount: '4', active: 'amount' })).toEqual([
      'Ready to Assign 6000000000000',
      'Groceries 0',
      'Gas 0',
      'Emergency 0',
    ])
  })
})

describe('Note and Date', () => {
  it('start with an empty note and today prefilled', () => {
    expect(startDeposit()).toMatchObject({ note: '', date: isoToDigits(todayIso()) })
    expect(startSpend()).toMatchObject({ note: '', date: isoToDigits(todayIso()) })
  })

  it('accept only a real date that is today or earlier', () => {
    expect(entryDate('10142026', '2026-10-14')).toBe('2026-10-14')
    expect(entryDate('10152026', '2026-10-14')).toBeNull()
    expect(entryDate('02302026', '2026-10-14')).toBeNull()
    expect(entryDate('1014202', '2026-10-14')).toBeNull()
  })

  it('are recorded with the transaction, and keep Save dull while the date is unfinished', () => {
    const budget = starterBudget()
    const categories = snapshot(budget).categories
    expect(pendingChange({ ...startDeposit(), amount: '1', date: '1014' }, categories)).toBeNull()
    const change = pendingChange({ ...startDeposit(), amount: '1', note: ' Paycheck ', date: '10012026' }, categories)
    expect(snapshot(change!(budget)).transactions[0]).toMatchObject({ note: 'Paycheck', date: '2026-10-01' })
  })
})

describe('confirmation', () => {
  it('applies to Deposit, Spend and edits only', () => {
    expect([startAdd(), startMove(), startDelete(), startDeposit(), startSpend()].map(confirmsSave)).toEqual([false, false, false, true, true])
  })
})

describe('edit pop-up', () => {
  const funded = spend(
    move(deposit(starterBudget(), 10n, { note: 'Pay', date: '2026-10-01' }, 'd1'), READY_TO_ASSIGN, 'starter-1', 4n),
    'starter-1',
    3n,
    { note: 'Tacos', date: '2026-10-02' },
    's1',
  )
  const { categories, transactions } = snapshot(funded)
  const balancesAfter = (mode: Mode, budget = funded) => {
    const change = pendingChange(mode, snapshot(budget).categories)
    return change && snapshot(change(budget)).categories.map(c => c.balance)
  }

  it('opens filled with the current values and nothing emphasized', () => {
    expect(startEdit(transactions[1], '0.000000000003')).toEqual({
      kind: 'edit', id: 's1', spend: true, from: 'starter-1', amount: '0.000000000003', note: 'Tacos', date: '10022026', active: null, listOpen: false,
    })
  })

  it('may move a spend to a category holding 0 XMR and leave it negative, but never to Ready to Assign', () => {
    const edit = startEdit(transactions[1], '0.000000000005')
    expect(balancesAfter({ ...edit, from: 'starter-2' })).toEqual([6n, 4n, -5n, 0n])
    expect(pendingChange({ ...edit, from: READY_TO_ASSIGN }, categories)).toBeNull()
  })

  it('keeps Save dull for an unassigned spend until a category is chosen', () => {
    const orphaned = deleteCategory(funded, 'starter-1')
    const edit = startEdit(snapshot(orphaned).transactions[1], '0.000000000003')
    expect(pendingChange(edit, snapshot(orphaned).categories)).toBeNull()
    expect(balancesAfter({ ...edit, from: 'starter-3' }, orphaned)).toEqual([10n, 0n, -3n])
  })

  it('edits a deposit without a category, and deletes', () => {
    expect(balancesAfter(startEdit(transactions[0], '0.000000000001'))).toEqual([-3n, 1n, 0n, 0n])
    const remove = deleteChange(startEdit(transactions[1], ''))
    expect(snapshot(remove(funded)).categories.map(c => c.balance)).toEqual([6n, 4n, 0n, 0n])
  })
})

import { describe, expect, it } from 'vitest'
import { READY_TO_ASSIGN, deposit, move, snapshot, starterBudget, type Category } from '../ledger/ledger'
import { choose, isChoosable, pendingChange, startAdd, startDelete, startMove, type Mode } from './categoryMode'

const ready: Category = { id: READY_TO_ASSIGN, name: 'Ready to Assign', balance: 5_000_000n }
const groceries: Category = { id: 'g', name: 'Groceries', balance: 12_000_000n }
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

  it('ignores categories with 0 XRP as From, and the From category as To', () => {
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

describe('add pop-up', () => {
  it('never chooses rows', () => {
    expect(isChoosable(startAdd(), groceries)).toBe(false)
    expect(isChoosable(null, groceries)).toBe(false)
  })
})

describe('Save', () => {
  const funded = move(deposit(starterBudget(), 10_000_000n), READY_TO_ASSIGN, 'starter-1', 4_000_000n)
  const categories = snapshot(funded).categories
  const after = (mode: Mode) => {
    const change = pendingChange(mode, categories)
    return change && snapshot(change(funded)).categories.map(c => `${c.name} ${c.balance}`)
  }

  it('is not ready until the pop-up is complete and valid', () => {
    expect(pendingChange(startAdd(), categories)).toBeNull()
    expect(pendingChange({ kind: 'add', name: 'gas' }, categories)).toBeNull()
    expect(pendingChange({ ...startMove(), from: 'starter-1', amount: '1' }, categories)).toBeNull()
    expect(pendingChange({ ...startMove(), from: 'starter-1', to: 'starter-2', amount: '4.000001' }, categories)).toBeNull()
    expect(pendingChange({ ...startMove(), from: 'starter-1', to: 'starter-2', amount: '0' }, categories)).toBeNull()
    expect(pendingChange(startDelete(), categories)).toBeNull()
    expect(pendingChange({ kind: 'delete', id: READY_TO_ASSIGN }, categories)).toBeNull()
  })

  it('adds, moves and deletes through the ledger', () => {
    expect(after({ kind: 'add', name: ' Rent ' })?.at(-1)).toBe('Rent 0')
    expect(after({ kind: 'move', from: 'starter-1', to: 'starter-3', amount: '4', active: 'amount' })).toEqual([
      'Ready to Assign 6000000',
      'Groceries 0',
      'Gas 0',
      'Emergency 4000000',
    ])
    expect(after({ kind: 'delete', id: 'starter-1' })).toEqual(['Ready to Assign 10000000', 'Gas 0', 'Emergency 0'])
  })
})

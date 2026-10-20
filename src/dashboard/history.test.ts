import { describe, expect, it } from 'vitest'
import { addCoin, changeCoin, starterBook } from '../ledger/book'
import { READY_TO_ASSIGN, deleteTransaction, deposit, editTransaction, move, snapshot, spend, starterBudget, type Budget } from '../ledger/ledger'
import { bossData } from './boss'
import { newestFirst } from './TransactionHistory'

// 0.4.1 (B1): both histories sort newest first by date, then by the time each transaction was entered.

const on = (date: string, note = '') => ({ note, date })
const notes = (budget: Budget) => newestFirst(snapshot(budget).transactions).map(t => t.note)

describe('0.4.1: newest first by date, then time (B1)', () => {
  it('puts the later of two same-day entries first, whatever order they were recorded in', () => {
    let budget = deposit(starterBudget(), 10n, on('2026-10-19', 'evening'), 'a', '18:00:00')
    budget = deposit(budget, 10n, on('2026-10-19', 'morning'), 'b', '07:30:00')
    budget = deposit(budget, 10n, on('2026-10-18', 'yesterday'), 'c', '23:59:59')
    expect(notes(budget)).toEqual(['evening', 'morning', 'yesterday'])
  })

  it('keeps the order right after a delete frees a place in the count', () => {
    let budget = deposit(starterBudget(), 10n, on('2026-10-19', 'first'), 'a', '09:00:00')
    budget = deposit(budget, 10n, on('2026-10-19', 'second'), 'b', '10:00:00')
    budget = deleteTransaction(budget, 'a')
    budget = deposit(budget, 10n, on('2026-10-19', 'third'), 'c', '11:00:00')
    // "third" now has the same order number as "second"; its later time keeps it on top.
    expect(snapshot(budget).transactions.map(t => t.order)).toEqual([1, 1])
    expect(notes(budget)).toEqual(['third', 'second'])
  })

  it('a date edit moves the entry to its new date and keeps its time among that day', () => {
    let budget = deposit(starterBudget(), 10n, on('2026-10-15', 'moved'), 'a', '12:00:00')
    budget = deposit(budget, 10n, on('2026-10-17', 'early'), 'b', '08:00:00')
    budget = deposit(budget, 10n, on('2026-10-17', 'late'), 'c', '20:00:00')
    budget = editTransaction(budget, 'a', { amount: 10n, ...on('2026-10-17', 'moved') })
    expect(notes(budget)).toEqual(['late', 'moved', 'early'])
  })

  it('shows data saved before 0.4.1, with no times, in the order it always had', () => {
    const old = (id: string, date: string, note: string) => ({ kind: 'deposit' as const, id, amount: 1n, note, date })
    const budget: Budget = {
      entries: [...starterBudget().entries, old('a', '2026-10-01', 'one'), old('b', '2026-10-02', 'two'), old('c', '2026-10-02', 'three')],
    }
    expect(notes(budget)).toEqual(['three', 'two', 'one'])
    // A new entry that day goes above them.
    expect(notes(deposit(budget, 1n, on('2026-10-02', 'new'), 'd', '00:00:01'))).toEqual(['new', 'three', 'two', 'one'])
  })

  it('orders the Boss history across coins by date, then time', () => {
    let book = addCoin(addCoin(starterBook(), 'XMR'), 'BTC')
    book = changeCoin(book, 'XMR', b => deposit(b, 10n, on('2026-10-19', 'xmr noon'), 'x1', '12:00:00'))
    book = changeCoin(book, 'BTC', b => deposit(b, 10n, on('2026-10-19', 'btc morning'), 'b1', '09:00:00'))
    book = changeCoin(book, 'BTC', b => spend(move(b, READY_TO_ASSIGN, 'starter-1', 5n), 'starter-1', 1n, on('2026-10-19', 'btc night'), 'b2', '22:00:00'))
    expect(newestFirst(bossData(book).transactions).map(t => t.note)).toEqual(['btc night', 'xmr noon', 'btc morning'])
  })
})

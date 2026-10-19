import { describe, expect, it } from 'vitest'
import { addCoin, changeCategories, changeCoin, removeCoin, starterBook } from '../ledger/book'
import { deleteCategory, deposit, move, spend } from '../ledger/ledger'
import { BOSS_MIN, bossData, holdingCount } from './boss'

const funded = () => {
  let book = ['XMR', 'BTC', 'ZEC'].reduce(addCoin, starterBook())
  book = changeCoin(book, 'XMR', b => deposit(b, 10n, { date: '2026-10-01', note: 'pay' }, 'x1'))
  book = changeCoin(book, 'XMR', b => move(b, 'ready', 'starter-1', 4n))
  book = changeCoin(book, 'XMR', b => spend(b, 'starter-1', 1n, { date: '2026-10-03', note: 'food' }, 'x2'))
  book = changeCoin(book, 'BTC', b => deposit(b, 5n, { date: '2026-10-02', note: 'gift' }, 'b1'))
  return book
}

describe('the Boss View', () => {
  it('counts only coins holding money outside Ready to Assign', () => {
    let book = funded()
    expect(holdingCount(book)).toBe(1) // BTC's deposit still sits in Ready to Assign; ZEC is empty
    book = changeCoin(book, 'BTC', b => move(b, 'ready', 'starter-3', 2n))
    expect(holdingCount(book)).toBe(BOSS_MIN)
    expect(holdingCount(removeCoin(book, 'BTC'))).toBe(1)
    expect(holdingCount(undefined)).toBe(0)
  })

  it('lists every coin’s transactions with their ticker and category name', () => {
    const data = bossData(funded())
    expect(data.transactions.map(t => `${t.ticker} ${t.id} ${t.category}`)).toEqual(['BTC b1 null', 'XMR x1 null', 'XMR x2 Groceries'])
  })

  it('gives each category, except Ready to Assign, its balance in every coin', () => {
    const data = bossData(funded())
    expect(data.categories.map(c => c.name)).toEqual(['Groceries', 'Gas', 'Emergency'])
    expect(data.categories[0].balances).toEqual([
      { ticker: 'BTC', units: 0n },
      { ticker: 'XMR', units: 3n },
      { ticker: 'ZEC', units: 0n },
    ])
  })

  it('leaves a deleted category’s spends unassigned', () => {
    let book = funded()
    book = changeCoin(book, 'XMR', b => move(b, 'starter-1', 'ready', 3n))
    book = changeCategories(book, b => deleteCategory(b, 'starter-1'))
    const data = bossData(book)
    expect(data.transactions.find(t => t.id === 'x2')!.category).toBeNull()
    expect(data.categories.map(c => c.name)).toEqual(['Gas', 'Emergency'])
  })
})

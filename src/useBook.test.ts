import { describe, expect, it } from 'vitest'
import { addCoin, changeCoin, starterBook } from './ledger/book'
import { deposit, snapshot } from './ledger/ledger'
import { load } from './ledger/storage'
import { makeCommit, stateOf, type BookState } from './useBook'

const memoryStore = (): Storage => {
  const data: Record<string, string> = {}
  return {
    getItem: k => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: k => void delete data[k],
    clear: () => {},
    key: () => null,
    length: 0,
  }
}

describe('0.4.1: each change builds on the latest state (B10)', () => {
  it('keeps both of two changes made before the screen catches up', () => {
    const store = memoryStore()
    let latest: BookState = stateOf(addCoin(starterBook(), 'XMR'), 'XMR')
    const screen: BookState[] = []
    const commit = makeCommit(() => latest, next => (latest = next, screen.push(next)), store)
    const pay = (amount: bigint) => commit(book => changeCoin(book, 'XMR', b => deposit(b, amount)), () => 'XMR')

    // Two deposits in a row, with no render in between.
    expect(pay(3n)).toBeNull()
    expect(pay(4n)).toBeNull()
    expect(latest.snapshot?.total).toBe(7n)
    expect(snapshot(load(store).coins.XMR).total).toBe(7n)
    expect(screen).toHaveLength(2)
  })

  it('reports a refused change and keeps the latest state', () => {
    let latest: BookState = stateOf(starterBook(), null)
    const commit = makeCommit(() => latest, next => (latest = next), memoryStore())
    expect(commit(book => changeCoin(book, 'XMR', b => b), () => null)).toBe('XMR has not been added')
    expect(latest.book).toEqual(starterBook())
  })
})

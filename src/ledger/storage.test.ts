import { describe, expect, it } from 'vitest'
import { addCoin, changeCoin, starterBook } from './book'
import { READY_TO_ASSIGN, deposit, move } from './ledger'
import {
  STORAGE_KEY,
  StorageError,
  V1_STORAGE_KEY,
  V2_STORAGE_KEY,
  VIEW_KEY,
  type KeyValueStore,
  deserialize,
  load,
  loadView,
  save,
  saveView,
  serialize,
} from './storage'

const memoryStore = (initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  }
}

const withXmr = () => changeCoin(addCoin(starterBook(), 'XMR'), 'XMR', (b) => deposit(b, 5n))

describe('storage', () => {
  it('starts with the starter categories and no coins when nothing is saved', () => {
    expect(load(memoryStore())).toEqual(starterBook())
  })

  it('deletes the budgets saved by V1 and V2 and starts fresh', () => {
    const store = memoryStore({ [V1_STORAGE_KEY]: '{"version":1,"entries":[]}', [V2_STORAGE_KEY]: '{"version":3,"entries":[]}' })
    expect(load(store)).toEqual(starterBook())
    expect(store.data).not.toHaveProperty(V1_STORAGE_KEY)
    expect(store.data).not.toHaveProperty(V2_STORAGE_KEY)
  })

  it('round-trips every coin exactly, including very large amounts', () => {
    const store = memoryStore()
    let book = addCoin(withXmr(), 'ETH')
    book = changeCoin(book, 'ETH', (b) => move(deposit(b, 99_999_999_999_999_999_999_999n), READY_TO_ASSIGN, 'starter-1', 1n))
    save(store, book)
    expect(load(store)).toEqual(book)
    expect(store.data[STORAGE_KEY]).toContain('"99999999999999999999999"')
  })

  it('refuses damaged or tampered data instead of loading it', () => {
    const tampered = JSON.parse(serialize(withXmr()))
    tampered.coins.XMR.push({ kind: 'spend', from: READY_TO_ASSIGN, amount: '5' })
    const unknownCoin = JSON.parse(serialize(withXmr()))
    unknownCoin.coins = { DOGE: unknownCoin.coins.XMR }
    const moneyInCategories = JSON.parse(serialize(withXmr()))
    moneyInCategories.categories.push({ kind: 'deposit', id: 'd', amount: '1', note: '', date: '2026-10-01' })
    const texts = ['not json', '{"version":3,"entries":[]}', '{"version":4,"categories":[],"coins":[]}']
    for (const text of [...texts, ...[tampered, unknownCoin, moneyInCategories].map((d) => JSON.stringify(d))]) {
      expect(() => deserialize(text), text).toThrow(StorageError)
    }
    const badAmount = serialize(withXmr()).replace('"5"', '"-5"')
    expect(() => deserialize(badAmount)).toThrow(StorageError)
  })

  it('does not overwrite damaged data when loading fails', () => {
    const store = memoryStore({ [STORAGE_KEY]: 'not json' })
    expect(() => load(store)).toThrow(StorageError)
    expect(store.data[STORAGE_KEY]).toBe('not json')
  })
})

describe('the coin last viewed', () => {
  it('is remembered, but only while that coin is still in the book', () => {
    const store = memoryStore()
    const book = withXmr()
    expect(loadView(store, book)).toBeNull()
    saveView(store, 'XMR')
    expect(loadView(store, book)).toBe('XMR')
    expect(loadView(store, starterBook())).toBeNull()
    saveView(store, null)
    expect(store.data).not.toHaveProperty(VIEW_KEY)
    store.data[VIEW_KEY] = 'DOGE'
    expect(loadView(store, book)).toBeNull()
  })
})

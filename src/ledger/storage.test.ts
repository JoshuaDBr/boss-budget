import { describe, expect, it } from 'vitest'
import { READY_TO_ASSIGN, deposit, move, snapshot, starterBudget } from './ledger'
import { STORAGE_KEY, StorageError, type KeyValueStore, deserialize, load, save, serialize } from './storage'

const memoryStore = (initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...initial }
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

describe('storage', () => {
  it('starts with the starter budget when nothing is saved', () => {
    expect(snapshot(load(memoryStore())).categories).toHaveLength(4)
  })

  it('round-trips a budget exactly, including very large amounts', () => {
    const store = memoryStore()
    const budget = move(deposit(starterBudget(), 99_999_999_999_999_999n), READY_TO_ASSIGN, 'starter-1', 1n)
    save(store, budget)
    expect(load(store)).toEqual(budget)
    expect(store.data[STORAGE_KEY]).toContain('"99999999999999999"')
  })

  it('refuses damaged or tampered data instead of loading it', () => {
    const tampered = JSON.parse(serialize(deposit(starterBudget(), 5n)))
    tampered.entries.push({ kind: 'spend', from: READY_TO_ASSIGN, amount: '5' })
    for (const text of ['not json', '{"version":2,"entries":[]}', JSON.stringify(tampered)]) {
      expect(() => deserialize(text)).toThrow(StorageError)
    }
    const badAmount = serialize(deposit(starterBudget(), 5n)).replace('"5"', '"-5"')
    expect(() => deserialize(badAmount)).toThrow(StorageError)
  })

  it('does not overwrite damaged data when loading fails', () => {
    const store = memoryStore({ [STORAGE_KEY]: 'not json' })
    expect(() => load(store)).toThrow(StorageError)
    expect(store.data[STORAGE_KEY]).toBe('not json')
  })
})

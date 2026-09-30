import { type Budget, type Entry, snapshot, starterBudget } from './ledger'

// Saved in the browser (localStorage). No login, no server.
// bigint amounts are written as decimal strings, since JSON has no bigint type.

export const STORAGE_KEY = 'boss-budget:v1'
const FORMAT_VERSION = 1

/** The part of localStorage we use; tests pass in an in-memory stand-in. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export class StorageError extends Error {}

type StoredEntry = Omit<Entry, 'amount'> & { amount?: string }

export function serialize(budget: Budget): string {
  const entries = budget.entries.map((entry) =>
    'amount' in entry ? { ...entry, amount: entry.amount.toString() } : entry,
  )
  return JSON.stringify({ version: FORMAT_VERSION, entries })
}

/** Parses saved data and replays it; throws StorageError if anything is malformed or breaks a rule. */
export function deserialize(text: string): Budget {
  let data: { version?: unknown; entries?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    throw new StorageError('Saved budget is not valid JSON')
  }
  if (data.version !== FORMAT_VERSION || !Array.isArray(data.entries)) {
    throw new StorageError('Saved budget has an unknown format')
  }
  const entries = (data.entries as StoredEntry[]).map((entry) => {
    if (entry.amount === undefined) return entry as Entry
    if (typeof entry.amount !== 'string' || !/^\d+$/.test(entry.amount)) {
      throw new StorageError('Saved budget contains an invalid amount')
    }
    return { ...entry, amount: BigInt(entry.amount) } as Entry
  })
  const budget = { entries }
  try {
    snapshot(budget)
  } catch (error) {
    throw new StorageError(`Saved budget failed its checks: ${(error as Error).message}`)
  }
  return budget
}

/**
 * Loads the saved budget, or the starter budget if nothing is saved yet.
 * Damaged data throws rather than being silently replaced, so it is never overwritten by accident.
 */
export function load(store: KeyValueStore): Budget {
  const text = store.getItem(STORAGE_KEY)
  return text === null ? starterBudget() : deserialize(text)
}

export function save(store: KeyValueStore, budget: Budget): void {
  store.setItem(STORAGE_KEY, serialize(budget))
}

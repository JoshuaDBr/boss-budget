import { todayIso } from './dates'
import { type Budget, type Entry, snapshot, starterBudget } from './ledger'

// Saved in the browser (localStorage). No login, no server.
// bigint amounts are written as decimal strings, since JSON has no bigint type.

export const STORAGE_KEY = 'boss-budget:v2'
const FORMAT_VERSION = 3
// Version 2 (Phase 1) saved deposits and spends without an id, note or date. They are upgraded on load:
// each gets an id, an empty note and the day of the upgrade, and the budget is saved again as version 3.
const PHASE_1_VERSION = 2

// Where V1 saved its XRP budget. V2 deletes it the first time it opens and starts fresh (V2 PRD, Phase 1).
export const V1_STORAGE_KEY = 'boss-budget:v1'

/** The part of localStorage we use; tests pass in an in-memory stand-in. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
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
  return read(text).budget
}

function read(text: string): { budget: Budget; upgraded: boolean } {
  let data: { version?: unknown; entries?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    throw new StorageError('Saved budget is not valid JSON')
  }
  const upgraded = data.version === PHASE_1_VERSION
  if ((data.version !== FORMAT_VERSION && !upgraded) || !Array.isArray(data.entries)) {
    throw new StorageError('Saved budget has an unknown format')
  }
  const today = todayIso()
  const entries = (data.entries as StoredEntry[]).map((stored, index) => {
    const entry =
      upgraded && (stored.kind === 'deposit' || stored.kind === 'spend')
        ? { ...stored, id: `legacy-${index}`, note: '', date: today }
        : stored
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
  return { budget, upgraded }
}

/**
 * Loads the saved budget, or the starter budget if nothing is saved yet.
 * Any XRP budget left by V1 is deleted first, so V2 starts fresh with the starter categories.
 * Damaged data throws rather than being silently replaced, so it is never overwritten by accident.
 */
export function load(store: KeyValueStore): Budget {
  store.removeItem(V1_STORAGE_KEY)
  const text = store.getItem(STORAGE_KEY)
  if (text === null) return starterBudget()
  const { budget, upgraded } = read(text)
  if (upgraded) save(store, budget)
  return budget
}

export function save(store: KeyValueStore, budget: Budget): void {
  store.setItem(STORAGE_KEY, serialize(budget))
}

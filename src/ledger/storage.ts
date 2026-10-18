import { checkBook, starterBook, type Book } from './book'
import { findCoin } from './coins'
import type { Budget, Entry } from './ledger'

// Saved in the browser (localStorage). No login, no server.
// bigint amounts are written as decimal strings, since JSON has no bigint type.

export const STORAGE_KEY = 'boss-budget:v3'
const FORMAT_VERSION = 4
/** The coin on screen, so the app opens on the coin last viewed. */
export const VIEW_KEY = 'boss-budget:v3-coin'

// Where V1 saved its XRP budget and V2 its XMR budget. V3 deletes both the first time it opens and starts with no coins
// (V3 PRD, Phase 1).
export const V1_STORAGE_KEY = 'boss-budget:v1'
export const V2_STORAGE_KEY = 'boss-budget:v2'

/** The part of localStorage we use; tests pass in an in-memory stand-in. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class StorageError extends Error {}

type StoredEntry = Omit<Entry, 'amount'> & { amount?: string }

const writeEntries = (budget: Budget) =>
  budget.entries.map((entry) => ('amount' in entry ? { ...entry, amount: entry.amount.toString() } : entry))

export function serialize(book: Book): string {
  const coins = Object.fromEntries(Object.entries(book.coins).map(([ticker, budget]) => [ticker, writeEntries(budget)]))
  return JSON.stringify({ version: FORMAT_VERSION, categories: writeEntries(book.categories), coins })
}

function readEntries(stored: unknown): Entry[] {
  if (!Array.isArray(stored)) throw new StorageError('Saved budget has an unknown format')
  return (stored as StoredEntry[]).map((entry) => {
    if (entry.amount === undefined) return entry as Entry
    if (typeof entry.amount !== 'string' || !/^\d+$/.test(entry.amount)) {
      throw new StorageError('Saved budget contains an invalid amount')
    }
    return { ...entry, amount: BigInt(entry.amount) } as Entry
  })
}

/** Parses saved data and replays every coin; throws StorageError if anything is malformed or breaks a rule. */
export function deserialize(text: string): Book {
  let data: { version?: unknown; categories?: unknown; coins?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    throw new StorageError('Saved budget is not valid JSON')
  }
  if (data.version !== FORMAT_VERSION || typeof data.coins !== 'object' || data.coins === null || Array.isArray(data.coins)) {
    throw new StorageError('Saved budget has an unknown format')
  }
  const coins: Record<string, Budget> = {}
  for (const [ticker, entries] of Object.entries(data.coins)) coins[ticker] = { coin: ticker, entries: readEntries(entries) }
  const book = { categories: { entries: readEntries(data.categories) }, coins }
  try {
    checkBook(book)
  } catch (error) {
    throw new StorageError(`Saved budget failed its checks: ${(error as Error).message}`)
  }
  return book
}

/**
 * Loads the saved book, or the starter categories with no coins if nothing is saved yet.
 * Any budget left by V1 or V2 is deleted first, so V3 starts fresh.
 * Damaged data throws rather than being silently replaced, so it is never overwritten by accident.
 */
export function load(store: KeyValueStore): Book {
  store.removeItem(V1_STORAGE_KEY)
  store.removeItem(V2_STORAGE_KEY)
  const text = store.getItem(STORAGE_KEY)
  return text === null ? starterBook() : deserialize(text)
}

export function save(store: KeyValueStore, book: Book): void {
  store.setItem(STORAGE_KEY, serialize(book))
}

/** The coin last viewed, if it is still in the book. */
export function loadView(store: KeyValueStore, book: Book): string | null {
  const ticker = store.getItem(VIEW_KEY)
  return ticker !== null && findCoin(ticker) && book.coins[ticker] ? ticker : null
}

export function saveView(store: KeyValueStore, ticker: string | null): void {
  if (ticker === null) store.removeItem(VIEW_KEY)
  else store.setItem(VIEW_KEY, ticker)
}

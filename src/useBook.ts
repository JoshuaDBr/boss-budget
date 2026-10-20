import { useCallback, useMemo, useRef, useState } from 'react'
import { addCoin, addedCoins, changeCategories, changeCoin, removeCoin, type Book } from './ledger/book'
import { findCoin, type Coin } from './ledger/coins'
import { snapshot, type Budget, type Snapshot } from './ledger/ledger'
import { load, loadView, save, saveView } from './ledger/storage'

export type BookState =
  | {
      book: Book
      /** The coin on screen, or null while no coin has been added. */
      coin: Coin | null
      /** The coin on screen; with no coin, the shared categories, all at zero. */
      snapshot: Snapshot
      error?: undefined
    }
  | { book?: undefined; coin?: undefined; snapshot?: undefined; error: string }

/** Whether a change is made to the coin on screen, or to the categories every coin shares. */
export type Scope = 'coin' | 'categories'

export interface BookStore {
  state: BookState
  /**
   * Applies one ledger operation and saves the result to this browser straight away.
   * Returns null on success, or the reason it was refused; the screen then keeps the old book.
   */
  update: (change: (budget: Budget) => Budget, scope: Scope) => string | null
  /** Adds a coin and puts it on screen. */
  add: (ticker: string) => string | null
  /** Permanently erases a coin. If it was on screen, the next coin in ticker order (wrapping) takes its place. */
  remove: (ticker: string) => string | null
  /** Puts another coin on screen. */
  view: (ticker: string) => void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function stateOf(book: Book, ticker: string | null): BookState {
  const coin = ticker === null ? null : (findCoin(ticker) ?? null)
  return { book, coin, snapshot: snapshot(coin ? book.coins[coin.ticker] : book.categories) }
}

/** The coin after `ticker` in ticker order, wrapping round; null if no other coin has been added. */
function nextAfter(book: Book, ticker: string): string | null {
  const coins = addedCoins(book).map(c => c.ticker)
  const after = coins.find(t => t > ticker) ?? coins[0]
  return after ?? null
}

/**
 * Applies a change to the latest state (`read`), saves the result and hands it to `write`. Each change builds on the one
 * before it, even when two come before the screen has caught up, so neither is lost.
 */
export function makeCommit(read: () => BookState, write: (next: BookState) => void, storage: Storage) {
  return (change: (book: Book) => Book, ticker: (book: Book) => string | null): string | null => {
    const state = read()
    if (!state.book) return 'The saved budget could not be read, so it cannot be changed'
    try {
      const book = change(state.book)
      const next = stateOf(book, ticker(book))
      save(storage, book)
      saveView(storage, next.coin?.ticker ?? null)
      write(next)
      return null
    } catch (e) {
      return message(e)
    }
  }
}

/**
 * Reads the book saved in this browser (or the starter categories with no coins if nothing is saved yet), and opens
 * on the coin last viewed. Damaged saved data is reported, never replaced, and no changes are accepted on top of it.
 */
export function useBook(): BookStore {
  const [state, setState] = useState<BookState>(() => {
    try {
      const book = load(window.localStorage)
      return stateOf(book, loadView(window.localStorage, book) ?? addedCoins(book)[0]?.ticker ?? null)
    } catch (e) {
      return { error: message(e) }
    }
  })

  // The latest state, ahead of the screen: every change reads and writes it, so none builds on an older copy.
  const latest = useRef(state)
  const write = useCallback((next: BookState) => {
    latest.current = next
    setState(next)
  }, [])
  const commit = useMemo(() => makeCommit(() => latest.current, write, window.localStorage), [write])
  const onScreen = () => latest.current.coin?.ticker ?? null

  const update = useCallback(
    (change: (budget: Budget) => Budget, scope: Scope) => {
      const on = onScreen()
      if (scope === 'categories') return commit(book => changeCategories(book, change), () => on)
      if (on === null) return 'Add a currency first'
      return commit(book => changeCoin(book, on, change), () => on)
    },
    [commit],
  )
  const add = useCallback((ticker: string) => commit(book => addCoin(book, ticker), () => ticker), [commit])
  const remove = useCallback(
    (ticker: string) => {
      const on = onScreen()
      return commit(book => removeCoin(book, ticker), book => (ticker === on ? nextAfter(book, ticker) : on))
    },
    [commit],
  )
  const view = useCallback(
    (ticker: string) => {
      const { book } = latest.current
      if (!book?.coins[ticker]) return
      saveView(window.localStorage, ticker)
      write(stateOf(book, ticker))
    },
    [write],
  )

  return { state, update, add, remove, view }
}

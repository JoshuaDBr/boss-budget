import { COINS, findCoin, type Coin } from './coins'
import {
  BudgetError,
  READY_TO_ASSIGN,
  addCategory,
  emptyBudget,
  snapshot,
  starterBudget,
  type Budget,
  type Category,
} from './ledger'

// The book holds every coin's budget, plus the categories they all share.
//
// `categories` is a budget that only ever adds, renames and deletes categories: it never holds money. It is what a coin
// starts from, and what the categories table shows while no coin has been added. Each coin's budget repeats every
// category change with the same id, so a category has one id in every coin. A category change is made to all of them
// at once, or (if any one refuses it) to none.

export interface Book {
  readonly categories: Budget
  /** One budget per coin added, by ticker. Deleting a coin removes its budget entirely. */
  readonly coins: Readonly<Record<string, Budget>>
}

const CATEGORY_KINDS = new Set(['addCategory', 'deleteCategory', 'renameCategory'])

/** The first open: the starter categories and no coins. */
export function starterBook(): Book {
  return { categories: starterBudget(), coins: {} }
}

/** The coins added so far, in ticker order. */
export const addedCoins = (book: Book): Coin[] => COINS.filter(c => book.coins[c.ticker] !== undefined)

/** Adds a coin with every current category at zero, its own Ready to Assign at zero, and an empty history. */
export function addCoin(book: Book, ticker: string): Book {
  if (!findCoin(ticker)) throw new BudgetError(`Unknown coin: ${ticker}`)
  if (book.coins[ticker]) throw new BudgetError(`${ticker} has already been added`)
  let budget: Budget = { coin: ticker, ...emptyBudget() }
  for (const category of snapshot(book.categories).categories) {
    if (category.id !== READY_TO_ASSIGN) budget = addCategory(budget, category.name, category.id)
  }
  return checked({ ...book, coins: { ...book.coins, [ticker]: budget } })
}

/** Permanently erases a coin's balances and history. The categories, and every other coin, are unchanged. */
export function removeCoin(book: Book, ticker: string): Book {
  if (!book.coins[ticker]) throw new BudgetError(`${ticker} has not been added`)
  const coins = { ...book.coins }
  delete coins[ticker]
  return { ...book, coins }
}

/** Applies a deposit, spend, move, edit or delete of a transaction to one coin. */
export function changeCoin(book: Book, ticker: string, change: (budget: Budget) => Budget): Book {
  const budget = book.coins[ticker]
  if (!budget) throw new BudgetError(`${ticker} has not been added`)
  return checked({ ...book, coins: { ...book.coins, [ticker]: change(budget) } })
}

/**
 * Adds, renames or deletes a category in every coin at once. The change must give the same id every time it is
 * applied (pass the id in, rather than letting it make a new one). If any coin refuses it, nothing changes.
 */
export function changeCategories(book: Book, change: (budget: Budget) => Budget): Book {
  const coins: Record<string, Budget> = {}
  for (const [ticker, budget] of Object.entries(book.coins)) coins[ticker] = change(budget)
  return checked({ categories: change(book.categories), coins })
}

const names = (categories: readonly Category[]) => categories.map(c => `${c.id}:${c.name}`).join('\n')

/**
 * Checks the whole book: the shared categories hold no money, every coin is on the list and replays cleanly,
 * and every coin has exactly the shared categories, in the same order, under the same ids and names.
 * Throws BudgetError if not.
 */
export function checkBook(book: Book): void {
  if (book.categories.coin !== undefined || book.categories.entries.some(e => !CATEGORY_KINDS.has(e.kind))) {
    throw new BudgetError('The shared categories cannot hold money')
  }
  const shared = names(snapshot(book.categories).categories)
  for (const [ticker, budget] of Object.entries(book.coins)) {
    if (!findCoin(ticker) || budget.coin !== ticker) throw new BudgetError(`Unknown coin: ${ticker}`)
    if (names(snapshot(budget).categories) !== shared) {
      throw new BudgetError(`${ticker}'s categories do not match the shared categories`)
    }
  }
}

function checked(book: Book): Book {
  checkBook(book)
  return book
}

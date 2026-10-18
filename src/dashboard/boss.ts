// The Boss View reads every coin added at once. Nothing here changes the book.

import { addedCoins, type Book } from '../ledger/book'
import { READY_TO_ASSIGN, snapshot, type Category, type Transaction } from '../ledger/ledger'

/** How many coins hold more than zero in at least one category other than Ready to Assign. BOSS needs two. */
export const holdingCount = (book: Book | undefined) =>
  book
    ? addedCoins(book).filter(c => snapshot(book.coins[c.ticker]).categories.some(k => k.id !== READY_TO_ASSIGN && k.balance > 0n))
        .length
    : 0

export const BOSS_MIN = 2

/** A transaction, with the coin it belongs to and its category's name (null once that category is deleted). */
export interface BossTransaction extends Transaction {
  ticker: string
  category: string | null
}

/** A category's balance in each coin, in that coin's smallest unit. */
export interface BossCategory extends Category {
  balances: { ticker: string; units: bigint }[]
}

export interface BossData {
  transactions: BossTransaction[]
  /** Every category in the order added. Ready to Assign is not listed. */
  categories: BossCategory[]
}

export function bossData(book: Book): BossData {
  const coins = addedCoins(book).map(c => ({ ticker: c.ticker, snap: snapshot(book.coins[c.ticker]) }))
  return {
    transactions: coins.flatMap(({ ticker, snap }) =>
      snap.transactions.map(t => ({ ...t, ticker, category: snap.categories.find(k => k.id === t.from)?.name ?? null })),
    ),
    categories: snapshot(book.categories)
      .categories.filter(k => k.id !== READY_TO_ASSIGN)
      .map(k => ({
        ...k,
        balances: coins.map(({ ticker, snap }) => ({ ticker, units: snap.categories.find(x => x.id === k.id)?.balance ?? 0n })),
      })),
  }
}

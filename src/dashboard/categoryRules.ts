import { formatAmount, parseAmount } from '../ledger/amount'
import type { Coin } from '../ledger/coins'
import { addedCoins, type Book } from '../ledger/book'
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, READY_TO_ASSIGN, snapshot, type Category } from '../ledger/ledger'

// The rules the pop-ups apply before anything reaches the ledger.
// The ledger enforces the same limits again on Save, so these only decide what the screen allows.

export type NameProblem = 'blank' | 'duplicate' | 'tooLong'

/** Why a new category name cannot be saved, or null if it can. Duplicates ignore capitals. */
export function nameProblem(name: string, categories: readonly Category[]): NameProblem | null {
  const trimmed = name.trim()
  if (!trimmed) return 'blank'
  if ([...trimmed].length > MAX_NAME_LENGTH) return 'tooLong'
  const lower = trimmed.toLowerCase()
  return categories.some(c => c.name.toLowerCase() === lower) ? 'duplicate' : null
}

/** A category can give money only if it holds some, and it cannot be the category already chosen as To. */
export const canMoveFrom = (category: Category, to?: string) => category.balance > 0n && category.id !== to

/** Any category can receive money except the one it comes from. */
export const canMoveTo = (category: Category, from?: string) => category.id !== from

/** Spending needs a category that holds some money, and never Ready to Assign. */
export const canSpendFrom = (category: Category) => category.id !== READY_TO_ASSIGN && category.balance > 0n

/** Every category except Ready to Assign can be deleted. */
export const canDelete = (category: Category) => category.id !== READY_TO_ASSIGN

export type AmountCheck = { units: bigint; problem?: undefined } | { units?: undefined; problem: string }

/**
 * Checks a typed amount in the coin on screen: above zero, at most the coin's decimal places, and no more than the From balance
 * (a deposit has no From, so no upper limit). Only "more than the From balance" carries a message for the screen; any other problem just keeps Save dull.
 */
export function checkAmount(input: string, coin: Coin, from?: Category): AmountCheck {
  const units = parseAmount(input, coin.decimals)
  if (units === null || units <= 0n) return { problem: '' }
  if (from && units > from.balance) {
    return { problem: `${from.name} holds only ${formatAmount(from.balance, coin.decimals)} ${coin.ticker}` }
  }
  return { units }
}

/** The tickers of every coin in which a category holds a balance other than zero (a deficit counts), alphabetical. */
export function holders(book: Book, id: string): string[] {
  return addedCoins(book)
    .filter(c => (snapshot(book.coins[c.ticker]).categories.find(x => x.id === id)?.balance ?? 0n) !== 0n)
    .map(c => c.ticker)
    .sort()
}

/** "BTC", "BTC and ETH", "BTC, ETH, and XMR": a list with the Oxford comma. */
function list(items: readonly string[]): string {
  if (items.length < 3) return items.join(' and ')
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/**
 * The confirmation shown before a category is deleted. It names every coin in which the category holds a balance
 * (see holders), and leaves that sentence out when there are none.
 */
export function deleteMessage(name: string, tickers: readonly string[]): string {
  const question = `Are you sure that you want to delete "${name}"?`
  if (tickers.length === 0) return `${question} Past transactions may become unassigned.`
  const hold = tickers.length === 1 ? 'currently holds a balance' : 'currently hold balances'
  return `${question} ${list(tickers)} ${hold} in this category. All balances and deficits will be moved to "Ready to Assign," and past transactions may become unassigned.`
}

/**
 * The note box's text after typing, counting characters the way the ledger does (an emoji is one), up to 30. Typing
 * into a full note is refused; a paste that runs over keeps its first characters.
 */
export function capNote(next: string, previous: string): string {
  const characters = [...next]
  if (characters.length <= MAX_NOTE_LENGTH) return next
  return [...previous].length >= MAX_NOTE_LENGTH ? previous : characters.slice(0, MAX_NOTE_LENGTH).join('')
}

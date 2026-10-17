import { formatAmount, parseAmount } from '../ledger/amount'
import type { Coin } from '../ledger/coins'
import { MAX_NAME_LENGTH, READY_TO_ASSIGN, type Category } from '../ledger/ledger'

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

/**
 * The confirmation shown before a category is deleted. The sentence about money is left out when it holds nothing
 * in the coin on screen, and always while no coin has been added.
 */
export function deleteMessage(category: Category, coin: Coin | null): string {
  const question = `Are you sure that you want to delete ${category.name}?`
  return coin && category.balance > 0n
    ? `${question} ${formatAmount(category.balance, coin.decimals)} ${coin.ticker} will be moved to Ready to Assign, and past transactions may become unassigned.`
    : `${question} Past transactions may become unassigned.`
}

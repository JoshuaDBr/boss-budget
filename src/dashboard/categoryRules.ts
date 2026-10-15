import { formatXmr, parseXmr } from '../ledger/piconero'
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

/** A category can give XMR only if it holds some, and it cannot be the category already chosen as To. */
export const canMoveFrom = (category: Category, to?: string) => category.balance > 0n && category.id !== to

/** Any category can receive XMR except the one it comes from. */
export const canMoveTo = (category: Category, from?: string) => category.id !== from

/** Spending needs a category that holds some XMR, and never Ready to Assign. */
export const canSpendFrom = (category: Category) => category.id !== READY_TO_ASSIGN && category.balance > 0n

/** Every category except Ready to Assign can be deleted. */
export const canDelete = (category: Category) => category.id !== READY_TO_ASSIGN

export type AmountCheck = { piconero: bigint; problem?: undefined } | { piconero?: undefined; problem: string }

/**
 * Checks a typed amount: above zero, at most 12 decimal places, and no more than the From balance
 * (a deposit has no From, so no upper limit). Only "more than the From balance" carries a message for the screen; any other problem just keeps Save dull.
 */
export function checkAmount(input: string, from?: Category): AmountCheck {
  const piconero = parseXmr(input)
  if (piconero === null || piconero <= 0n) return { problem: '' }
  if (from && piconero > from.balance) {
    return { problem: `${from.name} holds only ${formatXmr(from.balance)} XMR` }
  }
  return { piconero }
}

/** The confirmation shown before a category is deleted. The XMR sentence is left out when it holds nothing. */
export function deleteMessage(category: Category): string {
  const question = `Are you sure that you want to delete ${category.name}?`
  return category.balance > 0n
    ? `${question} ${formatXmr(category.balance)} XMR will be moved to Ready to Assign, and past transactions may become unassigned.`
    : `${question} Past transactions may become unassigned.`
}

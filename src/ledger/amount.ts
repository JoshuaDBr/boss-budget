// Amounts are stored as whole numbers of each coin's smallest unit (1 XMR = 1,000,000,000,000 piconero,
// 1 BTC = 100,000,000 satoshi, 1 ETH = 10^18 wei). bigint keeps every amount exact: no floating-point rounding,
// no size limit. `decimals` is the coin's number of decimal places.

const unitsPerCoin = (decimals: number) => 10n ** BigInt(decimals)

/** Parses a user-typed amount ("12", "12.5", "0.000000000001") into the smallest unit. Returns null if invalid. */
export function parseAmount(input: string, decimals: number): bigint | null {
  const match = new RegExp(`^(\\d+)(?:\\.(\\d{1,${decimals}}))?$`).exec(input.trim())
  if (!match) return null
  const whole = BigInt(match[1])
  const fraction = BigInt((match[2] ?? '').padEnd(decimals, '0'))
  return whole * unitsPerCoin(decimals) + fraction
}

/** Whether typed text could still become a valid amount: digits, at most one point, and at most `decimals` digits after it. */
export const isAmountDraft = (input: string, decimals: number) => new RegExp(`^\\d*(?:\\.\\d{0,${decimals}})?$`).test(input)

/** Formats an amount with all of the coin's decimal places ("12.500000000000", "0.000000000001" for XMR). */
export function formatAmount(units: bigint, decimals: number): string {
  const sign = units < 0n ? '-' : ''
  const abs = units < 0n ? -units : units
  const whole = abs / unitsPerCoin(decimals)
  const fraction = (abs % unitsPerCoin(decimals)).toString().padStart(decimals, '0')
  return `${sign}${whole}.${fraction}`
}

/** How many decimal places the short displays show, for every coin. */
export const SHORT_DECIMALS = 6

/**
 * Formats an amount with six decimal places, cut (not rounded) for display only ("12.500000", "0.004213").
 * A coin with six or fewer decimal places shows all of them. The stored amount always keeps every place.
 */
export function formatShort(units: bigint, decimals: number): string {
  const full = formatAmount(units, decimals)
  return decimals > SHORT_DECIMALS ? full.slice(0, SHORT_DECIMALS - decimals) : full
}

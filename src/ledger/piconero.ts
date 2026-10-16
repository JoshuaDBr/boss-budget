// XMR amounts are stored as whole numbers of piconero (1 XMR = 1,000,000,000,000 piconero).
// bigint keeps every amount exact: no floating-point rounding, no size limit.

export const PICONERO_PER_XMR = 1_000_000_000_000n
const XMR_DECIMALS = 12

const XMR_PATTERN = /^(\d+)(?:\.(\d{1,12}))?$/

/** Parses a user-typed XMR amount ("12", "12.5", "0.000000000001") into piconero. Returns null if invalid. */
export function parseXmr(input: string): bigint | null {
  const match = XMR_PATTERN.exec(input.trim())
  if (!match) return null
  const whole = BigInt(match[1])
  const fraction = BigInt((match[2] ?? '').padEnd(XMR_DECIMALS, '0'))
  return whole * PICONERO_PER_XMR + fraction
}

/** Whether typed text could still become a valid amount: digits, at most one point, and at most 12 digits after it. */
export const isXmrDraft = (input: string) => /^\d*(?:\.\d{0,12})?$/.test(input)

/** Formats piconero as an XMR string with all twelve decimal places ("12.500000000000", "0.000000000001"). */
export function formatXmr(piconero: bigint): string {
  const sign = piconero < 0n ? '-' : ''
  const abs = piconero < 0n ? -piconero : piconero
  const whole = abs / PICONERO_PER_XMR
  const fraction = (abs % PICONERO_PER_XMR).toString().padStart(XMR_DECIMALS, '0')
  return `${sign}${whole}.${fraction}`
}

const SHORT_DECIMALS = 4

/**
 * Formats piconero with four decimal places, cut (not rounded) for display only ("12.5000", "0.0042").
 * The stored amount keeps all twelve.
 */
export function formatXmrShort(piconero: bigint): string {
  return formatXmr(piconero).slice(0, SHORT_DECIMALS - XMR_DECIMALS)
}

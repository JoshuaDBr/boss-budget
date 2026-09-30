// XRP amounts are stored as whole numbers of drops (1 XRP = 1,000,000 drops).
// bigint keeps every amount exact: no floating-point rounding, no size limit.

export const DROPS_PER_XRP = 1_000_000n
const XRP_DECIMALS = 6

const XRP_PATTERN = /^(\d+)(?:\.(\d{1,6}))?$/

/** Parses a user-typed XRP amount ("12", "12.5", "0.000001") into drops. Returns null if invalid. */
export function parseXrp(input: string): bigint | null {
  const match = XRP_PATTERN.exec(input.trim())
  if (!match) return null
  const whole = BigInt(match[1])
  const fraction = BigInt((match[2] ?? '').padEnd(XRP_DECIMALS, '0'))
  return whole * DROPS_PER_XRP + fraction
}

/** Formats drops as an XRP string with trailing zeros trimmed ("12.5", "0.000001", "3"). */
export function formatXrp(drops: bigint): string {
  const sign = drops < 0n ? '-' : ''
  const abs = drops < 0n ? -drops : drops
  const whole = abs / DROPS_PER_XRP
  const fraction = (abs % DROPS_PER_XRP).toString().padStart(XRP_DECIMALS, '0').replace(/0+$/, '')
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}

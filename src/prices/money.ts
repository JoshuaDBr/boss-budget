// Dollar values. Every one is the coin amount times today's price, past transactions included.

import { findCoin } from '../ledger/coins'

/** $1,234.57: two decimals, rounded normally, with commas. A negative value reads -$51.71. */
export function usd(value: number): string {
  const text = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value < 0 && text !== '0.00' ? '-' : ''}$${text}`
}

/** $586.02000: five decimals, for the prices on the graphs. */
export const usd5 = (value: number) => '$' + value.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })

/** A coin amount, in its smallest unit, in dollars at `price`. Null with no price. */
export function toDollars(units: bigint, ticker: string, price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null
  return (Number(units) / 10 ** findCoin(ticker)!.decimals) * price
}

/** Adds dollar values; null if any of them is unknown. */
export const sumDollars = (values: readonly (number | null)[]) =>
  values.some(v => v === null) ? null : values.reduce<number>((a, v) => a + (v as number), 0)

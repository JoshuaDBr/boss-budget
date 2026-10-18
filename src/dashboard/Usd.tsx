import { usd } from '../prices/money'

/**
 * A dollar value: $1,234.57, $-,-- with no price yet. A negative balance is red. `sign` marks a deposit (+) or a
 * spend (-) the way the coin column does: the sign is shown, in black.
 */
export default function Usd({ value, muted, sign }: { value: number | null; muted?: boolean; sign?: '+' | '-' }) {
  if (value === null) return <span className="muted">$-,--</span>
  if (sign) return <span>{sign}{usd(Math.abs(value))}</span>
  return <span className={value < 0 && usd(value).startsWith('-') ? 'neg' : muted ? 'muted' : undefined}>{usd(value)}</span>
}

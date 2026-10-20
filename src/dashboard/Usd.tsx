import { usd } from '../prices/money'
import Fitted from './Fitted'

interface Props {
  value: number | null
  muted?: boolean
  sign?: '+' | '-'
}

/** The text of a dollar value, and its class: muted with no price yet, red when a balance is negative. */
export function usdView({ value, muted, sign }: Props): { text: string; className?: string } {
  if (value === null) return { text: '$-,--', className: 'muted' }
  if (sign) return { text: `${sign}${usd(Math.abs(value))}` }
  return { text: usd(value), className: value < 0 && usd(value).startsWith('-') ? 'neg' : muted ? 'muted' : undefined }
}

/**
 * A dollar value: $1,234.57, $-,-- with no price yet. A negative balance is red. `sign` marks a deposit (+) or a
 * spend (-) the way the coin column does: the sign is shown, in black.
 */
export default function Usd(props: Props) {
  const { text, className } = usdView(props)
  return <span className={className}>{text}</span>
}

/** A dollar value fitted to its box (see Fitted). */
export function FittedUsd({ shrink, ...props }: Props & { shrink?: boolean }) {
  return <Fitted {...usdView(props)} shrink={shrink} />
}

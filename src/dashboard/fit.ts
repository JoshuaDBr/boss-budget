// Long amounts (ETH keeps 18 decimal places; a deposit may have 12 whole digits) do not always fit their box. The
// display rules of 0.4.1 decide what shows instead. Every box first shows the full value if it fits:
//
// - Letters: from 1,000 up, K, M or B with two decimals, rounded (12,345,678.90 → 12.35M; 999,999 → 1.00M).
// - Cut "…": under 1,000, decimal digits are dropped (never rounded) until the text fits, then it ends in "…".
//   Whole-number digits are never cut.
//
// The full views and the pop-up dollar box go straight to letters or "…", and show the expand symbol beside a
// shortened value (see Fitted.tsx). The corner box and holdings first shrink the font, down to 11px, and have no
// expand symbol. "Fits" is measured in pixels, at the box's real width and font.

/** The smallest font size, in px, a value may shrink to. */
export const FLOOR = 11

/** Measures text, in px, at a font size in px. */
export type Measure = (text: string, size: number) => number

/** What a box shows: the text, a smaller font size if it shrank, and whether the text was shortened. */
export interface Fitted {
  text: string
  size?: number
  shortened: boolean
}

// An amount as the screen writes it: an optional sign, an optional $, the whole digits (commas allowed), the decimals,
// and anything after it, such as a ticker (" XTM").
const AMOUNT = /^([+-]?)(\$?)(\d[\d,]*)(?:\.(\d*))?(.*)$/

const LETTERS = ['', 'K', 'M', 'B']

/** "+$1,234.57" → "+$1.23K"; "-12345678.90" → "-12.35M". Null if the text is not an amount, or is under 1,000. */
export function letters(text: string): string | null {
  const match = AMOUNT.exec(text)
  if (!match) return null
  const [, sign, dollar, wholeText, fraction = '', rest] = match
  const whole = wholeText.replace(/,/g, '').replace(/^0+(?=\d)/, '')
  if (whole.length < 4) return null
  const digits = whole + fraction
  // The largest letter that keeps a whole digit in front, then up one more if rounding reaches 1000.00.
  for (let k = Math.min(LETTERS.length - 1, Math.floor((whole.length - 1) / 3)); k < LETTERS.length; k++) {
    const keep = whole.length - 3 * k + 2
    let hundredths = BigInt(digits.slice(0, keep).padEnd(keep, '0'))
    if ((digits[keep] ?? '0') >= '5') hundredths++
    if (hundredths >= 100_000n && k < LETTERS.length - 1) continue
    const cents = String(hundredths % 100n).padStart(2, '0')
    return `${sign}${dollar}${hundredths / 100n}.${cents}${LETTERS[k]}${rest}`
  }
  return null
}

/**
 * "123.456789 XMR" → "123.45… XMR": drops decimal digits from the end, never rounding, until `fits`, then ends the
 * number in "…". Whole-number digits are never cut; with every decimal gone it reads "123…". Null if nothing can be cut.
 */
export function cut(text: string, fits: (text: string) => boolean): string | null {
  const match = AMOUNT.exec(text)
  if (!match || !match[4]) return null
  const [, sign, dollar, whole, fraction, rest] = match
  let shown = ''
  for (let keep = fraction.length - 1; keep >= 0; keep--) {
    shown = `${sign}${dollar}${whole}${keep ? '.' + fraction.slice(0, keep) : ''}…${rest}`
    if (fits(shown)) break
  }
  return shown
}

/** Whether an amount's text is 1,000 or more, ignoring its sign. */
const thousands = (text: string) => {
  const match = AMOUNT.exec(text)
  return match !== null && match[3].replace(/,/g, '').replace(/^0+(?=\d)/, '').length > 3
}

interface Options {
  /** The box's normal font size, in px. */
  size: number
  /** Shrink the font, down to 11px, before shortening (the corner box and holdings). */
  shrink?: boolean
  /** Room, in px, kept free for the expand symbol once the text is shortened. */
  reserve?: number
}

/** What `text` should show in a box `room` px wide, following the display rules above. */
export function fitValue(text: string, room: number, measure: Measure, { size, shrink = false, reserve = 0 }: Options): Fitted {
  const fits = (t: string, at: number, space = room) => measure(t, at) <= space
  if (fits(text, size)) return { text, shortened: false }
  let at = size
  if (shrink) {
    // The width grows with the font size, so start from the size in proportion and step down if rounding misses.
    for (at = Math.max(FLOOR, Math.floor((size * room) / measure(text, size))); at > FLOOR && !fits(text, at); at--);
    if (fits(text, at)) return { text, size: at, shortened: false }
  }
  const space = room - reserve
  const short = thousands(text) ? letters(text) : cut(text, t => fits(t, at, space))
  return short === null ? { text, ...(at !== size && { size: at }), shortened: false } : { text: short, ...(at !== size && { size: at }), shortened: true }
}

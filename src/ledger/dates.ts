// Transaction dates are stored as ISO "yyyy-mm-dd" strings and shown as "mm/dd/yyyy".

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Whether text is a real calendar date in "yyyy-mm-dd" form (so 2026-02-30 is not). */
export function isIsoDate(text: string): boolean {
  const match = ISO_PATTERN.exec(text)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Today's date on this device, as "yyyy-mm-dd". */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The time of day on this device, to the second, as "hh:mm:ss" (24-hour). */
export function clockTime(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

/** Whether text is a real time of day in "hh:mm:ss" form. */
export const isClockTime = (text: string) => /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(text)

/** "2026-10-14" → "10/14/2026". */
export function isoToUs(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year}`
}

/** "2026-10-14" → "10142026", the digits the Date box holds. */
export const isoToDigits = (iso: string) => isoToUs(iso).replace(/\//g, '')

/** "10142026" → "2026-10-14", or null unless all eight digits make a real date. */
export function digitsToIso(digits: string): string | null {
  if (!/^\d{8}$/.test(digits)) return null
  const iso = `${digits.slice(4)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`
  return isIsoDate(iso) ? iso : null
}

/** Shows up to eight typed digits with the slashes in their fixed places: "1014" → "10/14", "101420" → "10/14/20". */
export function formatDateDigits(digits: string): string {
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

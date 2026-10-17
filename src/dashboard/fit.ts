// A coin's full amount can be long (ETH keeps 18 decimal places), so a cell shrinks its font to keep the whole
// number in view instead of cutting it off. `room` is how many characters fit at the cell's normal size.

/** The font size, in px, that fits `text` into a cell made for `room` characters at `size` px. Never below 11px. */
export function fitFont(text: string, room: number, size: number): number | undefined {
  return text.length <= room ? undefined : Math.max(11, Math.floor((size * room) / text.length))
}

interface Props {
  /** Why BOSS cannot be clicked right now, if it cannot. */
  blocked: string | null
  /** True in the Boss View, where BOSS is enlarged over most of the wheel's area. */
  on: boolean
  onToggle: () => void
}

/** BOSS turns the dashboard into the Boss View in place. Clicking it again returns to the coin's dashboard. */
export default function BossButton({ blocked, on, onToggle }: Props) {
  return (
    <div id="bossC" className={on ? 'comp big' : 'comp'}>
      <button
        id="bossBtn"
        type="button"
        className={blocked ? 'dull' : undefined}
        aria-disabled={blocked ? true : undefined}
        aria-pressed={on}
        title={blocked ?? undefined}
        onClick={blocked ? undefined : onToggle}
      >
        BOSS
      </button>
    </div>
  )
}

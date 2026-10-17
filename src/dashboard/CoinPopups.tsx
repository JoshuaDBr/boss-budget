import { byName, coinLabel, COINS, findCoin, type Coin } from '../ledger/coins'

// The two centered pop-ups for coins: adding one, and permanently deleting one.

export type CoinPop = { kind: 'addCoin'; pick: string | null } | { kind: 'deleteCoin'; ticker: string; typed: string }

interface Props {
  pop: CoinPop
  /** The coins already added; the Add list hides them. */
  added: readonly Coin[]
  error: string | null
  onChange: (pop: CoinPop) => void
  onAdd: (ticker: string) => void
  onDelete: (ticker: string) => void
  onCancel: () => void
}

/** Delete is enabled only once "delete" is typed, in any case. */
export const confirmsDelete = (typed: string) => typed.trim().toLowerCase() === 'delete'

export default function CoinPopup({ pop, added, error, onChange, onAdd, onDelete, onCancel }: Props) {
  if (pop.kind === 'addCoin') {
    const left = byName(COINS.filter(c => !added.some(a => a.ticker === c.ticker)))
    return (
      <section className="comp box midPop" role="dialog" aria-label="Add a Currency">
        <h2 className="midTitle">Add a Currency</h2>
        <ul className="coinList" role="listbox" aria-label="Currencies">
          {left.map(c => (
            <li key={c.ticker} role="option" aria-selected={pop.pick === c.ticker}>
              <button type="button" className={pop.pick === c.ticker ? 'sel' : undefined} onClick={() => onChange({ ...pop, pick: c.ticker })}>
                {coinLabel(c)}
              </button>
            </li>
          ))}
        </ul>
        <div className="popFoot">
          <span className={error ? 'popNote err' : 'popNote'}>{error ?? ''}</span>
          <button type="button" className="pb" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={pop.pick ? 'pb main' : 'pb main dull'}
            aria-disabled={pop.pick ? undefined : true}
            onClick={pop.pick ? () => onAdd(pop.pick!) : undefined}
          >
            Add
          </button>
        </div>
      </section>
    )
  }

  const coin = findCoin(pop.ticker)
  if (!coin) return null
  const label = coinLabel(coin)
  const ok = confirmsDelete(pop.typed)
  return (
    <section className="comp box midPop pop-delete" role="dialog" aria-label={`Delete ${label}`}>
      <h2 className="midTitle">Delete {label}</h2>
      <p className="midBody">
        Warning, deleting your {label} budget is a permanent action. All {label} balances and history will be unrecoverable.
        Are you sure that you want to continue?
      </p>
      <p className="midBody typeHint">To confirm, type "delete"</p>
      <div className="fld typeBox on">
        <input
          aria-label='Type "delete" to confirm'
          value={pop.typed}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          onChange={e => onChange({ ...pop, typed: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && ok && onDelete(pop.ticker)}
        />
      </div>
      <div className="popFoot">
        <span className={error ? 'popNote err' : 'popNote'}>{error ?? ''}</span>
        <button type="button" className="pb" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className={ok ? 'pb main' : 'pb main dull'}
          aria-disabled={ok ? undefined : true}
          onClick={ok ? () => onDelete(pop.ticker) : undefined}
        >
          Delete
        </button>
      </div>
    </section>
  )
}

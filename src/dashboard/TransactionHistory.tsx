import { isoToUs } from '../ledger/dates'
import type { Category, Snapshot, Transaction } from '../ledger/ledger'
import { formatAmount, formatShort } from '../ledger/amount'
import { fitFont } from './fit'
import { findCoin, type Coin } from '../ledger/coins'
import { useDollars } from '../prices/prices'
import { sumDollars } from '../prices/money'
import type { BossData } from './boss'
import Usd from './Usd'

// The history and the budget trade places. Normally the budget is in the central box and the corner shows the mini
// history. The corner arrow swaps them: the full history goes to the center and the corner shows the mini budget.

/** Newest first: by date, then by the order recorded. */
export const newestFirst = <T extends Transaction>(transactions: readonly T[]): T[] =>
  [...transactions].sort((a, b) => (a.date === b.date ? b.order - a.order : a.date < b.date ? 1 : -1))

/** "+" before a deposit's amount, "-" before a spend's. */
const sign = (t: Transaction) => (t.kind === 'deposit' ? '+' : '-')

/** A spend's category, or null if that category has been deleted. Deposits land in Ready to Assign. */
const categoryOf = (t: Transaction, categories: readonly Category[]) => categories.find(c => c.id === t.from) ?? null

interface CornerProps {
  snapshot?: Snapshot
  coin: Coin | null
  view: 'budget' | 'history'
  /** Why the arrow cannot be used right now (a pop-up is open), if it cannot. */
  blocked: string | null
  onSwap: () => void
  /** In the Boss View: every coin, in dollars only. */
  boss: BossData | null
}

/** The corner box: the mini history (display only), or the mini budget while the history is in the center. */
export function Corner({ snapshot, coin, view, blocked, onSwap, boss }: CornerProps) {
  const decimals = coin?.decimals ?? 0
  const dollars = useDollars()
  return (
    <>
      <section key={view} id="txC" className="comp" aria-label={view === 'budget' ? 'Transaction history' : 'Budget'}>
        <table className="tx">
          <tbody>
            {boss
              ? view === 'budget'
                ? newestFirst(boss.transactions).map(t => (
                    <tr key={t.ticker + t.id}>
                      <td className="date">{isoToUs(t.date)}</td>
                      <td className="note">{t.note}</td>
                      <td className="usd wide"><Usd value={dollars(t.amount, t.ticker)} sign={sign(t)} /></td>
                    </tr>
                  ))
                : boss.categories.map(c => (
                    <tr key={c.id}>
                      <td className="note">{c.name}</td>
                      <td className="usd wide"><Usd value={sumDollars(c.balances.map(b => dollars(b.units, b.ticker)))} /></td>
                    </tr>
                  ))
              : view === 'budget'
              ? newestFirst(snapshot?.transactions ?? []).map(t => (
                  <tr key={t.id}>
                    <td className="date">{isoToUs(t.date)}</td>
                    <td className="note">{t.note}</td>
                    <td className="usd"><Usd value={coin ? dollars(t.amount, coin.ticker) : null} sign={sign(t)} /></td>
                    <MiniAmount text={`${sign(t)}${formatShort(t.amount, decimals)}`} negative={false} />
                  </tr>
                ))
              : snapshot?.categories.map(c => (
                  <tr key={c.id}>
                    <td className="note">{c.name}</td>
                    <td className="usd"><Usd value={coin ? dollars(c.balance, coin.ticker) : null} /></td>
                    <MiniAmount text={coin ? formatShort(c.balance, decimals) : ''} negative={c.balance < 0n} />
                  </tr>
                ))}
          </tbody>
        </table>
      </section>
      <div id="txArrowC" className="comp">
        <button
          type="button"
          className={blocked ? 'arrow dull' : 'arrow'}
          aria-label={view === 'budget' ? 'Show the full history' : 'Show the budget'}
          aria-disabled={blocked ? true : undefined}
          onClick={blocked ? undefined : onSwap}
        >
          ↓{view === 'budget' && <span className="lab">all</span>}
        </button>
      </div>
    </>
  )
}

interface HistoryProps {
  snapshot: Snapshot
  coin: Coin | null
  /** Whether rows can be clicked right now (not while a pop-up is open). */
  editable: boolean
  onEdit: (transaction: Transaction) => void
}

/** The full history in the central box. Clicking a row opens it for editing. */
export function HistoryTable({ snapshot, coin, editable, onEdit }: HistoryProps) {
  const dollars = useDollars()
  return (
    <section id="tableC" className="comp box" aria-label="Transaction history">
      <div id="tblScroll">
        <table className="bud hist">
          <tbody>
            {newestFirst(snapshot.transactions).map(t => {
              const category = categoryOf(t, snapshot.categories)
              const amount = `${sign(t)}${formatAmount(t.amount, coin?.decimals ?? 0)}`
              const size = fitFont(amount, 17, 16)
              return (
                <tr key={t.id} className={editable ? 'choosable' : undefined} onClick={editable ? () => onEdit(t) : undefined}>
                  <td className="date">{isoToUs(t.date)}</td>
                  <td className="note">{t.note}</td>
                  <td className="hcat">
                    {t.kind === 'deposit' ? 'Ready to Assign' : category ? category.name : <span className="unassigned">Unassigned</span>}
                  </td>
                  <td><Usd value={coin ? dollars(t.amount, coin.ticker) : null} sign={sign(t)} /></td>
                  <td style={size ? { fontSize: size } : undefined}>{amount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="tfoot hist">
        <div className="c1">date</div>
        <div className="c1 note">note</div>
        <div className="c1 hcat">category</div>
        <div className="c2">USD</div>
        <div className="c3">{coin?.ticker ?? 'Crypto'}</div>
      </div>
    </section>
  )
}

/** The Boss View's full history: every coin, with a Ticker column. Rows cannot be clicked. */
export function BossHistoryTable({ boss }: { boss: BossData }) {
  const dollars = useDollars()
  return (
    <section id="tableC" className="comp box" aria-label="Transaction history, every coin">
      <div id="tblScroll">
        <table className="bud hist boss">
          <colgroup>
            <col style={{ width: 104 }} />
            <col />
            <col style={{ width: 140 }} />
            <col style={{ width: 104 }} />
            <col style={{ width: 176 }} />
            <col style={{ width: 62 }} />
          </colgroup>
          <tbody>
            {newestFirst(boss.transactions).map(t => {
              const amount = `${sign(t)}${formatAmount(t.amount, findCoin(t.ticker)!.decimals)}`
              const size = fitFont(amount, 15, 16)
              return (
                <tr key={t.ticker + t.id}>
                  <td className="date">{isoToUs(t.date)}</td>
                  <td className="note">{t.note}</td>
                  <td className="hcat">
                    {t.kind === 'deposit' ? 'Ready to Assign' : (t.category ?? <span className="unassigned">Unassigned</span>)}
                  </td>
                  <td><Usd value={dollars(t.amount, t.ticker)} sign={sign(t)} /></td>
                  <td style={size ? { fontSize: size } : undefined}>{amount}</td>
                  <td className="tick">{t.ticker}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="tfoot hist boss">
        <div className="c1">date</div>
        <div className="c1 note">note</div>
        <div className="c1 hcat">category</div>
        <div className="c2">USD</div>
        <div className="c3">amount</div>
        <div className="c4">Ticker</div>
      </div>
    </section>
  )
}

/** An amount in the corner box, shrunk to fit its narrow column when it is long. */
function MiniAmount({ text, negative }: { text: string; negative: boolean }) {
  const size = fitFont(text, 8, 14)
  return (
    <td className={negative ? 'num neg' : 'num'} style={size ? { fontSize: size } : undefined}>
      {text}
    </td>
  )
}

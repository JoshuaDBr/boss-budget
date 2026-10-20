import { useEffect, useRef, useState } from 'react'
import { formatShort } from '../ledger/amount'
import { COINS, type Coin } from '../ledger/coins'
import { useDollars } from '../prices/prices'
import { sumDollars } from '../prices/money'
import Fitted from './Fitted'
import { FittedUsd } from './Usd'

export interface Holding {
  coin: Coin
  total: bigint
}

interface Props {
  holdings: readonly Holding[]
  /** Why the buttons cannot be used right now (a pop-up is open, or the saved budget is damaged), if they cannot. */
  blocked: string | null
  onAdd: () => void
  onDelete: (ticker: string) => void
  /** In the Boss View, a grand total in dollars follows the last coin. */
  boss: boolean
}

/**
 * One row per added coin, in ticker order, then "+ Add a Currency". Each row's 3-dot button opens a menu whose only
 * option is Delete. The box scrolls, so the menu is drawn outside it, level with its row.
 */
export default function Holdings({ holdings, blocked, onAdd, onDelete, boss }: Props) {
  const [menu, setMenu] = useState<{ ticker: string; top: number } | null>(null)
  const dollars = useDollars()
  const box = useRef<HTMLElement>(null)
  const full = holdings.length === COINS.length

  // A click anywhere else, or scrolling the box, closes the menu.
  useEffect(() => {
    if (!menu) return
    const close = (e: Event) => {
      if (!(e.target instanceof Element && e.target.closest('[data-dot-menu]'))) setMenu(null)
    }
    const scrolled = () => setMenu(null)
    const scroller = box.current
    window.addEventListener('pointerdown', close, { capture: true })
    scroller?.addEventListener('scroll', scrolled)
    return () => {
      window.removeEventListener('pointerdown', close, { capture: true })
      scroller?.removeEventListener('scroll', scrolled)
    }
  }, [menu])
  useEffect(() => {
    if (blocked) setMenu(null)
  }, [blocked])

  const open = (ticker: string, button: HTMLElement) => {
    const row = button.closest('.mrow') as HTMLElement
    setMenu(menu?.ticker === ticker ? null : { ticker, top: row.offsetTop - (box.current?.scrollTop ?? 0) })
  }

  return (
    <div id="holdC" className="comp">
      <nav id="holdBox" ref={box} className="box" aria-label="Holdings">
        <div className="ttl">holdings</div>
        {holdings.map(({ coin, total }) => (
          <div key={coin.ticker} className="hrow mrow">
            <Total text={`${formatShort(total, coin.decimals)} ${coin.ticker}`} negative={total < 0n} />
            <small><FittedUsd value={dollars(total, coin.ticker)} muted shrink /></small>
            <button
              type="button"
              className={blocked ? 'dots dull' : 'dots'}
              data-dot-menu
              aria-label={`More for ${coin.ticker}`}
              aria-haspopup="menu"
              aria-expanded={menu?.ticker === coin.ticker}
              aria-disabled={blocked ? true : undefined}
              onClick={blocked ? undefined : e => open(coin.ticker, e.currentTarget)}
            >
              <svg viewBox="0 0 4 16" width="4" height="16" aria-hidden="true">
                <circle cx="2" cy="3" r="1.6" />
                <circle cx="2" cy="8" r="1.6" />
                <circle cx="2" cy="13" r="1.6" />
              </svg>
            </button>
          </div>
        ))}
        {boss && (
          <div className="hrow grand">
            <small>total</small>
            <FittedUsd value={sumDollars(holdings.map(h => dollars(h.total, h.coin.ticker)))} shrink />
          </div>
        )}
        <button
          type="button"
          className={blocked || full ? 'hrow addCoin dull' : 'hrow addCoin'}
          aria-disabled={blocked || full ? true : undefined}
          title={full ? 'Every currency has been added' : undefined}
          onClick={blocked || full ? undefined : onAdd}
        >
          + Add a Currency
        </button>
      </nav>
      {menu && (
        <div className="dotMenu" role="menu" data-dot-menu style={{ top: menu.top + 4 }}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null)
              onDelete(menu.ticker)
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

/** A coin's total, shrunk to fit beside the 3-dot button when it is long, then shortened (see fit.ts). */
function Total({ text, negative }: { text: string; negative: boolean }) {
  return <Fitted text={text} className={negative ? 'neg' : undefined} shrink />
}

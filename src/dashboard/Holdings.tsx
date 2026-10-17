import { formatShort } from '../ledger/amount'
import type { Coin } from '../ledger/coins'
import { OUT_OF_SCOPE, placeholder } from './placeholder'

export default function Holdings({ coin, total }: { coin: Coin | null; total?: bigint }) {
  return (
    <div id="holdC" className="comp">
      <nav id="holdBox" className="box" aria-label="Holdings">
        <div className="ttl">holdings</div>
        {coin && (
          <button className="hrow act" {...placeholder(OUT_OF_SCOPE)}>
            <span className={total !== undefined && total < 0n ? 'neg' : undefined}>
              {total === undefined ? '—' : formatShort(total, coin.decimals)} {coin.ticker}
            </span>
            <small>$-,--</small>
          </button>
        )}
      </nav>
    </div>
  )
}

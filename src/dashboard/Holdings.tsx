import { formatXmrShort } from '../ledger/piconero'
import { OUT_OF_SCOPE, placeholder } from './placeholder'

export default function Holdings({ total }: { total?: bigint }) {
  return (
    <div id="holdC" className="comp">
      <nav id="holdBox" className="box" aria-label="Holdings">
        <div className="ttl">holdings</div>
        <button className="hrow act" {...placeholder(OUT_OF_SCOPE)}>
          <span className={total !== undefined && total < 0n ? 'neg' : undefined}>{total === undefined ? '—' : formatXmrShort(total)} XMR</span>
          <small>$-,--</small>
        </button>
      </nav>
    </div>
  )
}

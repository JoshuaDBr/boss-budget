import { formatXrp } from '../ledger/drops'
import { OUT_OF_SCOPE, placeholder } from './placeholder'

export default function Holdings({ total }: { total?: bigint }) {
  return (
    <div id="holdC" className="comp">
      <nav id="holdBox" className="box" aria-label="Holdings">
        <div className="ttl">holdings</div>
        <button className="hrow act" {...placeholder(OUT_OF_SCOPE)}>
          <span>{total === undefined ? '—' : formatXrp(total)} XRP</span>
          <small>$0.00</small>
        </button>
      </nav>
    </div>
  )
}

import { OUT_OF_SCOPE, placeholder } from './placeholder'

// Placeholder transaction history: empty rows only. Transaction tracking is not part of V1.
const ROWS = 4

export default function TransactionHistory() {
  return (
    <>
      <section id="txC" className="comp" aria-label="Transaction history (placeholder)" title={OUT_OF_SCOPE}>
        <table className="tx">
          <tbody>
            {Array.from({ length: ROWS }, (_, i) => (
              <tr key={i}>
                <td className="desc">
                  <svg className="squig" viewBox="0 0 52 10" aria-hidden="true">
                    <path d="M1 6 q3 -6 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" fill="none" stroke="#bbb" strokeWidth="1.4" />
                  </svg>
                </td>
                <td className="num muted">$0.00</td>
                <td className="num muted">— XRP</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div id="txArrowC" className="comp">
        <button className="arrow" aria-label="Expand transaction history" {...placeholder(OUT_OF_SCOPE)}>
          ↓<span className="lab">all</span>
        </button>
      </div>
    </>
  )
}

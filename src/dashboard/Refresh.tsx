import { OUT_OF_SCOPE, placeholder } from './placeholder'

export default function Refresh() {
  return (
    <section id="refresh" className="comp">
      <button id="refreshBtn" aria-label="Refresh prices" {...placeholder(OUT_OF_SCOPE)}>
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <path d="M30 8 C16 8 8 19 9 31 C10 44 20 52 31 51 C43 50 51 41 51 30 C51 22 47 16 41 12" fill="none" stroke="#333" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M33 13 L42 11 L40 20" fill="none" stroke="#333" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" transform="rotate(8 40 14)" />
        </svg>
      </button>
      <div id="updated">prices: placeholder</div>
    </section>
  )
}

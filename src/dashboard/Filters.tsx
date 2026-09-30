import { OUT_OF_SCOPE, placeholder } from './placeholder'

const FILTERS = ['Favorites', 'Emergency', 'Food', 'Events']

export default function Filters() {
  return (
    <section id="filtC" className="comp" aria-label="Category filters">
      {FILTERS.map(f => (
        <button key={f} className="pill" aria-pressed={false} {...placeholder(OUT_OF_SCOPE)}>{f}</button>
      ))}
      <div id="filtHint">no filter · all shown</div>
    </section>
  )
}

import type { BudgetState } from '../useBudget'
import BossButton from './BossButton'
import BudgetActions from './BudgetActions'
import CategoriesTable from './CategoriesTable'
import CategoryActions from './CategoryActions'
import CoinWheel from './CoinWheel'
import DayRangeWheel from './DayRangeWheel'
import Filters from './Filters'
import Holdings from './Holdings'
import PriceChart from './PriceChart'
import Refresh from './Refresh'
import TransactionHistory from './TransactionHistory'
import './dashboard.css'

// Desktop layout: a fixed 1280 x 800 stage. Every component is absolutely
// positioned, so adding or resizing one never moves another.
export default function Dashboard({ budget }: { budget: BudgetState }) {
  return (
    <main id="stage">
      <h1 className="sr">Boss Budget</h1>
      <Refresh />
      <PriceChart />
      <DayRangeWheel />
      <Holdings total={budget.snapshot?.total} />
      <CategoryActions />
      <CategoriesTable budget={budget} />
      <BudgetActions />
      <Filters />
      <CoinWheel />
      <BossButton />
      <TransactionHistory />
    </main>
  )
}

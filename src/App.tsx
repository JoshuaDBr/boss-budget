import Dashboard from './dashboard/Dashboard'
import { useBudget } from './useBudget'

export default function App() {
  return <Dashboard budget={useBudget()} />
}

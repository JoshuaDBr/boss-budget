import Dashboard from './dashboard/Dashboard'
import { useBook } from './useBook'

export default function App() {
  return <Dashboard store={useBook()} />
}

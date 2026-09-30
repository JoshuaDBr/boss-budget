import { useCallback, useState } from 'react'
import { snapshot, type Budget, type Snapshot } from './ledger/ledger'
import { load, save } from './ledger/storage'

export type BudgetState =
  | { budget: Budget; snapshot: Snapshot; error?: undefined }
  | { budget?: undefined; snapshot?: undefined; error: string }

export interface BudgetStore {
  state: BudgetState
  /**
   * Applies one ledger operation and saves the result to this browser straight away.
   * Returns null on success, or the reason it was refused; the screen then keeps the old budget.
   */
  update: (change: (budget: Budget) => Budget) => string | null
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Reads the budget saved in this browser (or the starter budget if nothing is saved yet).
 * Damaged saved data is reported, never replaced, and no changes are accepted on top of it.
 */
export function useBudget(): BudgetStore {
  const [state, setState] = useState<BudgetState>(() => {
    try {
      const budget = load(window.localStorage)
      return { budget, snapshot: snapshot(budget) }
    } catch (e) {
      return { error: message(e) }
    }
  })

  const update = useCallback(
    (change: (budget: Budget) => Budget) => {
      if (!state.budget) return 'The saved budget could not be read, so it cannot be changed'
      try {
        const budget = change(state.budget)
        const next = snapshot(budget)
        save(window.localStorage, budget)
        setState({ budget, snapshot: next })
        return null
      } catch (e) {
        return message(e)
      }
    },
    [state],
  )

  return { state, update }
}

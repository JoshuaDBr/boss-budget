import { useState } from 'react'
import { snapshot, type Snapshot } from './ledger/ledger'
import { load } from './ledger/storage'

export type BudgetState = { snapshot: Snapshot; error?: undefined } | { snapshot?: undefined; error: string }

/**
 * Reads the budget saved in this browser (or the starter budget if nothing is saved yet).
 * Damaged saved data is reported, never replaced.
 */
export function useBudget(): BudgetState {
  const [state] = useState<BudgetState>(() => {
    try {
      return { snapshot: snapshot(load(window.localStorage)) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  return state
}

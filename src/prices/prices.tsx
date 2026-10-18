// The one feed the app uses, and the hooks that read it.

import { createContext, useContext, useSyncExternalStore } from 'react'
import { Feed, type FeedState } from './feed'
import { toDollars } from './money'

export const feed = new Feed()

export function useFeed(source: Feed = feed): FeedState {
  return useSyncExternalStore(source.subscribe, source.getState)
}

/** Today's price of each coin, for every dollar value on screen. */
export const PricesContext = createContext<Record<string, number>>({})

/** (units, ticker) => dollars at today's price, or null with no price yet. */
export function useDollars() {
  const prices = useContext(PricesContext)
  return (units: bigint, ticker: string) => toDollars(units, ticker, prices[ticker])
}

// The twelve coins V3 can budget in, in ticker order (the order of the coin wheel and the holdings box).
// Each coin is recorded in whole numbers of its smallest unit, so `decimals` is how many places one coin divides into.
// Every count was checked against the coin's own source code or documentation (Oct 17 2026).

export interface Coin {
  ticker: string
  name: string
  decimals: number
}

export const COINS: readonly Coin[] = [
  { ticker: 'ARRR', name: 'Pirate Chain', decimals: 8 },
  { ticker: 'BCH', name: 'Bitcoin Cash', decimals: 8 },
  { ticker: 'BTC', name: 'Bitcoin', decimals: 8 }, // satoshi
  { ticker: 'DASH', name: 'Dash', decimals: 8 }, // duff
  { ticker: 'ETH', name: 'Ethereum', decimals: 18 }, // wei
  { ticker: 'FIRO', name: 'Firo', decimals: 8 },
  { ticker: 'SOL', name: 'Solana', decimals: 9 }, // lamport
  { ticker: 'XMR', name: 'Monero', decimals: 12 }, // piconero
  { ticker: 'XRP', name: 'XRP', decimals: 6 }, // drop
  { ticker: 'XTM', name: 'Tari', decimals: 6 }, // microMinotari
  { ticker: 'ZANO', name: 'Zano', decimals: 12 },
  { ticker: 'ZEC', name: 'Zcash', decimals: 8 }, // zatoshi
]

export const findCoin = (ticker: string): Coin | undefined => COINS.find(c => c.ticker === ticker)

/** "Monero (XMR)": the full name with the ticker in parentheses. */
export const coinLabel = (coin: Coin) => `${coin.name} (${coin.ticker})`

/** The list in the Add a Currency pop-up: alphabetical by full name. */
export const byName = (coins: readonly Coin[]) => [...coins].sort((a, b) => a.name.localeCompare(b.name, 'en'))

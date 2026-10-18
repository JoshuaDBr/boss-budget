import { expect, it } from 'vitest'
import { COINS } from './coins'
import {
  BudgetError,
  READY_TO_ASSIGN,
  type Budget,
  addCategory,
  deleteCategory,
  deleteTransaction,
  deposit,
  editTransaction,
  move,
  renameCategory,
  snapshot,
  spend,
  starterBudget,
} from './ledger'
import { deserialize, serialize } from './storage'

// Runs a long sequence of random operations, including many that should be refused,
// along with edits and deletes of past deposits and spends, which may leave balances negative,
// and checks the ledger against a separate, deliberately simple model after every step.
// It runs once for every coin, at that coin's own number of decimal places.
// STRESS_OPS sets the count: 500 by default, 3,000 in the GitHub check.
// STRESS_SEED makes a run repeatable; the seed is printed so any failure can be replayed.

const OPS = Number(process.env.STRESS_OPS ?? 500)
const SEED = Number(process.env.STRESS_SEED ?? 20260930)
// Every step replays the whole ledger, so long runs need more than Vitest's default five seconds.
const TIMEOUT_MS = 120_000

function random(seed: number) {
  // mulberry32: small, fast and repeatable.
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

it.each(COINS.map((c) => [c.ticker, c.decimals] as const))(`keeps %s's guardrail through ${OPS} random operations (seed ${SEED})`, (ticker, decimals) => {
  const rand = random(SEED)
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]
  // Amounts range from the coin's smallest unit to about 1,000 coins: a random number of digits, then random digits,
  // so every decimal place gets used, even at Ethereum's 18.
  const amount = () => {
    const length = 1 + Math.floor(rand() * (decimals + 3))
    return BigInt(Array.from({ length }, () => Math.floor(rand() * 10)).join('')) + 1n
  }
  // Usually part or all of what the category holds; sometimes a random amount that may be too much.
  const amountFrom = (balance: bigint) => {
    const r = rand()
    if (balance <= 0n || r < 0.25) return amount()
    if (r < 0.4) return balance
    return (balance * BigInt(Math.floor(rand() * 1_000_000))) / 1_000_000n + 1n
  }

  let budget: Budget = { coin: ticker, ...starterBudget() }
  const model = new Map<string, bigint>([[READY_TO_ASSIGN, 0n], ['starter-1', 0n], ['starter-2', 0n], ['starter-3', 0n]])
  let total = 0n
  let nextId = 1
  // The model's record of each transaction: a spend has a category, a deposit does not.
  const records = new Map<string, { from?: string; amount: bigint }>()
  const details = { note: '', date: '2026-10-14' }
  // Adds a transaction's effect to the model, or takes it back out (sign -1n).
  // A spend from a deleted category is taken back into Ready to Assign.
  const affect = (t: { from?: string; amount: bigint }, sign: bigint) => {
    const id = t.from === undefined ? READY_TO_ASSIGN : model.has(t.from) ? t.from : READY_TO_ASSIGN
    model.set(id, model.get(id)! + (t.from === undefined ? sign : -sign) * t.amount)
    total += (t.from === undefined ? sign : -sign) * t.amount
  }
  const counts = { accepted: 0, refused: 0, negative: 0 }

  for (let step = 1; step <= OPS; step++) {
    const ids = [...model.keys()]
    const others = ids.filter((id) => id !== READY_TO_ASSIGN)
    const roll = rand()
    let expectOk: boolean
    let run: () => Budget
    let update = () => {}

    if (roll < 0.17) {
      const a = amount()
      const id = `t-${step}`
      expectOk = true
      run = () => deposit(budget, a, details, id)
      update = () => { affect({ amount: a }, 1n); records.set(id, { amount: a }) }
    } else if (roll < 0.25 && records.size > 0) {
      // Edit a past deposit or spend: new amount, and for a spend usually a new category.
      const id = pick([...records.keys()])
      const old = records.get(id)!
      const a = amount()
      const from = old.from === undefined ? undefined : rand() < 0.1 || others.length === 0 ? READY_TO_ASSIGN : pick(others)
      const edited = { from, amount: a }
      expectOk = from !== READY_TO_ASSIGN
      run = () => editTransaction(budget, id, { ...edited, ...details })
      update = () => { affect(old, -1n); affect(edited, 1n); records.set(id, edited) }
    } else if (roll < 0.3 && records.size > 0) {
      const id = rand() < 0.1 ? 'never-recorded' : pick([...records.keys()])
      expectOk = records.has(id)
      run = () => deleteTransaction(budget, id)
      update = () => { affect(records.get(id)!, -1n); records.delete(id) }
    } else if (roll < 0.55) {
      const from = pick(ids)
      const to = rand() < 0.05 ? from : pick(ids)
      const a = amountFrom(model.get(from)!)
      expectOk = from !== to && model.get(from)! >= a
      run = () => move(budget, from, to, a)
      update = () => { model.set(from, model.get(from)! - a); model.set(to, model.get(to)! + a) }
    } else if (roll < 0.85) {
      const from = rand() < 0.1 || others.length === 0 ? READY_TO_ASSIGN : pick(others)
      const a = amountFrom(model.get(from)!)
      const id = `t-${step}`
      expectOk = from !== READY_TO_ASSIGN && model.get(from)! >= a
      run = () => spend(budget, from, a, details, id)
      update = () => { affect({ from, amount: a }, 1n); records.set(id, { from, amount: a }) }
    } else if (roll < 0.88 && others.length > 0) {
      // Renaming moves no money; the model only checks that it is accepted.
      const n = nextId++
      const id = pick(others)
      expectOk = true
      run = () => renameCategory(budget, id, `Renamed ${n}`)
    } else if (roll < 0.94 || others.length === 0) {
      const n = nextId++
      const id = `stress-${n}`
      expectOk = true
      run = () => addCategory(budget, `Cat ${n}`, id)
      update = () => model.set(id, 0n)
    } else {
      const id = rand() < 0.1 ? READY_TO_ASSIGN : pick(others)
      expectOk = id !== READY_TO_ASSIGN
      run = () => deleteCategory(budget, id)
      update = () => { model.set(READY_TO_ASSIGN, model.get(READY_TO_ASSIGN)! + model.get(id)!); model.delete(id) }
    }

    const before = budget
    try {
      budget = run()
    } catch (error) {
      if (!(error instanceof BudgetError)) throw error
      if (expectOk) throw new Error(`Step ${step}: valid operation was refused: ${error.message}`)
      expect(budget).toBe(before)
      counts.refused++
      continue
    }
    if (!expectOk) throw new Error(`Step ${step}: invalid operation was accepted`)
    update()
    counts.accepted++
    if ([...model.values()].some((balance) => balance < 0n)) counts.negative++

    const snap = snapshot(budget)
    expect(snap.total, `step ${step} total`).toBe(total)
    expect(Object.fromEntries(snap.categories.map((c) => [c.id, c.balance])), `step ${step} balances`).toEqual(
      Object.fromEntries(model),
    )
    expect(snap.categories.reduce((sum, c) => sum + c.balance, 0n), `step ${step} guardrail`).toBe(snap.total)
    expect(snap.categories[0].id).toBe(READY_TO_ASSIGN)
    expect(Object.fromEntries(snap.transactions.map((t) => [t.id, t.amount])), `step ${step} transactions`).toEqual(
      Object.fromEntries([...records].map(([id, t]) => [id, t.amount])),
    )

    if (step % 100 === 0) {
      const categories = { entries: budget.entries.filter((e) => e.kind.endsWith('Category')) }
      expect(deserialize(serialize({ categories, coins: { [ticker]: budget } })).coins[ticker], `step ${step} save/load`).toEqual(budget)
    }
  }

  console.log(
    `Stress test, ${ticker}: ${OPS} operations, ${counts.accepted} accepted, ${counts.refused} refused, ` +
      `${counts.negative} steps with a negative balance, seed ${SEED}`,
  )
  expect(counts.accepted + counts.refused).toBe(OPS)
  expect(counts.refused).toBeGreaterThan(0)
  expect(counts.negative, 'some edits or deletes should leave a balance negative').toBeGreaterThan(0)
}, TIMEOUT_MS)

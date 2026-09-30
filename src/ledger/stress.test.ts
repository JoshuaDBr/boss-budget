import { expect, it } from 'vitest'
import {
  BudgetError,
  READY_TO_ASSIGN,
  type Budget,
  addCategory,
  deleteCategory,
  deposit,
  move,
  snapshot,
  spend,
  starterBudget,
} from './ledger'
import { deserialize, serialize } from './storage'

// Runs a long sequence of random operations, including many that should be refused,
// and checks the ledger against a separate, deliberately simple model after every step.
// STRESS_OPS sets the count: 500 by default, 3,000 in the GitHub check.
// STRESS_SEED makes a run repeatable; the seed is printed so any failure can be replayed.

const OPS = Number(process.env.STRESS_OPS ?? 500)
const SEED = Number(process.env.STRESS_SEED ?? 20260930)

function random(seed: number) {
  // mulberry32: small, fast and repeatable.
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

it(`keeps the guardrail through ${OPS} random operations (seed ${SEED})`, () => {
  const rand = random(SEED)
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]
  // Amounts range from 1 drop to about 1,000 XRP.
  const amount = () => BigInt(Math.floor(rand() ** 3 * 1_000_000_000) + 1)
  // Usually part or all of what the category holds; sometimes a random amount that may be too much.
  const amountFrom = (balance: bigint) => {
    const r = rand()
    if (balance === 0n || r < 0.25) return amount()
    if (r < 0.4) return balance
    return (balance * BigInt(Math.floor(rand() * 1_000_000))) / 1_000_000n + 1n
  }

  let budget: Budget = starterBudget()
  const model = new Map<string, bigint>([[READY_TO_ASSIGN, 0n], ['starter-1', 0n], ['starter-2', 0n], ['starter-3', 0n]])
  let total = 0n
  let nextId = 1
  const counts = { accepted: 0, refused: 0 }

  for (let step = 1; step <= OPS; step++) {
    const ids = [...model.keys()]
    const others = ids.filter((id) => id !== READY_TO_ASSIGN)
    const roll = rand()
    let expectOk: boolean
    let run: () => Budget
    let update = () => {}

    if (roll < 0.2) {
      const a = amount()
      expectOk = true
      run = () => deposit(budget, a)
      update = () => { model.set(READY_TO_ASSIGN, model.get(READY_TO_ASSIGN)! + a); total += a }
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
      expectOk = from !== READY_TO_ASSIGN && model.get(from)! >= a
      run = () => spend(budget, from, a)
      update = () => { model.set(from, model.get(from)! - a); total -= a }
    } else if (roll < 0.93 || others.length === 0) {
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

    const snap = snapshot(budget)
    expect(snap.total, `step ${step} total`).toBe(total)
    expect(Object.fromEntries(snap.categories.map((c) => [c.id, c.balance])), `step ${step} balances`).toEqual(
      Object.fromEntries(model),
    )
    expect(snap.categories.reduce((sum, c) => sum + c.balance, 0n), `step ${step} guardrail`).toBe(snap.total)
    expect(snap.categories[0].id).toBe(READY_TO_ASSIGN)

    if (step % 100 === 0) expect(deserialize(serialize(budget)), `step ${step} save/load`).toEqual(budget)
  }

  console.log(`Stress test: ${OPS} operations, ${counts.accepted} accepted, ${counts.refused} refused, seed ${SEED}`)
  expect(counts.accepted + counts.refused).toBe(OPS)
  expect(counts.refused).toBeGreaterThan(0)
})

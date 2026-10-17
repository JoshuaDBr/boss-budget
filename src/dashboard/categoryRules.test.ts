import { describe, expect, it } from 'vitest'
import { findCoin } from '../ledger/coins'
import { READY_TO_ASSIGN, type Category } from '../ledger/ledger'
import { canDelete, canMoveFrom, canMoveTo, checkAmount, deleteMessage, nameProblem } from './categoryRules'

const ready: Category = { id: READY_TO_ASSIGN, name: 'Ready to Assign', balance: 5_000_000_000_000n }
const groceries: Category = { id: 'g', name: 'Groceries', balance: 12_500_000_000_000n }
const gas: Category = { id: 'gas', name: 'Gas', balance: 0n }
const all = [ready, groceries, gas]
const XMR = findCoin('XMR')!
const BTC = findCoin('BTC')!

describe('new category names', () => {
  it('are refused when blank, duplicated (ignoring capitals) or longer than 15 characters', () => {
    expect(nameProblem('', all)).toBe('blank')
    expect(nameProblem('   ', all)).toBe('blank')
    expect(nameProblem('groceries', all)).toBe('duplicate')
    expect(nameProblem(' GAS ', all)).toBe('duplicate')
    expect(nameProblem('ready to assign', all)).toBe('duplicate')
    expect(nameProblem('Sixteen chars!!!', all)).toBe('tooLong')
  })

  it('are accepted otherwise, up to exactly 15 characters', () => {
    expect(nameProblem('Rent', all)).toBeNull()
    expect(nameProblem('Fifteen chars!!', all)).toBeNull()
  })
})

describe('move eligibility', () => {
  it('needs XMR in the From category, and From cannot also be To', () => {
    expect(canMoveFrom(groceries)).toBe(true)
    expect(canMoveFrom(gas)).toBe(false)
    expect(canMoveFrom(ready)).toBe(true)
    expect(canMoveFrom(groceries, 'g')).toBe(false)
    expect(canMoveTo(groceries, 'g')).toBe(false)
    expect(canMoveTo(ready, 'g')).toBe(true)
    expect(canMoveTo(gas)).toBe(true)
  })
})

describe('move amounts', () => {
  it('are accepted when above 0, at most 12 decimals and within the From balance', () => {
    expect(checkAmount('12.5', XMR, groceries)).toEqual({ units: 12_500_000_000_000n })
    expect(checkAmount('0.000000000001', XMR, groceries)).toEqual({ units: 1n })
    expect(checkAmount(' 3 ', XMR, ready)).toEqual({ units: 3_000_000_000_000n })
  })

  it('are refused otherwise, explaining only a shortfall in the From category', () => {
    for (const input of ['', '0', '0.000000000000', '1.0000000000001', '-1', 'abc']) {
      expect(checkAmount(input, XMR, groceries)).toEqual({ problem: '' })
    }
    expect(checkAmount('12.500000000001', XMR, groceries).problem).toBe('Groceries holds only 12.500000000000 XMR')
  })

  it('follow the precision and ticker of the coin on screen', () => {
    expect(checkAmount('0.00000001', BTC, groceries)).toEqual({ units: 1n })
    expect(checkAmount('0.000000001', BTC, groceries)).toEqual({ problem: '' })
    expect(checkAmount('125000.00000001', BTC, groceries).problem).toBe('Groceries holds only 125000.00000000 BTC')
  })
})

describe('delete', () => {
  it('is not offered for Ready to Assign', () => {
    expect(canDelete(ready)).toBe(false)
    expect(canDelete(gas)).toBe(true)
  })

  it('warns how much XMR returns to Ready to Assign, leaving that sentence out at 0 XMR', () => {
    expect(deleteMessage(groceries, XMR)).toBe(
      'Are you sure that you want to delete Groceries? 12.500000000000 XMR will be moved to Ready to Assign, and past transactions may become unassigned.',
    )
    expect(deleteMessage(gas, XMR)).toBe('Are you sure that you want to delete Gas? Past transactions may become unassigned.')
    expect(deleteMessage(groceries, null)).toBe('Are you sure that you want to delete Groceries? Past transactions may become unassigned.')
  })
})

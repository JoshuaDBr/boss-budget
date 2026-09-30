import { describe, expect, it } from 'vitest'
import { READY_TO_ASSIGN, type Category } from '../ledger/ledger'
import { canDelete, canMoveFrom, canMoveTo, checkAmount, deleteMessage, nameProblem } from './categoryRules'

const ready: Category = { id: READY_TO_ASSIGN, name: 'Ready to Assign', balance: 5_000_000n }
const groceries: Category = { id: 'g', name: 'Groceries', balance: 12_500_000n }
const gas: Category = { id: 'gas', name: 'Gas', balance: 0n }
const all = [ready, groceries, gas]

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
  it('needs XRP in the From category, and From cannot also be To', () => {
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
  it('are accepted when above 0, at most 6 decimals and within the From balance', () => {
    expect(checkAmount('12.5', groceries)).toEqual({ drops: 12_500_000n })
    expect(checkAmount('0.000001', groceries)).toEqual({ drops: 1n })
    expect(checkAmount(' 3 ', ready)).toEqual({ drops: 3_000_000n })
  })

  it('are refused otherwise', () => {
    expect(checkAmount('', groceries).problem).toBe('')
    expect(checkAmount('0', groceries).problem).toMatch(/above 0/)
    expect(checkAmount('0.000000', groceries).problem).toMatch(/above 0/)
    expect(checkAmount('1.0000001', groceries).problem).toMatch(/6 decimal/)
    expect(checkAmount('-1', groceries).problem).toMatch(/such as/)
    expect(checkAmount('abc', groceries).problem).toMatch(/such as/)
    expect(checkAmount('12.500001', groceries).problem).toBe('Groceries holds only 12.5 XRP')
  })
})

describe('delete', () => {
  it('is not offered for Ready to Assign', () => {
    expect(canDelete(ready)).toBe(false)
    expect(canDelete(gas)).toBe(true)
  })

  it('warns how much XRP returns to Ready to Assign, leaving that sentence out at 0 XRP', () => {
    expect(deleteMessage(groceries)).toBe(
      'Are you sure that you want to delete Groceries? 12.5 XRP will be moved to Ready to Assign, and past transactions may become unassigned.',
    )
    expect(deleteMessage(gas)).toBe('Are you sure that you want to delete Gas? Past transactions may become unassigned.')
  })
})

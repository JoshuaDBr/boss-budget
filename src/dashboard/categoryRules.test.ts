import { describe, expect, it } from 'vitest'
import { findCoin } from '../ledger/coins'
import { addCoin, changeCoin, starterBook, type Book } from '../ledger/book'
import { READY_TO_ASSIGN, deposit, editTransaction, move, spend, type Category } from '../ledger/ledger'
import { canDelete, canMoveFrom, canMoveTo, capNote, checkAmount, deleteMessage, holders, nameProblem } from './categoryRules'

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

})

describe('0.4.1: the delete warning names every coin holding a balance (B2)', () => {
  const tail = 'All balances and deficits will be moved to "Ready to Assign," and past transactions may become unassigned.'

  it('lists four coins with the Oxford comma', () => {
    expect(deleteMessage('Food', ['BTC', 'ETH', 'XMR', 'XTM'])).toBe(
      `Are you sure that you want to delete "Food"? BTC, ETH, XMR, and XTM currently hold balances in this category. ${tail}`,
    )
  })

  it('joins two coins with "and", and speaks of one coin in the singular', () => {
    expect(deleteMessage('Food', ['BTC', 'ETH'])).toBe(
      `Are you sure that you want to delete "Food"? BTC and ETH currently hold balances in this category. ${tail}`,
    )
    expect(deleteMessage('Food', ['XMR'])).toBe(
      `Are you sure that you want to delete "Food"? XMR currently holds a balance in this category. ${tail}`,
    )
  })

  it('leaves the balance sentence out when no coin holds one', () => {
    expect(deleteMessage('Food', [])).toBe('Are you sure that you want to delete "Food"? Past transactions may become unassigned.')
  })

  it('counts deficits as well as balances, alphabetical, and skips coins at zero', () => {
    const id = 'starter-1' // Groceries
    let book: Book = starterBook()
    for (const ticker of ['XMR', 'BTC', 'ETH', 'ZEC']) book = addCoin(book, ticker)
    const fund = (ticker: string) => (b: Book) => changeCoin(b, ticker, budget => move(deposit(budget, 10n), READY_TO_ASSIGN, id, 5n))
    book = fund('XMR')(fund('BTC')(fund('ETH')(book)))
    // ETH: spent down to zero. BTC: an edit leaves a deficit of 3.
    book = changeCoin(book, 'ETH', budget => spend(budget, id, 5n))
    book = changeCoin(book, 'BTC', budget => {
      const spent = spend(budget, id, 5n, { note: '', date: '2026-10-01' }, 's1')
      return editTransaction(spent, 's1', { from: id, amount: 8n, note: '', date: '2026-10-01' })
    })
    expect(holders(book, id)).toEqual(['BTC', 'XMR'])
    expect(holders(book, 'starter-2')).toEqual([])
    expect(holders(starterBook(), id)).toEqual([])
  })
})

describe('0.4.1: the note box counts characters as the ledger does (B9)', () => {
  const thirty = 'a'.repeat(28) + '🦀🛸'

  it('counts an emoji as one character, so 30 emoji fit', () => {
    const emoji = '🛸'.repeat(30)
    expect(emoji.length).toBe(60)
    expect(capNote(emoji, '🛸'.repeat(29))).toBe(emoji)
    expect(capNote(thirty, thirty.slice(0, -2))).toBe(thirty)
  })

  it('refuses a 31st character, and keeps the first 30 of a paste that runs over', () => {
    expect(capNote(thirty + '🛸', thirty)).toBe(thirty)
    expect(capNote('x' + thirty, thirty)).toBe(thirty)
    expect(capNote('🛸'.repeat(40), '')).toBe('🛸'.repeat(30))
  })
})

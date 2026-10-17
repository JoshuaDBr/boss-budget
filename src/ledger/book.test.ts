import { describe, expect, it } from 'vitest'
import { addCoin, addedCoins, changeCategories, changeCoin, checkBook, removeCoin, starterBook, type Book } from './book'
import { BudgetError, READY_TO_ASSIGN, addCategory, deleteCategory, deposit, move, renameCategory, snapshot } from './ledger'

const rows = (book: Book, ticker: string) => snapshot(book.coins[ticker]).categories.map(c => `${c.name} ${c.balance}`)

describe('the book', () => {
  it('starts with the starter categories and no coins', () => {
    const book = starterBook()
    expect(snapshot(book.categories).categories.map(c => c.name)).toEqual(['Ready to Assign', 'Groceries', 'Gas', 'Emergency'])
    expect(addedCoins(book)).toEqual([])
  })

  it('gives a new coin every current category at zero, its own Ready to Assign and an empty history', () => {
    let book = changeCategories(starterBook(), b => addCategory(b, 'Rent', 'rent'))
    book = changeCategories(book, b => renameCategory(b, 'starter-2', 'Fuel'))
    book = addCoin(book, 'XMR')
    expect(rows(book, 'XMR')).toEqual(['Ready to Assign 0', 'Groceries 0', 'Fuel 0', 'Emergency 0', 'Rent 0'])
    expect(snapshot(book.coins.XMR).transactions).toEqual([])
    expect(book.coins.XMR.coin).toBe('XMR')
  })

  it('lists the coins added in ticker order, and adds each coin only once', () => {
    const book = ['ZEC', 'XMR', 'BTC'].reduce(addCoin, starterBook())
    expect(addedCoins(book).map(c => c.ticker)).toEqual(['BTC', 'XMR', 'ZEC'])
    expect(() => addCoin(book, 'XMR')).toThrow(/already been added/)
    expect(() => addCoin(book, 'DOGE')).toThrow(/Unknown coin/)
  })

  it('keeps each coin’s money separate', () => {
    let book = ['BTC', 'XMR'].reduce(addCoin, starterBook())
    book = changeCoin(book, 'BTC', b => move(deposit(b, 100_000_000n), READY_TO_ASSIGN, 'starter-1', 30_000_000n))
    expect(rows(book, 'BTC')).toEqual(['Ready to Assign 70000000', 'Groceries 30000000', 'Gas 0', 'Emergency 0'])
    expect(rows(book, 'XMR')).toEqual(['Ready to Assign 0', 'Groceries 0', 'Gas 0', 'Emergency 0'])
  })

  it('adds, renames and deletes a category in every coin at once, with each coin’s money returning to its own Ready to Assign', () => {
    let book = ['BTC', 'XMR'].reduce(addCoin, starterBook())
    book = changeCoin(book, 'BTC', b => move(deposit(b, 9n), READY_TO_ASSIGN, 'starter-3', 4n))
    book = changeCoin(book, 'XMR', b => move(deposit(b, 7n), READY_TO_ASSIGN, 'starter-3', 2n))
    book = changeCategories(book, b => addCategory(b, 'Rent', 'rent'))
    book = changeCategories(book, b => renameCategory(b, 'starter-1', 'Food'))
    book = changeCategories(book, b => deleteCategory(b, 'starter-3'))
    expect(rows(book, 'BTC')).toEqual(['Ready to Assign 9', 'Food 0', 'Gas 0', 'Rent 0'])
    expect(rows(book, 'XMR')).toEqual(['Ready to Assign 7', 'Food 0', 'Gas 0', 'Rent 0'])
    expect(snapshot(book.categories).categories.map(c => c.name)).toEqual(['Ready to Assign', 'Food', 'Gas', 'Rent'])
  })

  it('changes no coin if any one refuses a category change', () => {
    const book = addCoin(starterBook(), 'XMR')
    expect(() => changeCategories(book, b => renameCategory(b, 'starter-1', 'Gas'))).toThrow(/already exists/)
    expect(rows(book, 'XMR')).toEqual(['Ready to Assign 0', 'Groceries 0', 'Gas 0', 'Emergency 0'])
  })

  it('refuses a coin change that would add or remove a category in one coin only', () => {
    const book = addCoin(starterBook(), 'XMR')
    expect(() => changeCoin(book, 'XMR', b => addCategory(b, 'Rent'))).toThrow(/do not match/)
  })

  it('refuses money in the shared categories', () => {
    expect(() => changeCategories(starterBook(), b => deposit(b, 1n))).toThrow(/cannot hold money/)
  })

  it('erases a removed coin entirely and leaves the others unchanged', () => {
    let book = ['BTC', 'XMR'].reduce(addCoin, starterBook())
    book = changeCoin(book, 'XMR', b => deposit(b, 5n))
    const btc = book.coins.BTC
    book = removeCoin(book, 'XMR')
    expect(book.coins).toEqual({ BTC: btc })
    expect(() => removeCoin(book, 'XMR')).toThrow(BudgetError)
    // Added again, it starts from nothing.
    expect(snapshot(addCoin(book, 'XMR').coins.XMR).total).toBe(0n)
  })

  it('checks every coin is on the list and matches the shared categories', () => {
    const book = addCoin(starterBook(), 'XMR')
    expect(() => checkBook({ ...book, coins: { DOGE: { ...book.coins.XMR, coin: 'DOGE' } } })).toThrow(/Unknown coin/)
    expect(() => checkBook({ ...book, coins: { BTC: book.coins.XMR } })).toThrow(/Unknown coin/)
    expect(() => checkBook({ ...book, categories: addCategory(book.categories, 'Rent') })).toThrow(/do not match/)
  })
})

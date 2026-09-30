# Boss Budget

A zero-based budgeting app for cryptocurrency. It works like YNAB, but the money it budgets is crypto instead of dollars: every coin you hold is given a job, split into category "buckets" for future spending, and tracked as you spend it.

## Why

Many people in the crypto community try to spend crypto like cash, by transacting with it directly or by buying gift cards. There is no ordinary budgeting app for doing that. Most large technology companies treat crypto only as a store of value, not something spent day to day. Someone who wants to budget their crypto spending carefully today has two choices. They can track it by hand in a homemade spreadsheet. Or they can split their coins across several wallets, which is inconvenient and can cost unnecessary network fees. Boss Budget is built to fill that gap.

## Version 1 scope

V1 tracks a single cryptocurrency, **XRP**. You record amounts by hand; the app never connects to a wallet.

**Included**
- The main dashboard, complete in appearance
- A categories section where you can add and delete categories, with three starter categories: Groceries, Gas and Emergency
- **Ready to Assign** as the top row of the categories list. Deposits go here before you assign them to categories.
- Deposits: recording crypto coming into the budget
- Spending: recording crypto spent from a category
- Moving money between categories
- A fixed total: the amount in the budget changes only when you record a deposit or a spend

**Not in V1** (these may appear on screen as non-working placeholders)
- The multi-coin selector wheel
- Transaction history
- Dollar values for categories. USD amounts show as a `$0.00` placeholder.
- The price graph
- Any other dashboards

## The core rule

The categories, including Ready to Assign, must always add up to the total amount of crypto in the budget. Money can leave a category only by moving to another category or by being spent.

The app enforces this rule as follows:
- Amounts are stored as whole numbers of **drops**, XRP's smallest unit (1 XRP = 1,000,000 drops). This prevents rounding errors.
- Every deposit, spend and move is recorded as an entry. Balances are calculated from those entries and never edited directly.
- After every action, the app checks that the categories still add up to the total.

## Data and privacy

Everything is stored in your browser, on your device. There is no login and no server database. As a result, your budget is visible only in the browser where you created it. Clearing that browser's site data deletes it.

## Status

Early development. V1 is being built. The full product definition is in the Boss Budget PRD in the project's shared notes.

## Development

Built with Vite, React and TypeScript. Vercel deploys every merge to `main`.

```bash
npm install
npm run dev      # local development server
npm run build    # type-check and production build
npm test         # automated tests
```

### Accounting core and tests

The budget rules live in `src/ledger/`, separate from any screen:

- `drops.ts` converts between typed XRP amounts and drops.
- `ledger.ts` holds the entries, the rules and the guardrail check.
- `storage.ts` saves to and loads from the browser. It refuses damaged data rather than overwriting it.

The tests cover every rule, including a **stress test**. It runs a long sequence of random deposits, spends, moves, additions and deletions (many of them deliberately invalid) and checks the ledger against a separate simple model after every step. Locally it runs 500 operations. The GitHub check on every pull request runs 3,000, with a new random seed each run. To replay a run, set `STRESS_OPS` and `STRESS_SEED`:

```bash
STRESS_OPS=3000 STRESS_SEED=12345 npm test
```

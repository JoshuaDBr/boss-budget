# Changelog

Boss Budget follows [Semantic Versioning](https://semver.org): MAJOR.MINOR.PATCH. While the major number is 0, the app is in alpha: features are still arriving and saved data may be reset. Each PRD generation is a minor version (V1 = 0.1, V2 = 0.2), and bug fixes are patches.

## 0.4.0 (2026-10-18)

V4, "Live Prices and the Boss View", per the V4 PRD.

- Live dollar values from CoinGecko's free feed, with no account and no key: in holdings, the budget table, both histories, the corner box and every pop-up. Two decimal places with commas; past transactions use today's price.
- All requests go through one queue, one every 12 seconds, to stay inside the free limit. At launch: every coin's price, then the coin on screen's graph, then the other coins added, then the rest. A coin switched to moves up the queue.
- Refresh works. It becomes a countdown (2:24, then 59) until its requests finish, and cannot be clicked until then. "prices: 1:42 PM" shows when the prices last arrived. A refresh that fails shows "Price could not refresh. Try again shortly." and keeps the last prices.
- Each coin's real 90-day price graph, with dollar gridlines, and the 30 / 60 / 90 disc. "Failed to load." if a graph never arrived.
- The Boss View, from BOSS once two coins hold money outside Ready to Assign: every coin's budget in dollars, both histories for every coin, a graph of each coin's percent change, and a grand total in holdings.
- A new font, Lexend, replaces the handwriting font everywhere. It ships with the app; nothing is fetched from a font service.

## 0.3.0 (2026-10-17)

V3, "Multi-Coin", per the V3 PRD.

- Twelve coins (ARRR, BCH, BTC, DASH, ETH, FIRO, SOL, XMR, XRP, XTM, ZANO, ZEC), each kept exactly at its own precision (6 to 18 decimal places). Every coin has its own budget, with balances and history apart; the category list is shared. V2 data is cleared on first open.
- The app opens empty. Coins are added from "+ Add a Currency" in holdings and deleted from each row's 3-dot menu, after typing "delete".
- The wheel shows the coin on screen in the centre, with its neighbours on the side tabs and the ‹ › arrows.
- Holding a category name for half a second renames it, in every coin at once.
- Holdings and the corner box show six decimal places, cut, not rounded. The table, the pop-ups and the full history show every place; long amounts shrink to fit.

## 0.2.1 (2026-10-15)

Bug fixes.

- The XMR amount box refuses a thirteenth decimal place, a second point, and anything that is not a digit, in every pop-up (Deposit, Spend, Move and both edits).
- Spend and Move open with the cursor in From. Tab and Shift+Tab step through the pop-up's fields (Spend: From, XMR, Note, Date; Move: From, XMR, To; Deposit: XMR, Note, Date) and wrap round, instead of wandering through the page behind it.

## 0.2.0 (2026-10-15)

V2, "First Usable Build", per the V2 PRD.

- XMR replaces XRP, with exact 12-decimal accounting. Old V1 data is cleared on first open. (#8)
- Note and Date on deposits and spends, a "Did you … precisely?" confirmation, the corner mini history, the full history and mini budget swap, edit and delete of past transactions, and negatives in red. (#9)

## 0.1.0 (2026-10-01)

V1, per the V1 PRD: the desktop dashboard, categories (add, move, delete), and deposit and spend in XRP, saved on the device. (#2–#7)

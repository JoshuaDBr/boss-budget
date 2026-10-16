# Changelog

Boss Budget follows [Semantic Versioning](https://semver.org): MAJOR.MINOR.PATCH. While the major number is 0, the app is in alpha: features are still arriving and saved data may be reset. Each PRD generation is a minor version (V1 = 0.1, V2 = 0.2), and bug fixes are patches.

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

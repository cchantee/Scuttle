# Scuttle

Scuttle is a local-first, paycheck-based budgeting prototype built with Expo, React Native, TypeScript, and Expo Router. The interface is intentionally plain and exists to exercise the shared financial logic and local data model. It does not connect to a bank, authenticate users, or synchronize data across devices.

## Run locally

1. Install Node.js 22.13+ or 24.3+ and npm.
2. From this folder, run `npm install`.
3. Install Expo Go on your phone from the App Store or Google Play.
4. Run `npx expo start`, then scan the QR code from inside the Expo Go app. Keep the phone and computer on the same Wi-Fi network. If they cannot connect over Wi-Fi, try `npx expo start --tunnel`.

This project uses Expo SDK 54, which matches the Expo Go version currently available in the stores. It does not require a separately installed Scuttle development build. The app identifiers in `app.json` (`com.scuttle.app`) are local project identifiers and can be changed before distribution.

Other scripts: `npm test` and `npm run typecheck`.

## Records and calculations

- Currency is stored as integer cents. `src/domain/money.ts` handles input parsing and display formatting.
- Paycheck totals and allocation balances are derived from paycheck allocations and expense records; the same expense can also affect a virtual account without combining those separate concepts.
- Cash-like account balances use positive values for owned money. Credit-card balances use positive values for amount owed. Purchases decrease cash and increase card debt.
- Account balances equal the starting balance plus effects of associated transactions. Editing a starting balance preserves transaction history; editing or deleting a transaction recalculates the balance from the ledger.
- A transfer is one transaction linked to a source and destination. It decreases cash at the source and increases cash at the destination. A credit-card payment is a transfer to the card and reduces both the paying cash balance and the amount owed. Transfers are not expenses.
- Savings goals have a separate contribution ledger. Contributions change goal progress only; they do not change virtual account balances or create paycheck allocations.
- Deletion is blocked when linked records would be orphaned. Reassign or remove dependencies first. The UI confirms deletions and displays the reason when a deletion is blocked.
- Goal progress is capped at 100% for display; saved amount and amount remaining still show the underlying figures, including amounts above target.

## Main areas

- Dashboard: current paycheck totals, allocation summaries, goals, recent transactions.
- Paychecks: create, edit, and delete paychecks.
- Budget: manage categories and paycheck-specific allocations.
- Transactions: record and edit expenses, income, and transfers.
- Accounts: manually maintained cash and credit-card accounts.
- Savings goals: manage goals and contribution history.
- History: review records and filter transactions by date, category, paycheck, and account.

## Requirements implemented

- Local persistence behind a `StorageAdapter` interface, currently backed by AsyncStorage.
- Typed models for paychecks, categories, allocations, transactions, accounts, goals, and contributions.
- Centralized money calculations, validation, transaction effects, and dependency-safe deletion.
- Expo Router 6 routes with plain, usable record forms for the implemented records.
- Automated tests for the required $1,200 paycheck scenario, account sign conventions, transfers and credit-card payments, savings ledger independence, reassignment, and dependency-safe deletes.

## Known limitations

- No Supabase, sign-in, multi-user isolation, or cross-device sync.
- Data is stored locally and is not encrypted by AsyncStorage.
- There is no account-linked savings transfer workflow; the current contribution ledger is intentionally independent.
- The UI is a functional baseline. iOS and Android JavaScript bundles were built, but a native app was not installed or usability-tested on a physical device in this environment.
- Web runtime dependencies are not configured; the current run path targets iOS and Android.
- Date entry is a text field in `YYYY-MM-DD` format rather than a native date picker.
- There is no demo-data loader or reset control yet. The required financial scenario is covered by automated unit tests and can also be entered through the screens.

## Current verification status

SDK 54 package alignment is configured for Expo Go. On iPhone, install the current Expo Go from the App Store; on Android, install it from Google Play. Start Metro with `npx expo start` and open the QR code inside Expo Go.

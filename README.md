# Scuttle

Scuttle is a paycheck-based budgeting application built with Expo, React Native, TypeScript, and Expo Router. It does not connect to banks. The starter runs locally without credentials and can connect to a shared Supabase account backend when configured.

## Run locally

1. Install Node.js 22.13+ or 24.3+ and npm.
2. From this folder, run `npm install`.
3. Install Expo Go on your phone from the App Store or Google Play.
4. Run `npx expo start`, then scan the QR code from inside the Expo Go app. Keep the phone and computer on the same Wi-Fi network. If they cannot connect over Wi-Fi, try `npx expo start --tunnel`.

To open the web version, run `npx expo start --web`.

Jordan Taylor is the only study/sample dataset. The researcher restores the complete baseline using `npm run study:jordan -- reset` (interactive confirmation required), then checks database readiness with `npm run study:jordan -- verify-live`. See [study reset instructions](docs/jordan-study-account.md). Participants use Jordan's existing login; the mobile app has no sample loader or reset control.

This project uses Expo SDK 58 and matches the SDK 58 Expo Go installed on your phone. Without backend credentials it saves data on the current device only. To enable registration, sign-in, and cross-device sync:

1. Create a Supabase project and copy `.env.example` to `.env`.
2. Add the project's URL and anon/publishable key to the matching `EXPO_PUBLIC_SUPABASE_*` variables in `.env`.
3. Run both SQL files from `supabase/migrations` in filename order in the Supabase SQL editor. If you already ran the initial setup, run `202610270002_interest_and_goal_reservations.sql` as well; it updates the cloud snapshot constraint to accept the current version 2 data format used by the app.
4. Enable Email auth in Supabase, restart Expo with `npx expo start --clear`, and create an account in Scuttle.

The mobile client uses only the public anon/publishable key. Row-level security restricts each financial snapshot to its signed-in owner. Writes use a revision check and show an error instead of silently replacing newer data from another device. The database migration stores one versioned JSON snapshot per account; record relationships and financial calculations are validated by the shared domain layer before each save. Never put a Supabase service-role key in the mobile app.

The app identifiers in `app.json` (`com.scuttle.app`) are local project identifiers and can be changed before distribution.

Other scripts: `npm test`, `npm run typecheck`, and `npm run qa:backend` (runs both TypeScript checking and the automated test suite). The [design and verification log](AI-design-decisions.md#verification) includes backend QA coverage and the remaining Supabase integration checklist.

## Records and calculations

- Currency is stored as integer cents. `src/domain/money.ts` handles input parsing and display formatting.
- Paycheck totals and allocation balances are derived from paycheck allocations and expense records; the same expense can also affect a virtual account without combining those separate concepts.
- A paycheck can be kept standalone or linked once to a virtual account as its income ledger event; do not create a duplicate transaction for the deposit. Allocations remain separate and do not alter account balances; editing or deleting a paycheck recalculates its linked account deposit.
- Cash-like account balances use positive values for owned money. Credit-card balances use positive values for amount owed. Purchases decrease cash and increase card debt.
- Account balances equal the starting balance plus effects of associated transactions. Editing a starting balance preserves transaction history; editing or deleting a transaction recalculates the balance from the ledger.
- A transfer is one transaction linked to a source and destination. It decreases cash at the source and increases cash at the destination. A credit-card payment is a transfer to the card and reduces both the paying cash balance and the amount owed. Transfers are not expenses.
- Savings goals have a separate contribution ledger. Contributions change goal progress only; they do not change virtual account balances or create paycheck allocations.
- Deletion is blocked when linked records would be orphaned. Reassign or remove dependencies first. The UI confirms deletions and displays the reason when a deletion is blocked.
- Goal progress is capped at 100% for display; saved amount and amount remaining still show the underlying figures, including amounts above target.

## Main areas

- Home: search records, switch the dashboard quick view, review this paycheck and active budgets, and use quick actions for common tasks. The payday schedule stores an upcoming date and a monthly, weekly, biweekly, or custom interval. Countdown calculation is anchored to that date; monthly schedules preserve the selected day and clamp to month-end when needed.
- Accounts: create, edit, and delete virtual accounts; open an account to review its balance, paycheck deposits, and transactions.
- Paychecks: create, edit, and delete paychecks; choose paycheck-only tracking or a deposit account, then manage category allocations separately.
- Budget: manage categories and paycheck-specific allocations, archive or restore a paycheck's budget without deleting it, and open an allocation to review spending.
- Transactions: search, create, edit, and delete expenses, income, and transfers. Categorized expenses automatically use the newest active paycheck allocation for that category; archived budgets are skipped.
- Goals: create goals and manage their contribution history from each goal's detail screen.
- History: review records and filter transactions by date, category, paycheck, and account.
- More navigation: open Budget, Transactions, and History from any main screen.

## Requirements implemented

- A `StorageAdapter` boundary with local AsyncStorage and optional Supabase-backed persistence.
- Email registration, sign-in, sign-out, owner-only row-level security, and revision-checked account sync when Supabase is configured.
- Typed models for paychecks, categories, allocations, transactions, accounts, goals, and contributions.
- Centralized money calculations, validation, transaction effects, and dependency-safe deletion.
- Expo Router 58 routes with plain, usable record forms for the implemented records.
- Automated tests for the required $1,200 paycheck scenario, account sign conventions, transfers and credit-card payments, savings ledger independence, reassignment, and dependency-safe deletes.

## Known limitations

- Cloud account and synchronization features require a Supabase project and the setup above. Without it, local device mode is used.
- Local-only mode stores financial data in AsyncStorage without app-level encryption. Cloud mode stores it in an owner-scoped Supabase row.
- Goal contributions can reserve account funds, be completed in place, or settle via an explicitly recorded transfer. Budget-group allocations designate funds without moving account money.
- The `AI_Designed_App` branch implements Scuttle Brand v1.1 across the working application. iOS/Android/web JavaScript bundles export successfully; physical-device and native binary verification remain manual. See [AI-only design decisions and verification](AI-design-decisions.md).
- Date entry accepts `M/D/YYYY` with one or two digits for month/day and includes an in-app calendar picker; saved dates stay normalized as `YYYY-MM-DD`.
- Jordan is the only supported study dataset; the researcher-only reset restores its complete baseline.

## Current verification status

SDK 58 dependency validation and TypeScript checking pass. Expo exported web, iOS, and Android JavaScript bundles. Start with `npx expo start --clear` and open the QR code in SDK 58 Expo Go. Cloud registration and syncing require the Supabase setup above.

## Scuttle Brand v1.1

On `AI_Designed_App`, the branded interface uses **Home · Budget · Add · Activity · More**. Add opens Expense, Income, Transfer, or Paycheck entry; More keeps Accounts, Savings Goals, Paychecks, Profile and existing tools reachable. Planned/received paychecks and category-to-goal contributions remain fully functional.

The package is extracted under `assets/Scuttle_Brand_v1_1/`. Design decisions, ten-screen route mapping, browser scenarios, verification results, and known limits are in [AI-design-decisions.md](AI-design-decisions.md). Financial operations, storage, backend configuration, and migrations are unchanged by the brand update.

## Consolidated AI interface: AI_Designed_App

Add a paycheck, then use **Save paycheck & budget** to enter its category and goal amounts together. The planner keeps a live **Left to budget** total and saves one complete distribution. **Mark as received** supports reviewing actual pay and adjusting that distribution in the same atomic save. Category budget remaining, unassigned pay, and recorded account balances stay distinct.

Budget now separates **Spending**, **Planned**, and **Archived**. Activity offers **Money activity** or **All records**. Record rows open directly; their **⋯** menus expose edit/delete. See [the independent UX evaluation and verification log](AI-design-decisions.md#ux-refinement) for decisions, financial safeguards, browser scenarios, and remaining manual checks.

The former `AI_Designed_App_2` continuation is consolidated into `AI_Designed_App`, including its full commit history and the finalized Jordan study fixture, protected reset, and walkthrough fixes. Use `AI_Designed_App` for the AI-only study condition.

## Launch any research interface

Run `npm run test:interface` and choose 1 (Human), 2 (AI), or 3 (Human + AI). Ctrl+C stops Expo and returns to the selector. Separate Git worktrees preserve each design and dependency lockfile. See [setup, iPhone, and study instructions](docs/interface-launcher.md).

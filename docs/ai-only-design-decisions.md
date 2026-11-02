# Scuttle Brand v1.1 — AI-only implementation decisions

Date: November 2, 2026. Working branch: `AI_Designed_App`.

## Phase 1: repository audit

Read the README, package manifest, every route, shared UI and walkthrough, domain models/calculations/operations, provider, local/cloud adapters, backend configuration, and existing regression tests. Extracted and read all three package files under `assets/Scuttle_Brand_v1_1/`. The implementation prompt is the instruction source; the branded HTML/CSS is the primary visual specification; the six-screen wireframe is background only. No outside design conversations were used.

Confirmed working capabilities before styling:

- Variable, standalone and account-linked paychecks; planned paychecks; receipt review; original plan versus actual income; editable category and goal allocations; unspent category-to-category/goal reallocations; allocation history.
- Expense/income/transfer/subscription records with edit/delete and categorized spending. A linked paycheck is already an income ledger event, so it must not also create a transaction.
- Cash, savings, high-yield savings, and credit cards; debt sign conventions; credit-card payments via transfers; daily interest estimates and month-end posting.
- Goal contribution history, account-backed reservations, same-account designation and transfer settlement; budget-group-funded contributions.
- Categories; subscriptions included in paycheck planning; budget archives/restoration; payday schedules; sample-data loading and dependency-safe removal.
- Local AsyncStorage when cloud is unconfigured; configured Supabase authentication and owner-scoped revision-checked snapshots; onboarding/walkthrough.

Risks and constraints:

- `main` is only the initial repository commit. To honor the user's instruction to preserve **all existing financial functionality**, the new design branch retains the current functional app at `bde4142`, including CoreChanges. No edits, commits, merges, or pushes were made to `main`; no branches were overwritten.
- The HTML concepts contain illustrative figures, not application data. Production screens render only provider data. Browser QA creates clearly labeled local records; these are not seeded into production code.
- Local mode is not selectable in a cloud-configured build. Auth route guards and storage behavior are preserved; the welcome/settings copy reflects the actual configuration.
- Account balance, category budget remaining, unassigned paycheck funds, and designated/completed goal progress are different quantities. They must not be added together as available money.
- No new dependency is needed. Expo Router remains the routing system; no new navigation library or SVG runtime was introduced.
- The browser's security policy refused the `file:` reference URL. The reference was inspected as HTML/CSS and extracted text instead; the working Expo app was subsequently rendered and tested at localhost.
- No movie was included in the supplied archive, so the optional walkthrough video was not used.

## Foundation and visual choices

| Decision | Reason and UX effect | Alternative / constraint |
| --- | --- | --- |
| Central semantic tokens in `src/design/theme.ts` | Evergreen headings, teal actions, lime highlights, warm paper, and calm surfaces make forms and money figures consistent. A darker coral-family text token gives caution/error text adequate contrast. | Raw brand coral is an accent, not small error text. Financial states also have text labels. |
| Native system sans, tabular money, natural wrapping | Matches the branded reference while avoiding downloads and preserving system font scaling. | No bundled custom font, clipped single-line money, or globally capped font multiplier. |
| Shared branded Text, Hero, Metric, EmptyState, Card, Action and form controls | Establishes one component language across actual screens rather than isolated mockups. | Existing financial forms and operations are reused. |
| Native geometric mascot | Refines the original shell, forward-facing head, eye, and legs using lightweight native views. Ready/rest/celebrate variants work on web/iOS/Android. | No raster dependency or unsupported native SVG. Mascot appears in the wordmark, welcome, empty states and attained goals, never behind financial figures. |
| 48 px primary controls and visible input focus | Easier touch use and keyboard navigation; labels remain visible. | Calendar day cells retain a compact seven-column layout with tall touch areas. |
| Dark paycheck hero, two supporting metrics | Answers what remains to assign, what is assigned, and what can still be spent in category budgets. | Account balances are explicitly separate; the old “Available to Spend” label for unassigned pay was removed. |
| Five destinations: Home / Budget / Add / Activity / More | Direct budget/history access; a real Add sheet distinguishes Expense, Income, Transfer and Paycheck. | Accounts, goals, profile, paychecks, recurring records, and settings remain reachable from More. |
| Keep existing Stack routes and back fallbacks | Preserves deep links, details, archives, edit/delete and auth without a risky route migration. | A shared native bottom bar provides the five-destination pattern rather than restructuring into router tab groups. |
| Collapsible Activity filters with date groups | Search and a single filter area reduce clutter. Rows distinguish positive income, negative spending, neutral transfers, reminders and allocations. | Keeps every pre-existing date/category/paycheck/account filter and adds presentation-only text/type filtering. |
| Save feedback across routes | Async actions guard repeat taps, show saving state, and report committed changes through a UI-only observer. Initial loading does not announce a false save. | Storage and provider remain untouched. Failed writes retain the form; connection errors explain that cloud changes are not queued offline. |
| Destructive controls use explicit labels and confirmation | Keeps mistakes recoverable before deletion and preserves dependency errors. | Paycheck goal allocation deletion now uses the same existing confirmation helper as other records. |

## Ten-concept route mapping

| HTML concept | Implemented route(s) | Adaptation to real functionality |
| --- | --- | --- |
| 1. Welcome / onboarding | `/welcome`, `/sign-in`, `/sign-up`, existing guided walkthrough | Branded welcome with an honest local-only or cloud flow; existing email confirmation and sign-in are preserved. |
| 2. Home | `/` | Real latest received pay, unassigned funds, received active category budget, account/goal quick views, schedules, subscriptions, global search and quick actions. Plans are not shown as spendable income. |
| 3. Paycheck | `/paychecks`, `/paycheck/[id]` | Adds branded entry/detail while retaining planned/received workflows, original plan/current breakdown, allocation editing/reallocation and account moves. |
| 4. Budget | `/budget`, `/allocation/[id]` | Active received category totals, overspending labels/progress, categories, per-paycheck plans, archived budgets and restore controls all remain available. |
| 5. Add activity | Add sheet, `/transaction/new`, `/transactions` | Sheet passes the actual transaction type. Income now exposes its existing account field. Transfers use source/destination, including a card-payment shortcut. |
| 6. Accounts | `/accounts`, `/account/[id]` | Actual cash hero, separate debt metric, pending holds, account edit/delete, deposits, transfers and interest workflows. |
| 7. Savings goals | `/goals`, `/goal/new`, `/goal/[id]` | Real goals and separate contribution ledger; account or budget-group source; planned allocations explicitly excluded from actual progress; selective milestone mascot. |
| 8. Activity history | `/history`, `/transactions` | Real searchable/filterable history with date groups and direct record access/edit/delete. Neutral transfer/allocation amounts do not imply income or expenses. |
| 9. Categories / recurring | `/budget`, `/transactions`, Home subscriptions | Category management remains integrated into Budget; actual subscription scheduling and plan allocation workflows are retained. No invented recurring automation. |
| 10. Settings / storage | `/more`, `/profile` | Real storage-mode copy, sign-out, replay walkthrough, accounts/goals/paychecks, sample data, and management links. No fictional encryption, bank connection, sync switch, or offline queue. |

## Interface integration fixes

No files in `src/domain`, `src/state`, `src/storage`, `src/backend`, or Supabase migrations were changed. Existing integer-cent calculations, receipt idempotency, transfers, reservations, interest, deletion checks and persistence remain the source of truth.

Three small gaps were resolved in the interface:

1. Add Income and Add Transfer pass a `type` parameter to the existing transaction form; the form previously always opened Expense.
2. Income entry exposes the already-supported `accountId` field. Previously it hid the account selector. Card payments preset the existing transfer destination.
3. Settling a pending goal contribution starts as Transfer and offers that supported settlement type. The previous form started as Expense even though the existing domain operation only accepts Transfer. Historical expense contribution records remain accessible through normal transaction editing.

`src/components/activity.ts` builds and filters presentation rows without mutating data. Its tests cover planned/received labeling, signed actual amounts, neutral transfers/reminders/allocations, both transfer accounts, combined search/date filters, paycheck/category relationships, direct edit routes, ordering, and empty data. Eleven semantic foreground/background combinations are tested against WCAG 4.5:1 normal-text contrast.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 76 tests across 10 files passed, including all 60 existing financial/storage tests, 5 Activity presentation tests and 11 contrast checks.
- `npm run qa:backend`: passed. This repository's command is TypeScript plus the automated suite; it is not a live Supabase integration test.
- `git diff --check`: passed.
- `EXPO_NO_DOTENV=1 npm start -- --web --port 8094`: started successfully and served the working application. The isolated local-mode QA session did not use cloud credentials or user financial records. The first sandboxed startup could not bind its port; the normal local server succeeded after an approved execution escalation.
- `npx expo export --platform all --output-dir /tmp/scuttle-brand-v1-1-export`: web, iOS and Android Metro/Hermes bundles exported successfully. This is not native Xcode/Gradle compilation.
- Browser runtime: no warning/error messages reported during the inspected local workflows. Verified selected-tab `aria-selected="true"` after adding explicit web ARIA support alongside native accessibility state.

### Observed browser workflows

At 390 × 844 and a 320 × 740 layout check:

1. Created a real standalone received paycheck for **$1,234.56**, source **Brand QA paycheck**.
2. Created **QA Groceries** inline and assigned **$300.00** from that paycheck.
3. Created **QA Moving fund**, target **$2,000.00**.
4. From the goal's Record contribution screen, selected Paycheck budget group and reallocated **$50.00**. Goal progress became $50; the category became $250. The record explicitly says not transferred.
5. Created/categorized **QA grocery purchase**, **$42.50**. The category showed **$207.50 remaining**, with spending and allocation separate.
6. Edited that allocation to **$275.00**. The budget showed **$232.50 remaining**, total paycheck assigned **$325.00**, and unassigned **$909.56**.
7. Used Activity search **grocery purchase** and selected the Expense type filter; the matching expense appeared with a negative sign and edit access.
8. Created **QA Checking** with **$100.00**, opened Add → Income, selected the receiving account, and recorded **$12.34**. Its actual balance became **$112.34**.
9. Reloaded Home and verified records persisted. Home showed **$909.56 left to assign**, **$325 assigned from this pay**, and **$232.50 category budget remaining**.
10. Inspected welcome, empty states, populated Home, the Add sheet, entry forms, Budget, Goals, Accounts, and Activity. Verified app navigation and direct record routes during these workflows.

Screenshots are actual localhost renders, with QA records (not static implementation data):

- [Home at mobile width](brand-v1.1/home-mobile.jpg)
- [Welcome at mobile width](brand-v1.1/welcome-mobile.jpg)

### Remaining manual checks and limits

- No physical iOS/Android device, native binary build, VoiceOver/TalkBack session, or native large-text setting was tested. Font scaling is enabled and fixed-height clipping was removed, but those device checks remain necessary.
- Live Supabase sign-in, email delivery, multi-device revision conflicts, actual network loss/retry and cloud storage were not exercised. Their domain/storage regression tests pass; no new cloud configuration or migration is required.
- Planned receipt, reservation settlement, interest posting and dependency-safe deletion retain their tested domain behavior. They were not all replayed end-to-end in this browser session.
- Large datasets render in existing ScrollViews; virtualization/pagination is outside this design update.
- Existing account starting-balance/receipt rules remain unchanged. Scuttle is a manual budgeting tracker and does not move real bank money.

## Manual follow-up

Run `npm start`, open Expo Go, and use More to reach Accounts, Savings Goals, Paychecks, Profile and sample-data controls. Re-run the manual financial scenarios in `docs/core-changes.md`, then check keyboard avoidance, large text, screen reader labels, sheet dismissal, validation/retry, email auth, and cloud synchronization on actual devices.

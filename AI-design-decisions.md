# Scuttle — AI Design Decisions

Updated November 2, 2026. Consolidated record of the financial foundation, initial AI design, UX evaluation, implementation decisions, and verification.

## Design evolution

| Stage | Branch | Outcome |
| --- | --- | --- |
| Financial foundation | `CoreChanges` | Planned/received paychecks, preserved allocation breakdowns, and category-to-goal reallocation. |
| Brand v1.1 | `AI_Designed_App` | Working branded application based on the supplied implementation prompt and HTML references; shared components, mascot, navigation, and accessible financial presentation. |
| Independent UX refinement (consolidated) | `AI_Designed_App` | Faster paycheck budgeting, combined receipt review, simpler screens, stronger draft protection, and additional financial regression tests. |

The initial design retained the current functional application because `main` contained only the initial repository commit. No work was merged into `main`. The second iteration deliberately revisited earlier decisions rather than treating the wireframes as final.

This work involved repository inspection, heuristic evaluation, implementation, automated tests, and developer browser walkthroughs. **No real-user usability study or physical-device validation is claimed.**

## Objective and audit

Help a busy person receive a paycheck, understand their money, assign it confidently, and move on with minimal effort.

The audit traced routes and shared components through the provider, domain calculations, validation, and storage. Existing capabilities included paychecks, accounts/card payments, categories, expenses/income/transfers, goals/reservations, recurring reminders, interest estimates/postings, archives, payday schedules, sample data, authentication, and local/cloud persistence.

The main problems were:

- Category-by-category forms and saves made budgeting repetitive and prevented convenient rebalancing of a fully allocated paycheck.
- Lower actual income required adjusting allocations elsewhere before returning to receipt review.
- Home and Budget put search, administration, switches, and secondary controls ahead of the primary task.
- Repeated View/Edit/Delete buttons made lists noisy; inline selectors expanded unpredictably and could clear a selection when tapped again.
- History mixed financial transactions with plans and allocation records without an obvious default distinction.
- Draft loss, raw money-validation errors, ambiguous labels, and long onboarding increased unnecessary thinking.

Priority went to the paycheck workflow and financial safeguards, then information hierarchy, forms, navigation details, and accessibility. No financial amounts were automatically recommended or redistributed: that would guess the user's priorities.

## Visual and interaction system

The supplied archive was extracted and all three files were read. `SCUTTLE_CODEX_IMPLEMENTATION_PROMPT.md` guided the first implementation; `scuttle_brand_exploration.html` was the main visual reference, with the earlier wireframes as background. The browser blocked the local reference URL, so its HTML/CSS was inspected directly. The optional movie was not supplied.

- Evergreen `#123B35`, teal `#137B68`, lime `#D9ED9A`, warm paper `#FAF8EF`, and coral-family caution surfaces form a semantic color system. Darker caution text preserves contrast; labels also communicate financial status.
- Native system typography, wrapping, tabular money figures, generous touch targets, visible focus, and shared form controls support readability and font scaling without new dependencies.
- The native geometric mascot refines the supplied shell/head/eye/legs concept. Ready, rest, and celebration variants are used selectively in branding, empty states, and milestones.
- Shared components establish consistency across real routes. No illustrative reference amounts were embedded as production data.
- Home / Budget / Add / Activity / More remains the navigation structure. Existing Stack routes and deep links were retained to avoid unnecessary migration risk.
- Record rows open directly; their contextual menus expose edit/delete. Destructive operations retain confirmation and dependency checks.
- Selection sheets scroll, offer search for longer lists, and have an explicit Clear selection action. Account/category creation remains available in context.

## UX refinement

| Area | Decision and reason |
| --- | --- |
| Home | Put the paycheck and budgeting action first. Show category budget remaining and recorded account balances as different quantities. Keep other unassigned pay visible. Search and payday editing are available on demand. |
| Paychecks | Explicit Received / Plan ahead choice. Optional account association preserves standalone budgets. Save paycheck & budget saves the paycheck first and opens its planner directly. Stable IDs and submission guards prevent duplicate creation. |
| Planner | Edit category and goal amounts together, with a live remaining total and a fixed footer. One save commits the entire distribution. Show recorded spending beside affected categories and prevent invalid, excessive, or below-spent amounts. Skip blank new rows. Done exits unchanged reviews without writing history. |
| Receipt | Review actual pay, receiving account, date, and revised allocations together. Save receipt and the plan atomically while preserving the original distribution. |
| Budget | Default to Spending; separate Planned and Archived views. Keep category administration and recurring bills in disclosures. Show the active-budget summary only in Spending. |
| Transactions | Amount-first entry, explicit types and accounts, collapsed optional notes, readable errors, and type-specific save labels. Transfers and card payments remain distinct from expenses. |
| Accounts | Separate cash from debt and pending holds. Use one account-type selector. Retain detail activity, transfers/card payments, and interest estimates/posting; collapse secondary explanations. |
| Goals | Clear targets and progress. Preserve account reservations versus paycheck-category contributions. Starting progress, target date, and notes are optional; contributions do not imply automatic cash transfers. |
| Activity | Money activity defaults to received pay, income, spending, and transfers. All records includes plans, allocations, goals, and reminders. Keep search, date/category/paycheck/account/type filters and direct record controls. |
| Settings/auth | Retain accounts, goals, paychecks, profile, recurring tools, and accurate storage information. Collapse sample-data tools. Shorten welcome and reduce the tour from twelve steps to five, with Skip and Replay. Existing authentication remains unchanged. |

The ten original concepts map to the existing welcome/auth, Home, paycheck, Budget/allocation, transaction, account, goal, Activity, category/recurring, and More/profile routes. Categories remain integrated into Budget; no fictional bank connection, sync switch, encryption claim, or offline queue was introduced. Local mode is available only when cloud configuration is absent.

### Second evaluation

Developer walkthroughs prompted further corrections:

- A fully budgeted paycheck now shows its received amount with “$0 left to budget,” rather than a large zero that could look like an empty account.
- Same-day ordering selects the most recently added paycheck. Automatic category matching follows the same rule while preserving existing expense assignments and skipping planned/archived budgets.
- Repeated categories and goal allocations identify their source paycheck.
- The planner labels unsaved edits and suppresses global saved notices caused by separately creating a category. New category names save independently; cancelling the plan does not remove them.
- Nested cards and lengthy planner instructions were reduced after small-screen inspection.
- Back/unload protection warns before discarding a plan draft. Cancelling preserves inputs; discarding leaves saved financial records unchanged.
- Missing edit records show safe not-found states. Cold-loaded allocation links wait for their records instead of initializing incorrectly.
- Percentages identify their meaning: spent, budgeted, or toward goal.

## Financial model and safeguards

Money remains integer cents. Account balances, category budgets, unassigned pay, and goal progress are separate concepts and are never added together as available money.

**Paychecks:** Optional `status` distinguishes planned and received income; legacy records without it retain received semantics. Planned amounts/dates do not affect actual account, spending, interest, or completed-savings totals. Receipt preserves `plannedAmountCents`, `expectedAt`, `actualAmountCents`, and `originalPlan`; current `amountCents` becomes actual income. The paycheck itself remains the single income ledger event—no duplicate income transaction is inserted. Received breakdowns remain editable and accessible.

**Goals:** Paycheck allocations reuse contributions with `paycheckId` and `status: allocated`. Received allocations count toward designated progress, planned allocations do not count toward actual progress, and neither represents completed cash movement. Account-backed pending reservations, same-account designation, and explicit transfer settlement remain separate. Allocation-only changes do not alter account balances.

**Atomic planning:** `paycheckPlan.ts` validates the final category/goal distribution before returning state, allowing increases and decreases in one operation. It protects references, existing IDs, recorded spending, recurring allocations, and account-backed/settled contributions. It rejects invalid/unsafe amounts, duplicate IDs, missing rows, over-income totals, and stale drafts. A scoped fingerprint detects intervening changes; stable operation IDs prevent repeated saves. Existing goal rows set to zero return their amounts to unassigned funds.

Receipt composes with the plan operation so both succeed or neither does. Original planning information is captured before adjustments. Receipt validation uses actual income capacity, including when actual pay exceeds expected pay. Failure returns the original snapshot.

**Persistence:** The provider still serializes mutations and saves before publishing state. AsyncStorage and owner-scoped, revision-checked Supabase snapshots remain unchanged. Conflicts fail instead of overwriting newer data. Existing version 2 JSON supports these records; **no new migration or cloud setup is required** beyond the existing migrations. Older releases should not edit records whose planned status they do not understand.

Primary implementation areas: `app/`, shared UI/brand/Activity components, semantic design tokens, `paycheckOperations.ts`, `paycheckPlan.ts`, money validation, and shared paycheck ordering. The provider's refinement is limited to newest-paycheck selection for recurring planning. Interest calculations, authentication, storage adapters, and database migrations were preserved.

## Verification

| Stage | Automated result |
| --- | --- |
| Financial foundation | 60 tests; TypeScript and web/iOS/Android exports passed. |
| Brand v1.1 | 76 tests, including Activity presentation and contrast checks; TypeScript, backend QA, and exports passed. |
| UX refinement | **98 tests across 13 files passed**, including 22 added cases. TypeScript, backend QA, exports, and `git diff --check` passed. |

Commands: `npm run typecheck`, `npm test`, `npm run qa:backend`, and `npx expo export --platform all --output-dir /tmp/scuttle-ux2-export`.

Backend QA means tracing screen actions through domain/storage boundaries and checking valid/invalid creation, edits, dependency-safe deletion, references, balances, migrations, duplicate prevention, and failure behavior. Coverage includes cash/card sign conventions, transfers, reservations, interest/rate history, subscriptions, sample data, dates, and persistence adapters. The QA script runs TypeScript and Vitest; it does **not** constitute a live Supabase test. Exports verify Metro/Hermes bundles, not native binary compilation.

### Observed local browser scenarios

The working Expo app at `http://localhost:8094` used clearly labeled synthetic records in local mode:

1. Created a $1,234.56 paycheck, inline category, and savings goal; assigned category funds and contributed from the goal's paycheck-category selector.
2. Rebalanced Groceries from $275 to $225 and a goal from $50 to $100 in one save. Total assigned stayed $325; unassigned stayed $909.56; account balances did not change.
3. Entered an excessive amount; the planner showed the overage and disabled Save.
4. Created an $800 planned paycheck and saved Groceries $300, Rent $300, and goal $100 together. Inline category creation did not require leaving the draft.
5. Received that plan at $650. Confirmation remained blocked until reducing Groceries to $250. One save preserved the original $800 / $300 / $300 / $100 plan and credited the account exactly $650, from $112.34 to $762.34.
6. Verified cancel/discard behavior for unsaved drafts. Recorded a $10 expense in the newer same-day category: its remaining amount became $240, the older category stayed $182.50, and actual cash became $752.34.
7. Checked Activity scopes, filters, and record actions; archived/restored a budget; reloaded and verified persistence. Final category budget remaining was $722.50, with $909.56 unassigned in the older paycheck.
8. Inspected 390 × 844 and 320 × 740 layouts, including the planner footer. Inspected runtime logs without reported warnings/errors during the checked flows.

Screenshots: [initial Home](docs/brand-v1.1/home-mobile.jpg), [initial welcome](docs/brand-v1.1/welcome-mobile.jpg), [refined Home](docs/ux2/home.jpg), [refined planner](docs/ux2/paycheck-plan.jpg).

## Remaining checks and limitations

- No real-user study, physical-device test, native binary build, VoiceOver/TalkBack session, or native large-text/keyboard validation has been performed.
- Live Supabase authentication/email, owner isolation, remote revision conflicts, network failure, account switching, and native-device persistence remain manual checks. Automated adapter tests use mocks.
- Plan navigation is guarded, but drafts do not survive app termination. Other legacy forms still primarily use explicit Save/Cancel and submission guards.
- Recurring allocation amounts remain managed through the existing recurring workflow. Existing paycheck account moves remain a separate transaction workflow.
- Lists still use ScrollViews. Pagination, virtualization, and measured completion times require further work.

For device checks, run `npm start`, exercise planned/received paychecks and allocation-only edits, verify balances/history, retry invalid submissions, and restart the app. Repeat in local and configured cloud modes.

For Supabase integration, use a disposable project with both existing migrations applied: test registration/session restore/sign-out; two-user RLS isolation; competing writes at the same revision; snapshot ownership/migration; failed saves without false success; and user-scoped walkthrough metadata. Use synthetic test records rather than production financial data.

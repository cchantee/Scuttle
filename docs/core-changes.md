# Paycheck planning and goal reallocation

Implemented on branch `CoreChanges` with existing screen styles and navigation.

## Financial model and persistence

Paychecks have optional `status` (`planned` or `received`). Existing records without a status retain received semantics. A planned paycheck's `amountCents` and `receivedAt` represent expected income and date. It cannot have account credit metadata and is excluded from actual balances, interest balances, spendable budget summaries, and automatic expense allocation matching.

Mark as Received starts receipt review and saves `originalPlan` (amount, expected date, source, notes, category allocations, goal allocations). Adjustments during review do not overwrite this snapshot. Receipt records `plannedAmountCents`, `expectedAt`, `actualAmountCents`, actual `receivedAt`, and the receiving account. Current `amountCents` becomes actual income. Overallocated receipts are rejected until allocations are reduced. Reopening receipt review retains the first saved snapshot.

The paycheck itself remains the income ledger event, consistent with existing Scuttle accounting. Receipt does not also insert an income transaction. Repeated receipt attempts are rejected. The paycheck and its editable breakdown remain in the paycheck list.

Goal allocations reuse contributions with `paycheckId` and `status: allocated`. They do not represent a bank transfer, debit, or completed savings contribution. Received allocations count toward designated goal progress; planned allocations are visible but excluded from actual goal progress. Both are excluded from completed savings totals. Existing account-backed pending reservations and settlement flows remain separate.

Category-to-goal and category-to-category reallocations reduce only unspent source funds. They preserve the total allocated amount and unallocated amount. Linked subscription allocations must be removed/replanned rather than directly reallocated. Changes to category/goal allocations and their removals are retained in paycheck allocation history.

The provider serializes mutations and saves the entire resulting snapshot before publishing it to React state. Invalid operations return the original state. Reallocation IDs make retries idempotent. The UI also guards repeated submissions while saving. Cloud saves continue to use the revision-checked `save_scuttle_data` RPC; conflicts fail rather than overwrite another device's changes.

No database migration is required: the existing v2 JSON snapshot supports these additive optional fields, and both local and cloud adapters preserve them. Existing Supabase migrations 001 and 002 must already be applied. No new manual Supabase configuration is needed. Older application releases should not edit newly planned paychecks because they do not understand planned status.

## Modified files

- `src/domain/models.ts`: additive paycheck planning/history and contribution linkage fields.
- `src/domain/calculations.ts`: planned/actual summaries and allocation validation.
- `src/domain/store.ts`: validation, relationships, history, immutable receipt safeguards.
- `src/domain/paycheckOperations.ts`: atomic receipt review, receipt, and reallocation operations.
- `src/state/DataProvider.tsx`: queued atomic operation integration; disallow moving planned money.
- `app/paychecks.tsx`, `app/paycheck/[id].tsx`: planning, receipt, editable goal allocations, reallocation, original plan/history.
- `app/budget.tsx`, `app/allocation/[id].tsx`: planned labels and spending controls.
- `app/goal/[id].tsx`, `app/history.tsx`, `app/index.tsx`: accurate status and summaries.
- `src/domain/paycheckOperations.test.ts`, `src/storage/paycheckPersistence.test.ts`: financial and persistence regression coverage.

## Manual Expo verification

1. Run `npm start`. Use the configured Supabase sign-in, or use a separate build without cloud environment variables to exercise local storage.
2. Create a checking account, two budget categories, and a savings goal.
3. In Paychecks, add a paycheck, choose Plan future paycheck, enter $1,200 and a future date, and save.
4. Open it and add category allocations. Allocate some unallocated money to a goal. Verify the account balance, dashboard spendable budget, and completed savings have not increased.
5. Select a source category, a destination goal, and $50; confirm allocation. Verify the category decreases and goal allocation increases by $50, while total allocation and account balance remain unchanged. Try zero and more than the source's remaining funds; both must fail.
6. Choose Mark as Received. Enter $1,150, select checking, and review allocations. If allocated amounts exceed $1,150, confirmation must fail. Edit categories or goal allocations, then reopen receipt review and confirm.
7. Verify checking increased exactly $1,150, original planned amount/date/distribution remain visible, and the received paycheck is still accessible. Repeated receipt must not add income.
8. Log an expense against a received category. Try reallocating more than its unspent balance; it must fail. Move eligible funds to another category or goal; account balance must remain unchanged.
9. Edit a goal allocation from the paycheck using its Edit control; save the revised amount. Delete one and verify its money returns to unallocated funds.
10. Restart Expo/reload. Verify current and original allocations, receipt, history, and account balances persist. Repeat with local and cloud storage. For a cloud revision conflict, reload before retrying.

Automated storage tests mock AsyncStorage and Supabase. They verify serialization, revision use, and failure propagation, but do not replace live device and Supabase checks. Native binary compilation and interactive device QA are separate from Metro export verification.

## Automated verification

- `npm run typecheck`: passed.
- `npm test`: 60 tests across 8 files passed (including 15 new regression tests).
- `git diff --check`: passed.
- `npx expo export --platform all --output-dir /tmp/scuttle-corechanges-export-final`: passed for web, iOS, and Android. This verifies JavaScript/Metro bundles, not native Xcode/Gradle compilation.

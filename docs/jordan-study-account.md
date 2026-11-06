# Jordan Taylor fixed study fixture

The shared source is `src/domain/jordanStudy.ts`. Use this identical fixture in the human-only (`Chantes_Designed_App`), AI-only (`AI_Designed_App`), and human+AI (`AI_And_Me_Designed_App`) interfaces, connected to the same Supabase project and existing Jordan account. Jordan is the only supported sample/test dataset. Generic sample loading/deletion controls and their unused generator have been removed. Existing stored records on other profiles are not migrated or deleted. The researcher reset is a protected terminal command; participants have no reset control in the app.

## Corrections and interpretation

The supplied 33 expense rows total **$3,240**, not $3,353. The user confirmed **$180** opening checking. Checking reconciles as $180 + $3,280 paychecks + $205 gig income − $3,240 expenses − $180 internal savings transfers = **$245**. Savings is $500 + $180 = **$680**. The $120 pending Emergency Fund reservation leaves **$560 available savings**, counts toward its $1,000 target (12%), and does not move money. No interest credits are seeded; the existing estimate/posting behavior and 3.5% APY are preserved.

Each supplied allocation column already balances: $703/$828/$633/$793 allocated and **$57/$62/$77/$127** unallocated. Zero-dollar category allocations are represented by absence, since normal domain validation requires positive allocation amounts. Savings allocations are budget plans, not transfers. Expenses link to the latest paycheck received on/before their date when that category has an allocation. Pre-first-payday expenses and categories without allocations stay unbudgeted. Overspending remains visible.

Only two expense dates were changed to eliminate overdrafts: September rent is paid on **September 25** (previously September 11, originally September 7), and October rent on **October 23** (previously October 1). These are late monthly payments after the same-day bookstore deposit; no agreement, fee, extra income, or expense is invented. The other 31 expense dates, all 33 amounts, paycheck dates, gig income, and savings transfers remain unchanged.

`auditJordanAccountHistory` replays every ledger event with the application's account calculations, starting September 6. Date-only records use a documented same-day sequence: deposits, expenses, transfers, reminders; rent follows the paycheck deposit. Both accounts must stay nonnegative after every event; the reset verifier refuses any historical overdraft, even if ending balances reconcile. Minimum checking is **$102 on September 10**; minimum savings is **$500**.

Budget overspending remains separate from bank balances. The final paycheck's Groceries allocation is **$100**, actual spending **$140**, and remaining **−$40**, while ending checking is **$245**. Allocations do not move money, reservations only reduce available savings, reminders do not post charges, and the actual grocery expense debits checking exactly once. Negative category amounts remain visible and are labeled “Over budget”; no account balance is clamped.


## Fixed dates

Snapshot: **November 5, 2026**. Scenario payday: **November 6, 2026**. The user snapshot carries `studySnapshotDate`; countdowns, reminders, form dates and interest previews use it. Other accounts keep using the real clock. The fixture contains no $850 paycheck, Moving Fund, $300 goal contribution, Friend Outings category, or $28 grocery expense.

## Verify and reset

Use Node 24 and install the project's dependencies. First run:

```sh
npm run qa:backend
npm run study:jordan -- verify
```

For a live reset, create ignored `study.secrets.local` from `study.secrets.local.example`. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the existing study project's server credentials. Never use an Expo public variable for the server key. No Jordan password is needed.

Stop using all participant interface sessions before resetting (no sign-out is required), then run:

```sh
npm run study:jordan -- reset
```

The command displays **“Reset Jordan Taylor Study Data?”** followed by:

> This will erase all changes made during the current testing session and restore Jordan Taylor's original financial data. This action cannot be undone.

Type **RESET JORDAN** at the terminal prompt to confirm. Any other answer cancels without reading or changing the database; noninteractive resets are refused. The server key is available only in local researcher tooling and is never imported into Expo. Anyone with that server key has administrative access, so it belongs only on the researcher's machine.

On success the command displays:

> Jordan Taylor's study data has been restored. The account is ready for the next testing session.

Failures exit with an error and do not display success. The entire financial JSON snapshot is replaced by one atomic, owner-scoped PostgreSQL UPDATE, guarded by the prior revision. No collection is deleted or written separately; a rejected write leaves the row unchanged. The UPDATE returns the stored snapshot, which must exactly match the baseline before success is reported.

Verify the **actual stored data** before starting the next session:

```sh
npm run study:jordan -- verify-live
```

`verify` checks the local fixture without credentials; `verify-live` reads Jordan's stored snapshot and rejects any participant-created, modified or missing baseline records. It does not write data.

Reload the interface after resetting. The command finds the existing `jordan.taylor@example.com` auth identity and replaces only that user's financial snapshot. It never creates an auth user or changes email, password, auth metadata, or user UUID. It refuses a missing account or snapshot. Resets replace participant activity with deterministic IDs and dates and increment the storage revision; a compare-and-swap prevents overwriting a concurrent save. Stored financial data is identical after every reset (revision/update timestamp track the reset itself).

No new database migration is required: the existing v2 JSON snapshot schema supports the records and optional study date. Both existing Supabase migrations must already be applied. Verification and automated reset tests do not contact Supabase. A live reset requires the configured server credentials.

## Between interfaces and participants

1. Stop interacting with the current interface.
2. Run `npm run study:jordan -- reset` and confirm in the terminal.
3. Run `npm run study:jordan -- verify-live`.
4. Open/reload the next interface, using Jordan's existing login.
5. Repeat the reset and verification before **each** interface and each participant.

All three interfaces share the same user row, so switching an interface alone does not reset it. Revision increments reject writes from stale sessions. A reset does not sign Jordan out, alter Supabase Auth, touch unrelated users, or restore authentication metadata. If a network error leaves the reset outcome uncertain, run `verify-live` or repeat the confirmed reset before testing.

Jordan’s account names are **Capital One 360 Checking** ($245) and **Capital One 360 Performance Savings** ($680; $560 available after the $120 reservation). The savings **3.5% APY is simulated for the fictional study**, not a claim about Capital One’s current rate. Account IDs and all financial amounts remain unchanged.

When a new current paycheck is received, older received paycheck budgets are archived automatically; their allocations and spending history are retained. Planned income does not close the current budget, and backdated income does not replace a later active budget. Expenses automatically match an active category allocation and default to its paycheck’s associated account (or its current holding account after a transfer). The account field stays visible and editable; manual overrides survive category/paycheck changes. Without a linked paycheck, an existing checking/cash account is used or the form asks for an account. One expense updates both the budget and account ledger exactly once. Expenses and transfers that would overdraw any affected cash account at any historical event are rejected atomically; budget categories may still be negative.

### Sign-out after reset
Reset also changes Jordan’s admin-owned session reset marker. Updated interfaces sign Jordan out within 15 seconds while online, or when the app returns to the foreground. Offline devices sign out once they reconnect. Credentials and account identity remain unchanged; a new sign-in starts the next participant session. No database migration is needed.

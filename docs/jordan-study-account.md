# Jordan Taylor usability-study account

Jordan Taylor is a development-only, resettable participant account. The live app never receives a server key or the account password.

## One-time setup

Create an ignored `study.secrets.local` beside `package.json` from `study.secrets.local.example`. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `JORDAN_TAYLOR_PASSWORD` there. This filename is deliberately not an `.env*` file, so Expo never imports it into the app. Use a Supabase server secret/service-role key only; never use an `EXPO_PUBLIC_` variable for it.

Run:

```sh
npm run study:jordan -- provision
```

This creates (or refreshes) only `jordan.taylor@example.com`, confirms the email, and writes that user's complete starting snapshot.

## Between participants

```sh
npm run study:jordan -- reset
```

Reset replaces only Jordan's `scuttle_user_data` row and sets its revision back to 1. It does not read, change, or delete any other user's records.

The fixture has five historical variable-pay paychecks, checking/savings accounts, the required budget categories, transaction history, and a $15 StreamFlix reminder. It deliberately has no $850 paycheck, $300 Moving Fund cash, Moving Fund, $28 grocery transaction, or Friend Outings category.

## Participant flow check

The target $850 paycheck must finish with $325 assigned and $525 left to budget: Groceries $120, Gas $100, StreamFlix $15, Moving Fund $50, Friend Outings $40. After the paycheck is marked received, recording the $28 grocery expense leaves $92 in its $120 grocery allocation. The $300 entered as the Moving Fund's existing cash is separate from that paycheck.

`npm run study:jordan -- verify` checks the starting fixture locally without calling Supabase. The app's typecheck and test suite were run on both interface branches after this setup was added.

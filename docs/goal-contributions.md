# Goal contributions

Reserved funds stay in the holding account and reduce its uncommitted available balance. Confirm saved changes only the contribution status; Saved funds remain committed. Neither action creates bank activity.

Move money records one internal transfer, changes the contribution holding account, and preserves its amount and Reserved/Saved status. Other commitments and chronological bank balances are protected. Same-account moves are rejected. Legacy posted expense contributions remain historical expenses; legacy posted transfers remain committed in their destination account.

No database migration or study reset is required. Existing status values remain compatible. Jordan’s fixture is unchanged.

Verification: `npm run typecheck` and `npm test` in each interface checkout. `src/domain/goalFunds.test.ts` covers persistent commitments, repeated confirmation, Reserved and Saved transfers, account reconciliation, duplicate moves, same-account rejection, protected funds, and overdrafts. Existing interest lifecycle and backend QA expectations now reflect Saved commitments.

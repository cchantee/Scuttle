# Focused human interface

Home keeps the coastal current-paycheck card, payday, one reminders entry, and three budget previews. Full account, goal, activity, and planned-paycheck lists live on their own pages. The tour has six short steps.

Paychecks defaults to the current received paycheck. Other paychecks are hidden behind a button; their records are not deleted or altered.

Transactions defaults to This paycheck. An explicit budget/paycheck link wins; otherwise an unlinked record belongs to the received-date period up to (excluding) the next payday. All shows historical activity. Scheduled reminders live on Bills & reminders and have no bank effect. Saving a transaction returns to Transactions. After a scenario paycheck later than the fixed snapshot date, the editable transaction draft date defaults to that paycheck date.

Receiving or adding a paycheck opens a reminder box only when bills/subscriptions fall before its next payday. Saving plans, editing received paychecks, loading the app, and researcher resets do not generate a receipt alert. Reminders never post charges or create allocations.

StreamFlix’s reset fixture is due November 14, 2026 across all conditions. Existing live data was not reset by this UI change; the next researcher reset applies that date. Historical paid charges are unchanged.

Tests cover period boundaries, account-neutral reminder calculations, archived activity, repeated/edited receipt events, reset detection, and the fixed study clock. Browser checks used isolated fictional local data with Supabase disabled: archive expansion, receipt popup, new transaction routing, This paycheck/All, and reminders navigation.

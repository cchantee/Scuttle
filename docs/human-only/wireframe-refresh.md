# User-directed coastal layout refresh

Scope: `Chantes_Designed_App` only. The user's wireframes guide layout and hierarchy; the existing human-authored palette and coastal identity remain the source for styling.

## Preserved

- The exact existing color palette in `src/design/theme.ts`.
- Original line-art crab paths, watercolor shoreline asset, decorative brand/greeting/message fonts, and completion animations.
- Reduced-motion behavior; native animation remains enabled, with a web-safe JS driver for browser previews.
- Account/paycheck/budget calculations, Jordan's fixture, account reservations, financial validations, and persistence.
- Existing navigation routes, quick actions, editable forms, search, payday configuration and walkthrough targets.

## Visual changes

- Dashboard: a tappable paycheck hero, clear planned/left-to-assign amounts, compact account/goal/budget groups, quiet payday row, contextual search and coastal illustration.
- Shared UI: readable body text while retaining the user's decorative accents, true font weights, consistent rounded cards, more generous field/tap sizes, full-width selectors and compact inline progress indicators.
- Detail screens: coastal account balance cards, centered goal progress, explicit reservation copy, clearer paycheck allocations and a two-column transaction-type selector.
- Account and budget money remain distinct; category overspending stays visible without changing the ledger.

## Visual verification

An isolated local-only web preview was populated with the fictional Jordan baseline. Supabase was disabled; no live study data was modified. Temporary preview seeding files were removed. Phone layouts were inspected at 390 × 844 and 320 × 740; the smaller viewport had no horizontal overflow. Account navigation, goal navigation, paycheck detail, quick actions and transaction entry were checked without saving participant activity.

Screenshots: [Home](screenshots/coastal-refresh-home.png), [Account](screenshots/coastal-refresh-account.png), [Goal](screenshots/coastal-refresh-goal.png), [Paycheck](screenshots/coastal-refresh-paycheck.png), [Transaction](screenshots/coastal-refresh-transaction.png).

Validation: `npm run qa:backend` (typecheck and 79 tests), local Jordan verification, and an Expo iOS bundle export. Physical iPhone verification remains a follow-up to the browser and bundle checks.

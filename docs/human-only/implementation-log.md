# Human-only implementation log

## 2026-11-05 — Phases 1 and 2 only

Human request: attached “SCUTTLE — HUMAN-ONLY INTERFACE” specification, specifically
sections 4, 21, and 24. Work stays on Chantes_Designed_App, based on Baseline_App.
No application-wide font roles or interface design has been approved.

### Repository inspection

- Expo Router screens: `app/`; shared presentation/navigation: `src/components/ui.tsx`.
- Shared financial functions and operations: `src/domain/calculations.ts`,
  `src/domain/store.ts`, and `src/domain/models.ts`.
- Persistence/authentication: `src/storage/`, `src/backend/`, `src/state/DataProvider.tsx`.
- No domain, data, storage, authentication, or financial behavior changes made.
- Baseline navigation currently includes Budget rather than the specified Paycheck tab;
  this is a later-phase design implementation item, not changed in the preview.
- Existing available-account balance subtracts pending savings holds; it does not
  subtract every budget commitment. Before implementing “Available to Spend,” confirm
  which supported financial metric should be displayed. Do not invent a calculation.
- Planned/received paycheck workflows and category-to-goal reallocations need a later
  capability review against this baseline before promising parity with the spec.

### Font inspection

All files report Regular, weight 400. No separate bold/italic weights were supplied.
Font binaries were inspected without modifying their outlines or family names.

| Family / PostScript name | Supplied files | Import status / license notes |
| --- | --- | --- |
| Coastal Musk / CoastalMusk | TTF | TTF imported unchanged after human confirmed permission for the study; supplied Readme and embedded license say personal use only. |
| Mayonice / Mayonice | TTF, OTF | TTF imported unchanged; both are the same named Regular face, so OTF is not duplicated. More Info.txt permits personal and commercial use. |
| Playful Lines / PlayfulLines | OTF | OTF imported unchanged after human confirmed permission for the study; supplied Read Me.txt and MJTYPE-EULA.pdf restrict promotional/commercial use. |
| Stay Playful / StayPlayful | OTF, TTF | TTF imported unchanged after human confirmed permission for the study; no license supplied. Both signatures identify TrueType outlines despite one .otf extension; only one Regular face retained. |

Mayonice's Read Me.pdf has no extractable text; More Info.txt contains the explicit
use statement. Original PDF and text are preserved with its font. No font substitutions
were made. TTF/OTF formats are supported by Expo; physical-iPhone rendering is unverified.

### Development preview

- Added direct expo-font dependency and route-local `useFonts` loading; no global fonts.
- `app/typography-preview.tsx` uses the six exact requested samples at a consistent size.
- All four fonts show identical samples after successful loading. Errors hide samples rather than silently showing fallback fonts.
- Access in Expo development: More → Typography Preview (development only).
- Native deep link while Expo Go is connected: `exp://<Metro address>/--/typography-preview`.
- Production builds guard the preview route and omit its navigation entry.
- Colors are applied only to this temporary comparison screen.

### Pending human decisions and assets

- Human approval received: “I have permission for all four fonts.” All four are now
  imported for the study preview; included licensing documents remain alongside them.
  This confirmation does not assign any font to an application-wide role.
- Human-selected wireframe, crab, shoreline illustration, and animation assets are missing.
  Do not create substitute mascot art without approval.
- Six typography roles remain unassigned. Wait for human selections, then present the
  Phase 3 plan and wait for approval before full interface implementation.

### Verification

- TypeScript checking passes after Expo regenerated the development route types.
- iOS JavaScript export passes and includes all four unchanged font assets.
- All characters used in the six requested sample strings map to nonzero glyphs
  in each font's Unicode cmap, including the financial digits and dollar sign.
- `git diff --check` passes. No financial source files changed.
- Physical-iPhone rendering, clipping, dynamic text layout, and visual comparison
  remain for the human's Expo Go review. Export success is not device verification.

## 2026-11-05 — Preview font-download troubleshooting

- Human reported Expo Go could not download the Coastal Musk asset from Metro.
  The previous shared loading hook displayed that single error under every font.
- Load each font independently, with a per-font retry action, so one failed download
  cannot hide the other samples. Hide verbose internal asset URLs in the preview.
- Removed spaces from the three affected asset filenames to simplify development
  download URLs. Font bytes, internal family names, and outlines remain unchanged;
  verified byte-for-byte against the supplied ZIPs.
- Installing fonts in macOS does not replace Expo Go's bundled-asset loading.
- TypeScript checking passes. Live iPhone download still needs a cleared Metro
  cache and device reload; filename encoding is a suspected cause, not confirmed.

## 2026-11-05 — Human typography selections

Human selected:

- Playful Lines: Scuttle title/wordmark and default application font.
  Treat page headings, section headings, body labels, and navigation as using
  this default unless the human specifies an override.
- Mayonice: “Your money has a plan,” “make every paycheck count,” and similar
  encouraging/tagline messages.
- Stay Playful: all displayed monetary values and “Good morning [user]” greeting.
- Coastal Musk: no application role assigned; retain in development comparison only.

These are human-authored choices, not AI font recommendations. No global typography
has been applied yet. Next step is human approval of the Phase 3 implementation plan,
per sections 21 and 24 of the supplied specification. Wireframe and approved mascot/
shoreline assets are still outstanding for corresponding full-interface work.

## 2026-11-05 — Full-interface approval and implementation

Human explicitly approved the full interface from the written specification and
provided the coastal and ten-screen wireframes as layout references. Human also
approved creating minimal doodle artwork, then requested a simplified watercolor
scene and specified that its crab must match the doodle already in the app.

### Implemented presentation

- Cream #FAF9F6 canvas, white cards, thin #E9E7E2 borders, modest corners, and the
  exact human-selected coastal palette. Wireframe colors/fonts did not replace
  the user's written palette or typography assignments.
- Central runtime font loading, reusable text/input components, currency-span
  formatting, and retry on font download failure.
- Fixed Home / Accounts / + / Paycheck / Goals navigation. Plus opens a floating
  upward menu with Add Transaction, Add Paycheck, Move Money, and Add to Goal.
  Outside tap, action selection, and tapping plus again dismiss the menu.
- Home hierarchy: Available to Spend, This Paycheck, Active Budgets (everyday
  categories prioritized), Upcoming Bills, Savings Goals, Recent Transactions.
  Search and payday scheduling remain accessible below these summaries.
- Available to Spend uses the existing unallocated-paycheck calculation, scoped
  and labeled as unassigned money from the latest active received paycheck. It
  does not claim to be a combined bank-account spending guarantee.
- Compact paycheck allocation rows, remaining-to-assign card, fixed Add Allocation
  action, and focused allocation entry with live remaining amount.
- Account, category, goal, transaction, authentication, and secondary tools use
  shared typography/components. Goal detail includes a labeled progress ring.
- Short crab scuttle animation with reduced-motion support, shoreline welcome,
  empty-state companion, and inline completion messages.
- Kept existing sample-data, recurring reminders, interest tools, profile,
  authentication, editing, deletion safeguards, and history functionality.

### Required functional additions and safeguards

Before implementation, explained that the baseline lacked explicit planned-paycheck
status and paycheck-linked goal contributions. Added only these bounded extensions:

- Optional planned/received paycheck status; legacy paychecks keep received behavior.
- Planned paychecks have no deposit account and cannot be spent or moved as income.
- Receiving a plan updates the same paycheck once with its actual amount/date and
  one account credit; allocations survive. Repeated receipt is rejected.
- Optional contribution-to-paycheck link, included in assigned/unassigned totals.
- Atomic category-to-category or category-to-goal reallocation uses only unspent
  funds. Goal funding follows existing pending-hold semantics where an account is
  present. Reallocation creates no account transaction or withdrawal.
- Existing storage adapters, authentication, cloud RPC, and schema version remain.
  New optional metadata survives the existing snapshot migration. Extended sample
  deletion's dependency guard to cover the new contribution-to-paycheck link.

### Later human revisions

- Human requested closer matching to the wireframe's format rather than new styles.
  Tightened list rows, moved secondary paycheck actions into its actions menu, kept
  a single fixed Add Allocation action, and separated list amounts from metadata.
- Human expressly allowed changing dollar-value typography. Financial amounts now
  use platform system semibold for legibility. Playful Lines remains the default
  and title font; Mayonice remains for taglines/encouragement; Stay Playful remains
  for Good morning greetings. This supersedes the prior money-font assignment.
- Available to Spend is now a full-width illustrated card: label/amount on the
  left, watercolor shoreline along its bottom, and matching doodle crab on the right.

### Verification and limits

- TypeScript checking and all 49 tests pass, including four new workflow regression
  tests for planning, single receipt, reallocation, and rollback.
- iOS bundle export passes with the fonts and watercolor asset included.
- Browser checked at phone-sized width using isolated local storage with cloud
  configuration disabled only in the preview process. Actual .env is unchanged.
- Browser verified welcome, all four font rendering, populated Home, floating quick
  menu, focused allocation draft ($1,200 minus $300 = $900), persistence after saving,
  and receipt of that plan as $1,100 while retaining $300 assigned and $800 remaining.
- Final Home screenshot: screenshots/home-watercolor.jpg.
- Physical iPhone font rendering, keyboard/safe-area behavior, reduced-motion device
  behavior, and live Supabase syncing remain manual checks. No cloud credentials or
  user financial records were used in browser QA.
- No commit, push, or deployment performed.

## 2026-11-05 — Add-menu walkthrough refinement

Human requested using Next to walk through the menu's options. Added consecutive
steps for Add Transaction, Add Paycheck, Move Money, and Add to Goal. Each step
keeps the floating menu open and highlights only its corresponding option. Previous
reverses the sequence; Next after Add to Goal closes the menu and continues to Accounts.
Walkthrough controls render inside the modal layer so native iOS users can reach them.
During these explanatory steps, menu actions do not navigate away from the tour.

Verified in the browser at 393 × 852: complete forward sequence, Previous back to
Move Money, and continuation to Accounts. TypeScript and diff whitespace checks pass.
Screenshot: screenshots/add-menu-walkthrough.jpg. Financial behavior is unchanged.

## 2026-11-05 — Walkthrough Exit

Added a small top-right Exit control on every walkthrough card, including menu-layer
cards, with a 44-point touch target and an explicit accessible label. Exit immediately
closes the walkthrough, retains the current screen, and suppresses automatic restart
for the current session without marking an incomplete walkthrough as completed.
More → Replay app walkthrough starts it again. Only the focused screen renders
walkthrough/modal controls, preventing duplicate cards from mounted background screens.

Browser verified: regular-card exit, replay, and Add-menu exit closing both the menu
and card. TypeScript and whitespace checks pass. Screenshot: screenshots/walkthrough-exit.jpg.

## 2026-11-05 — Human-requested Home view switcher and navigation

Human explicitly requested view switching similar to the AI-only app, a top row of
quick-navigation buttons, and search above Available to Spend. Read the AI branch's
Home source for behavior reference only; retained the human condition's styling.

- Added Paycheck / Accounts / Savings summary tabs. Default is Paycheck.
- Accounts uses existing cashAccountSummary: total cash, available after pending
  goal holds, and separately labeled card debt. Savings uses existing
  savingsGoalSummary: settled savings and progress, explicitly excluding pending holds.
- Added a single horizontal Budget / Transactions / History / More navigation row.
- Moved existing record search and its results above the summary; matching transaction
  results now open the specific record rather than the unfiltered transaction list.
- Preserved the illustrated financial card and human-approved palette/fonts.
- Updated walkthrough descriptions; paycheck-related tour steps show Paycheck view.
- TypeScript and whitespace checks pass. Browser verified all three views, searching
  for Checking and opening its account, Budget navigation, and phone layout at 393 × 852.
- No financial calculations, storage, or backend behavior changed.
- Screenshot: screenshots/home-view-switcher.jpg.

## 2026-11-05 — Subscription reminder emphasis

Human requested a more distinct upcoming-subscriptions note on Budget. Grouped the
heading, note, subscription rows, and existing planning actions in a white bordered
card with a Coastal Blue top accent, calendar icon, larger accessible heading, and
upcoming-count badge. The note has a Sea Glass background for clear separation.
Scheduling and planning behavior is unchanged. TypeScript and whitespace checks
pass; visually checked at 393 × 852. Screenshot: screenshots/budget-subscriptions.jpg.

## 2026-11-05 — Budget quick action and concise tour

Human requested Budget in the + popup and its walkthrough. Added Budget after Add
Paycheck, linking to the existing Budget screen. The new highlighted step reads:
“Create categories, assign paycheck money, and plan upcoming bills.” Shortened the
other Add-menu explanations while retaining their distinctions. Next/Previous and
Exit work throughout the five-option menu. Browser verified Budget navigation and
the highlighted step at 393 × 852; TypeScript and whitespace checks pass.
Screenshot: screenshots/budget-menu-walkthrough.jpg. No financial behavior changed.

## 2026-11-05 — Compact Home controls and View Focus placement

Human requested removing More from the quick-navigation row, reducing button size,
placing the row below Search, and moving a smaller summary switcher below This
Paycheck with the label “View Focus.” Implemented this exact order. The three
navigation buttons are Budget / Transactions / History; the header's settings
access remains. Compact controls include extra vertical hit area without enlarging
their visible shape. View Focus stays below the selected summary in Accounts and
Savings modes as well. Updated corresponding walkthrough text.

TypeScript and whitespace checks pass. Browser verified 393 × 852 layout and
switching to Accounts from the relocated control. Screenshot: screenshots/home-view-focus.jpg.

## 2026-11-05 — Corrected payday format and Home ordering

Human clarified that the intended payday format was not the AI_Designed_App_2
Disclosure card. Inspected AI_Designed_App's original Home and reproduced its
structure with the human condition's colors/fonts: Next Paycheck label, prominent
countdown, long date, repeat text, right-hand Set date/Change/Cancel action, inline
date editor, Monthly/Weekly/Biweekly/Other choices, optional custom interval, Save
payday, and View paycheck. The schedule is in the Paycheck focus area only.

Per the same instruction, View Focus is now directly below Search; Budget,
Transactions, and History are centered as the final row of scrollable Home content.
TypeScript and whitespace checks pass. Browser verified editor expand/cancel,
phone-width ordering, and centered links at the actual bottom of Home. Screenshots:
screenshots/home-payday-focus.jpg and screenshots/home-bottom-links.jpg.

## 2026-11-05 — Centered planning action and welcome animation

Human requested removing Home's “Your money has a plan” card, retaining only a
centered Plan a paycheck action immediately above the centered bottom links.
Removed that card/message and placed the existing action in a content-sized centered
wrapper. Reused the exact landing Crab animation on the welcome screen immediately
after the shoreline intro; the same component retains reduced-motion support.
No extra Home illustration or new animation style was introduced.

TypeScript and whitespace checks pass. Browser checked the bottom layout at 393 × 852.
Screenshot: screenshots/home-centered-plan.jpg.

## 2026-11-05 — Settings cleanup

Human requested removing Typography Preview from Settings and cleaning up the page.
Removed its entry and reorganized existing destinations into Account, Money tools,
and App tools with consistent icon rows, brief descriptions, and grouped white
cards. Sample-data controls expand only when selected; existing confirmation and
dependency guards remain. Profile, local account-setup guidance, budget categories,
transactions, history, walkthrough replay, and authenticated sign-out remain available.
No new settings or financial behavior were added. The developer-only font comparison
route is retained without a Settings entry.

TypeScript and whitespace checks pass. Browser verified the phone-sized layout,
absence of the preview link, and expanding Sample data without changing records.
Screenshot: screenshots/settings-clean.jpg.

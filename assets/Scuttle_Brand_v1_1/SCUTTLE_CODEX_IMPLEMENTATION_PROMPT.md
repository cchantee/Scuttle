# Codex Implementation Brief — Scuttle Brand v1.1

## Mission
Implement a complete, functional, independently designed Scuttle mobile experience in the existing React Native/Expo repository. Use the bundled HTML wireframes as **visual references**, not as code to paste into React Native. Preserve the real application's behavior, data, and financial rules.

**Repository:** https://github.com/cchantee/Scuttle  
**Working branch:** `AI_Designed_App`  
**Protected branch:** `main` — never edit, commit to, or push to `main`.

You have creative authority to resolve design details without requesting aesthetic preferences. Make changes on `AI_Designed_App` only. If it doesn't exist, create it from `main` after checking the current Git state. Do not force-push or overwrite existing work. Ask before destructive changes or irreversible migrations.

## Attached visual and functional references
1. `scuttle_brand_exploration.html` — **primary** visual source: branded Scuttle identity and ten screen concepts. Inspect its HTML/CSS and render it in a browser if available. It is a visual specification, not production code.
2. `scuttle_wireframes.html` — earlier six-screen wireframe set, useful for background. Where these disagree, prioritize the branded v1.1 direction in this prompt.
3. `Scuttle Core DEMO.mov` — optional reference walkthrough of the existing functional app. Use it to understand existing flows, not to copy the old visual identity.
4. The actual repository — **source of truth for functionality**, routes, domain logic, persistence, and technical constraints.

Do not use outside ChatGPT conversations as design input. Do not assume a proposed wireframe feature is implemented until verified in code. Do not claim device testing without actually performing it.

## Brand: Scuttle v1.1
**Positioning:** A friendly, dependable paycheck-first budgeting companion.  
**Brand promise:** Make each paycheck feel more manageable.  
**Tagline:** “Money moves. You’ve got this.”  
**Personality:** Plainspoken, optimistic, capable, gently playful, never judgmental, never childish or corporate.  
**Wordmark:** Lowercase `scuttle.` with strong, friendly letterforms.  
**Mascot:** The original geometric, forward-moving small creature depicted in `scuttle_brand_exploration.html`. Refine its silhouette so it is recognizable at small sizes. Make reusable variants for onboarding, empty states, and meaningful milestones. Do not overuse the mascot or put it behind financial numbers. Treat the HTML SVG as an original design starting point; recreate appropriately for React Native (e.g., SVG if an existing dependency supports it), without introducing unnecessary dependencies.

### Color system
- Deep Evergreen `#123B35` — primary headings, dark brand surfaces, navigation emphasis.
- Scuttle Teal `#137B68` — primary actions and positive progress.
- Spark Lime `#D9ED9A` — brand accents, moments of encouragement, selected highlights.
- Warm Paper `#FAF8EF` — principal app background.
- Soft Coral `#D77D65` — expense/debt/caution accents, **not** the sole error indicator.

Create complete semantic tokens for text, muted text, borders, surfaces, interactive states, and status colors. Check contrast and support system font scaling. Do not rely on color alone to distinguish debt, spending, availability, errors, or success.

### Typography and component language
Use a polished, accessible system-sans hierarchy: bold, clear monetary figures; compact secondary labels; strong section headings; readable body copy. Favor generous spacing, softly rounded cards, coherent iconography, prominent but not oversized primary actions, accessible tap targets, clear form labels, and legible numeric alignment. Avoid clutter, ornamental gradients, and overly playful treatments of serious financial data.

## Navigation and information architecture
Use a clear five-destination bottom navigation pattern where compatible with existing Expo Router structure:
- **Home** — paycheck-first overview.
- **Budget** — paycheck allocations and categories.
- **Add** — central action opens a compact action sheet for Expense, Income, Transfer, and Paycheck; include other quick actions only when supported.
- **Activity** — searchable and filterable transaction history.
- **More** — Accounts, Savings Goals, Settings, and other existing features.

Preserve reachability of every existing route and feature, including edit/delete, archives/restoration, account detail, and authentication. Reorganize routes if useful, but do not strand or remove functionality. Support navigation back behavior, loading, error, empty, and confirmation states.

## Screen implementation targets
Implement a consistent branded experience across all *verified* functional screens, using the ten branded concepts as references:

1. **Welcome / onboarding / auth:** Clear explanation of paycheck budgeting, mascot used selectively, local-first option and cloud sign-in only where supported.
2. **Home:** Answer “What came in?”, “Where did I assign it?”, and “What can I still spend?” Emphasize **unassigned paycheck funds**, **remaining category budget**, and **actual account balances** as distinct quantities. Show payday scheduling, relevant quick views, and useful actions.
3. **Paycheck details and entry:** Variable amounts, optional account association, category allocations, editing, and deletion. Explain that allocations are not account transfers.
4. **Budget:** Category allocation, spending, remaining amounts, adjustments, new categories, and archived/restored paycheck budgets. Show over-budget states accurately and clearly.
5. **Transactions:** Expense, income, and transfer entry/editing with supported accounts, categories, dates, and validation. A transfer is not an expense. Provide successful-save feedback and safe deletion.
6. **Accounts:** Cash-like account balances and credit-card debt distinctly labeled; account creation/editing, account detail, transfers, and credit-card payment behavior as implemented.
7. **Savings Goals:** Targets, progress, contribution history, create/edit, and contributions. Do not imply contributions automatically move cash.
8. **Activity / History:** Search, available filters (dates, category, paycheck, account, etc.), detail/edit/delete, readable positive/negative amounts, and grouped dates where practical.
9. **Categories / recurring items:** Manage categories. Show subscriptions or interest-related features only to the extent that actual code supports user workflows; otherwise note the gap rather than inventing a working feature.
10. **Settings / profile / storage:** Explain local storage and optional Supabase sync accurately, with sample-data and other existing controls where supported.

### Important interaction states
Explicitly design and implement:
- First-use / no paychecks / no transactions / no goals / no accounts.
- Loading, saving, saved, failed save, validation, offline, and retry states.
- Over-allocated paycheck and overspent category states with factual, non-shaming language.
- Confirmation before destructive actions, dependency-safe error handling, and recoverable mistakes where supported.
- Small-screen layouts, keyboard-safe forms, accessibility labels, large text, and sufficient contrast.

## Non-negotiable financial invariants
Preserve the existing domain model, financial calculations, validations, storage and synchronization. In particular:
1. Monetary amounts remain integer cents.
2. Paycheck allocations and account balances are different ledgers/concepts.
3. Linking a paycheck to an account must not duplicate deposits.
4. Cash-like balances represent owned funds; credit-card balances represent debt owed.
5. Transactions update appropriate account balances consistently.
6. Transfers are not expenses.
7. Credit-card payments affect the paying account and card debt correctly.
8. Savings-goal contributions are maintained in a separate ledger and do not automatically change account balances.
9. Editing/deleting financial records must preserve ledger consistency.
10. Deletions must not orphan dependent records.
11. Existing authentication, AsyncStorage, Supabase, validation, sample data, and synchronization behavior must remain functional.

Avoid modifying `src/domain`, `src/state`, `src/storage`, `src/backend`, or database migrations unless an actual verified interface integration gap requires it. If changing them, explain why and add regression tests.

## Implementation sequence
**Phase 1 — Audit:** Read README, package.json, routes/screens, shared components, domain models, state, storage, backend, and tests. Map implemented workflows against the brief. Report confirmed functionality, gaps, and risky dependencies. Identify any design concepts that require adaptation.

**Phase 2 — Foundation:** Establish semantic design tokens, typography, shared branded components, mascot assets, buttons, cards, form controls, progress indicators, empty/error states, and navigation primitives. Avoid an unmaintainable screen-by-screen CSS-like rewrite.

**Phase 3 — Screens:** Implement the branded interface incrementally across the real routes and real data flows. Favor composable components, keep TypeScript types sound, and preserve behavior. No static fake financial data in production screens.

**Phase 4 — Quality:** Run:
- `npm run typecheck`
- `npm test`
- `npm run qa:backend`
- Expo startup verification using the repository's documented command

If backend QA requires unavailable secrets, report it as blocked, not passed. Verify core workflows as far as the environment permits: add variable paycheck and allocate it; create savings goal and contribution; create category; record/categorize expense; adjust allocation; filter history. Add or update tests for affected logic and UI where appropriate. Do not claim physical-device verification unless performed.

**Phase 5 — Documentation:** Maintain `docs/ai-only-design-decisions.md` with decisions, reasons, alternatives, UX effects, and whether constrained by functionality. Include a brief mapping from the ten HTML concepts to implemented routes and document any differences. Update README only as necessary.

**Phase 6 — Delivery:** Commit changes to `AI_Designed_App` only. Provide a concise summary of modified files, implemented screens, deviations from wireframes, verified tests, blocked checks, and known limitations. Do not merge to `main`.

## Final design refinements (v1.1 overrides the original HTML where relevant)
- Refine mascot silhouette and create restrained expressive states; don't plaster it everywhere.
- Prioritize actionable, correctly labeled dashboard quantities over decorative dashboard cards.
- Use the five-destination navigation with an Add action sheet, while preserving all existing workflows.
- Build a full interaction system, not just populated happy-path screens.
- Apply semantic colors and accessible financial status communication.
- Build design tokens/shared components before the screen overhaul.

## Autonomy
Make aesthetic and UX decisions yourself. Do not ask me to choose colors, layouts, fonts, icon styles, or a mascot direction. Ask only for missing objective technical configuration or permission before destructive operations. Prioritize functionality, data integrity, and a polished native mobile experience.

# Running and saving Scuttle

Use `/Users/cmwiltz/Desktop/FA26/Senior Project/Scuttle` as the terminal entry point. Run `npm run test:interface`, choose 1 (human), 2 (AI), or 3 (collaborative), then scan the Expo QR code. Ctrl+C returns to the selector. `npm run test:interface -- --check` reports the actual branch folders.

Each interface is a separate Git worktree. Edit and commit design files in its own folder. Shared domain, backend, storage, reset tooling, and tests also live in main; navigation, art, fonts, layouts, and animations remain independent. Generic Sample data in main is preserved separately from Jordan.

Jordan reset: `npm run study:jordan -- reset` from the Desktop folder. Real credentials remain in ignored `study.secrets.local`; never stage this file or `.env`. No credentials belong in example files.

The older detached study tooling is preserved on `codex/recover-jordan-study-ai`; do not use it to reset the current study account. The local `backup/AI_Designed_App-before-secret-cleanup` contains an exposed key and must never be pushed. Push explicit branch names, never `--all`.

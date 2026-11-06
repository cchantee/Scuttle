# Scuttle research interface launcher

From the existing VS Code terminal, run:

```sh
npm run test:interface
```

Choose **1** Human-Only (`Chantes_Designed_App`), **2** AI-Only (`AI_Designed_App`), **3** Human + AI (`AI_And_Me_Designed_App`), or **0** Exit. The launcher checks these actual local branch names with Git. It finds the worktree attached to that branch or creates a separate worktree for it; it never switches the calling checkout, merges branches, resets files, or changes designs.

On this machine, the existing worktrees are:

- Human: `/Users/cmwiltz/.codex/worktrees/jordan-human-fixture/Scuttle`
- AI: `/Users/cmwiltz/Desktop/FA26/Senior Project/Scuttle`
- Human + AI: `/Users/cmwiltz/.codex/worktrees/jordan-collaborative-fixture/Scuttle`

New machines automatically create missing checkouts in `Scuttle-interfaces` beside the primary repository. Check out/fetch the three named local branches before using the selector. Existing working edits stay in their own worktrees.

## First launch and configuration

Use Node 24, npm and Git. Each interface gets its **own** `node_modules` installed by `npm ci` against its existing lockfile. Shared dependency symlinks are replaced without touching their target. A lock/package fingerprint avoids reinstalling on every launch. No dependency versions or lockfiles are changed by the launcher.

Ensure the primary repo's `.env` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. A selected worktree's own `.env` files take precedence. When it has no public Supabase config, the launcher supplies the primary repo's public configuration to the Expo process without writing another `.env`. An incomplete configuration stops launch rather than silently testing local-only data. Researcher secrets are not copied and known Supabase admin environment variables are removed from the Expo child environment. `study.secrets.local` remains private to the separate reset command.

Inspect setup without launching or writing files:

```sh
npm run test:interface -- --check
```

Install all worktrees' locked dependencies before participants arrive:

```sh
npm run test:interface -- --prepare
```

## iPhone testing

The launcher uses `expo start --go --lan --clear`. Scan the **new QR code for the selected interface** with the iPhone Camera/Expo Go, using the same reachable Wi-Fi as the Mac. Human uses port 8081, AI 8082, and Human + AI 8083. If a preferred port is busy, a spare port starting at 8084 is selected automatically; unrelated processes are never killed. Scan the displayed QR code rather than reusing an old URL. Clearing Metro's cache and using distinct ports prevents accidentally loading a previous interface.

All three projects currently target Expo SDK 58 and use Expo Go-supported libraries. Your installed Expo Go build must match the project's SDK. Physical iOS requirements and distribution availability can change; see [Expo's iPhone setup instructions](https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&platform=ios) and [matching Expo Go versions](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/). Sign in to the same Expo account in CLI and Expo Go when required. An iOS JavaScript export passing does not verify a physical iPhone runtime.

If LAN routing is blocked, try:

```sh
npm run test:interface -- --tunnel
```

Tunnel mode needs Expo's tunnel dependency and network access. The launcher does not automatically upgrade SDKs or dependencies to accommodate a mismatched Expo Go app.

Press **Ctrl+C** while Expo is running to stop that server and return to the selector. Choose another interface. At the menu, choose **0** (or Ctrl+C) to exit. Direct launches are also available, for example `npm run test:interface -- --interface 2`; after that server stops, the command exits.

## Comparative study controls

All interfaces share the same Supabase project/Jordan account when configured that way. Switching the interface **does not reset data**. Before each interface and participant, stop the current server, reset Jordan, verify the baseline, and then choose the next interface:

```sh
npm run study:jordan -- reset
npm run study:jordan -- verify-live
npm run test:interface
```

The reset requires researcher credentials and confirmation and is never run automatically by the launcher. Reload the app after resetting so stale in-memory edits are not carried across sessions. Account defaulting and overdraft protections are shared financial changes; the launcher itself never reads or writes participant financial records.

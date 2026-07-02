# KRONOX Core Prompt

Status: canonical operational context for Kronox tasks.

Use this file before product, code, docs, Health, or deployment work. The legacy
`CORE_PROMPT.md` file is only a compatibility pointer. Product identity and
visual language live in `Kronox.md`; detailed workflow and technical contracts
live under `docs/`.

## Work Rules

* Work on the `Codex` branch unless explicitly told otherwise.
* Keep changes scoped to the requested task.
* Do not commit directly to `main`.
* Do not force push.
* Do not fake Health PASS or convert manual/runtime proof gates into automated
  proof.
* Commit completed work and push it to `origin/Codex` unless the user
  explicitly says not to.
* For docs-only work, do not bump the build marker unless the task explicitly
  requires it.

Before reporting complete, verify the worktree and branch:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/Codex
git rev-list --left-right --count origin/Codex...HEAD
```

## Product Contracts

Kronox is a mobile-first timeline trivia game built with Vite, React, Tailwind,
and Base44 Functions / Entities. Android and iOS wrappers are generated through
Base44; this repository is not the native iOS project and does not contain an
Xcode workspace or App Store `Info.plist` source of truth.

Preserve these current contracts unless a task explicitly changes them:

* Guest identity is app-owned through `GuestProfile`.
* Firebase anonymous auth and Base44 anonymous auth are not the guest model.
* Username is the only public identity.
* `display_name` is legacy/internal projection data, not public identity.
* Unsafe or missing public identity falls back to `KronoxUser####` /
  `KronoxUser#####`.
* Home / Ana Sayfa has no Google, Apple, or Email login buttons.
* Account linking belongs under Profile.
* BottomNav contains only Ana Sayfa, Liderlik, and Profil.
* Online is separate from Solo and does not use Solo category preferences.
* Category source of truth is the current DB/current canonical taxonomy.
* `getCategoryMetadata` is public-by-design and metadata-only.
* Gameplay must not expose raw `Question.list` fallback or the full question
  bank to the client.
* Unified Kronox Puan is the only visible score system.
* Daily Wheel and Daily Quest grant Diamonds only; Daily Quest does not affect
  Kronox Puan or leaderboard.
* Completed GuestProfile users are valid players for Daily Wheel, Daily Quest,
  and Liderlik. Guest rewards persist on GuestProfile.diamonds and account
  linking preserves guest Diamonds, daily reward guards/history, Solo progress,
  leaderboard username identity, category preferences, and inventory where
  applicable.
* Economy idempotency uses function-level guards. DB/platform unique constraint
  proof remains manual unless explicitly proven.

## Solo Rules

Current normal Solo is move-based:

* 2 initial anchor cards.
* Up to 10 playable/evaluated placement moves.
* Target total timeline cards: 7.
* Correct placements needed after anchors: 5.
* Failure if 10 evaluated moves are used before the 7-card target is reached.
* Visible UI uses `HAMLE` / remaining moves, not public `HATA` scoring.
* Star thresholds:
  * 5-6 used moves = 3 stars.
  * 7-8 used moves = 2 stars.
  * 9-10 used moves = 1 star.
* Normal Solo jokers are inventory-backed.
* Guided tutorial/demo joker use must not spend real inventory.

Special Solo levels start at level 5 and repeat every 5 levels. They keep the
10-card timeline target, use 13 evaluated moves as a mistake buffer, and do not
change the Solo scoring, Kronox Puan, Diamond, leaderboard, Online, Daily Wheel,
or Daily Quest contracts.

Internal engine docs may describe prebuilt deck buffers for anchors, playable
moves, and joker reserves. Player-facing docs should describe the 2-anchor /
normal 10-playable-move / special 13-playable-move model.

## Release Honesty

Health PASS is not release readiness. Manual gates remain manual until a real
harness or recorded proof exists. This includes:

* physical Apple parity as a Manual Required / P0 iOS release gate.
* TestFlight/App Store proof.
* iOS/App Store encryption/export compliance through the Base44/App Store
  Connect manual process.
* two-account multiplayer and RLS/BOLA probes.
* push/VAPID deployment proof.
* destructive account deletion proof.
* Android wrapper, safe-area, notch, gesture, and real-device drag/drop proof.
* parallel economy/idempotency proof where platform uniqueness is not proven.

## Validation

Use the smallest validation set that matches the change. Default checks before
completion:

```bash
git diff --check
npm run lint
npm run build
```

Run full Health only when the user explicitly asks. For targeted Health tasks,
run only the affected cases when possible and report that full Health was not
run.

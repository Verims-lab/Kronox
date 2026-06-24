# Kronox

Kronox is a mobile-first timeline trivia game. Players place event cards in
chronological order, earn Kronox Puan, collect Diamonds, use Solo jokers, and
can play as a guest before linking an account from Profile.

## What This App Is

This repository contains the Kronox web app and Base44 backend source used by
Base44 Builder. Product behavior is centered on Solo timeline play, Online
Kapışma, guest onboarding, Profile account linking, Liderlik, Mağaza, Daily
Wheel, and Daily Quest.

## Stack

* Vite + React
* Tailwind-style UI
* Base44 Functions / Entities
* GitHub sync into Base44 Builder
* Android/iOS wrappers generated through Base44

The native iOS/App Store wrapper is not maintained as an Xcode project in this
repo.

## Local Development

```bash
npm install
touch .env.local
npm run dev
```

Create `.env.local` with project-specific values:

```text
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_base44_app_url
```

Do not commit secrets, private keys, service tokens, or personal/admin email
literals.

## Base44 / GitHub Workflow

Changes pushed to GitHub are reflected in Base44 Builder. Publish production
changes from Base44 after reviewing the diff and required manual gates.

Use `Codex` for Codex work unless a task explicitly says otherwise. Do not force
push.

## Build And Validation

Useful checks:

```bash
npm run check:base44-functions
npm run lint
npm run build
npm run check:ios-icons
```

`npm run build` proves the Vite frontend bundle only. It does not prove Base44
function deployment, RLS/BOLA behavior, native wrapper quality, push delivery,
or App Store/TestFlight readiness.

## Important Docs

* `KRONOX_CORE_PROMPT.md` - canonical operational/project rules.
* `Kronox.md` - product identity, visual language, game feel, and UX principles.
* `docs/KRONOX_PRODUCT_WORKFLOW.md` - current product flow.
* `docs/KRONOX_TECHNICAL_FLOW.md` - current implementation flow.
* `docs/KRONOX_SOLO_QUESTION_ENGINE.md` - Solo question/deck contract.
* `docs/KRONOX_RELEASE_PROOF_CHECKLIST.md` - manual release proof.
* `docs/KRONOX_SECURITY_DEPLOYMENT.md` - security/deployment rules.
* `src/lib/healthAlignmentDocMirrors.js` - runtime doc mirror used by Health.

## Manual Release Gates

Health PASS is not release readiness. Manual proof is still required for
physical Apple parity, TestFlight/App Store flows, encryption/export compliance
through Base44/App Store Connect, Android wrapper checks, push/VAPID, real
device drag/drop, two-account multiplayer/RLS probes, account deletion, and
parallel economy/idempotency behavior.

Publishing is handled through Base44.

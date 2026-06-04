# KRONOX Core Prompt

Status: Active engineering context.

This file is the canonical root-level context path for Kronox tasks. The legacy
`CORE_PROMPT.md` file is kept as a compatibility mirror while older prompts and
Health references are phased out.

## Product Safety Rails

Preserve these systems unless a task explicitly asks to change them:

* Offline Solo stability.
* Online Lobby authority through the `Lobby` entity, realtime subscriptions, and
  `useLobbySync`.
* Drag/drop architecture, Timeline hit-testing, and placement validation.
* Unified Kronox Puan as the only visible score system.
* Diamond economy amounts and idempotency rules.
* GameInvite 10-minute TTL.

## Engineering Rules

* Work on the `Codex` branch unless the user explicitly requests another branch.
* Keep changes scoped to the task.
* Do not fake Health PASS.
* Do not convert runtime/manual risks to PASS without real proof.
* Do not run Health suites unless the user explicitly asks.
* Before reporting complete, run:
  * `git diff --check`
  * `npm run lint`
  * `npm run build`
* Commit and push to `origin/Codex`.
* Verify:
  * `git status --short`
  * `git rev-parse HEAD`
  * `git rev-parse origin/Codex`
  * `git rev-list --left-right --count origin/Codex...HEAD`

## Release Honesty

Health PASS is not the same as release readiness. Two-account multiplayer,
RLS/security probes, push/VAPID, destructive account deletion, Android wrapper
warnings, safe-area/notch behavior, and real-device drag/drop must remain manual
or NOT_AUTOMATABLE unless a real harness proves them.

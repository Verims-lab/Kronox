// In-src mirror of docs/KRONOX_DB_REPORTING_READINESS.md's
// "SoloLevelAttemptEvent Phase 1 Contract" section.
//
// Why this file exists:
//   Importing markdown directly from the repo `docs/` folder with `.md?raw`
//   fails Vite/Base44 import analysis at build time with
//   "Failed to parse source for import analysis ... .md?raw".
//   The Solo Progress Health suite only needs the contract TEXT to run its
//   static token checks, so we mirror the relevant section here as a plain
//   JS string. Keep this in sync with the markdown doc when the contract
//   changes — both must carry the same tokens.

export const DB_REPORTING_READINESS_SOURCE = `## SoloLevelAttemptEvent Phase 1 Contract

\`SoloLevelAttemptEvent\` is the planned append-only reporting event for Solo
level funnel, pass/fail rate, HAMLE distribution, elapsed time, joker usage,
and record-readiness analysis. Phase 1 defines the contract and Health guard;
runtime writes stay deferred until a backend-owned function path is added and
manually proven. The client reducer must not write this event directly.

Minimum fields:

- \`actor_key_hash\`: internal anonymized actor key generated server-side.
- player_type: \`guest\` / \`linked\` / \`unknown\`.
- \`level_id\` or \`level_number\`.
- \`rules_version\`.
- \`passed\`.
- \`used_moves\`.
- \`elapsed_seconds\`.
- \`stars\`.
- \`correct_placements\`.
- \`evaluated_moves\`.
- \`joker_used_summary\`.
- category context only if safe and already present in the backend completion
  path.
- \`created_at\` and day.
- source: \`solo_completion\` / \`solo_attempt\`.

Privacy rules:

- no email.
- no provider ID.
- no owner_key.
- no raw guest_id.
- no internal player_key in public UI/export.
- no full question bank.
- no answer years / correct answers in public reports.

Implementation plan before enabling writes:

- Add a backward-compatible \`SoloLevelAttemptEvent\` entity schema only after a
  backend writer is ready; do not expose it in public UI.
- Add a backend-owned function such as \`recordSoloLevelAttemptEvent\` or fold the
  write into an existing Solo completion backend path after authorization and
  guest-token proof.
- Use an idempotency key derived from anonymized actor, level, rules version,
  attempt/session nonce, completion status, and completion day. Hash the key if
  it is surfaced outside the function.
- Treat writes as best-effort and non-blocking; Solo completion, progress
  persistence, Diamonds, leaderboard, and record congratulations must not fail
  because reporting failed.
- Retry/failure behavior should be server-owned: duplicate attempts return
  success/no-op, transient failures are logged for admin diagnosis, and the UI
  receives no private reporting details.
- Add Health coverage before enabling runtime writes for privacy fields,
  idempotency, guest compatibility, no public question-bank exposure, and
  preservation of backend record-context congratulations.
`;
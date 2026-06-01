# Kronox Data Model Hardening Implementation Plan

Status: Codex139 implementation package.

This document records the safe, non-destructive data-model hardening work
implemented after `docs/KRONOX_DATA_MODEL_AUDIT.md`.

## Final Entity Map

- `User`: signed-in source for `solo_progress`, `online_progress`,
  `hasCompletedTutorial`, and `game_invite_notifications_enabled`.
- `SoloLeaderboardEntry`: public-safe Solo leaderboard mirror/projection row.
- `OnlineMatchResult`: per-user/lobby Online score audit and idempotency row.
- `FriendRequest`: normalized friendship source for accepted relationships.
- `Friendship`: legacy mirrored-row model retained for compatibility/cleanup.
- `GameInvite`: 10-minute Online invite lifecycle source.
- `Lobby`: multiplayer lobby/game state source.
- `PushSubscription`: owner-scoped Web Push subscription storage.
- `GameRecord`: offline/single-player record history.

Daily Quest remains paused. When resumed, it should use a dedicated
`DailyQuestProgress` entity, not `User` JSON.

## Source-of-Truth Map

- Tutorial completion: `User.hasCompletedTutorial`.
- Notification preference: `User.game_invite_notifications_enabled`.
- Solo progress/score: `User.solo_progress`.
- Solo local mirror: scoped cache only.
  - Guest key: `kx_solo_progress_v1:guest`.
  - Signed-in key: `kx_solo_progress_v1:<ownerKey>`.
  - Old unscoped key is guest-only unless it has a same-owner marker.
- Solo leaderboard display: projection from normalized `User.solo_progress`
  plus best-effort `SoloLeaderboardEntry` mirror.
- Online score summary: `User.online_progress`.
- Online score idempotency/audit: `OnlineMatchResult`.
- Friend relationship: accepted `FriendRequest`.
- Game invite visibility/actionability: `GameInvite`.
- Header notifications: derived from actionable `FriendRequest` and
  `GameInvite`, not toast state.

## LocalStorage Scoping Rule

Signed-in users must never consume anonymous/unscoped Solo progress from a
shared browser. The local Solo mirror is a resilience cache only:

- Same-owner scoped mirrors may be compared against server progress.
- Unverified old mirrors cannot overwrite signed-in server progress.
- Guest progress is isolated under the guest key.

## Leaderboard Authority Decision

Current authority stays conservative:

- Primary durable source: `User.solo_progress`.
- Public-safe mirror: `SoloLeaderboardEntry`.
- Service-role projection: `getSoloLeaderboard`.

The package fixes scoring drift by aligning `getSoloLeaderboard` with the
canonical Solo scoring boundaries. A full switch to `SoloLeaderboardEntry` as
the only authority is deferred until a safe backfill/job path exists for all
users.

## OnlineMatchResult Idempotency

Future Online score applications now:

1. Resolve current user.
2. Check `OnlineMatchResult` by `player_email + lobby_id`.
3. If found, skip as `already_recorded`.
4. Otherwise keep the existing `lastMatchId` recent-match guard.
5. Apply Online score to `User.online_progress`.
6. Only after score persistence succeeds, create an `OnlineMatchResult`
   audit row.

If the `OnlineMatchResult` entity is unavailable in a partially deployed
environment, the writer falls back to the previous `lastMatchId` behavior and
does not break gameplay. This is a compatibility fallback, not the target
state.

Known Base44 limitation: uniqueness constraints/index support is not assumed
from this repo alone. Runtime uses a pre-check; a database-level uniqueness
guarantee would be stronger if Base44 supports it.

## Cleanup / Retention Policy

Retention helpers live in `src/lib/dataRetention.js`.

- Expired `GameInvite` rows are marked `expired` with `expired_at`.
- Stale waiting `Lobby` rows are marked `cancelled` with `cancelled_at`.
- Active invites/lobbies are skipped.
- Client helpers do not delete rows by default.
- Expired push subscription cleanup is report-only on the client; push send
  already marks 404/410 endpoints expired.
- FriendRequest history is not deleted client-side.

These helpers are not destructive migrations and are not scheduled globally
by this package.

## RLS / Runtime Probe Matrix

Static schema checks cannot prove RLS behavior. Required release probes:

- User C cannot read A/B `FriendRequest`.
- Sender cannot accept own outgoing `FriendRequest`.
- User C cannot mutate A/B `FriendRequest`.
- User C cannot read A/B `GameInvite`.
- Sender cannot mark `GameInvite` accepted incorrectly.
- Recipient-only `acceptGameInvite` works.
- Expired `GameInvite` cannot be accepted.
- User C cannot read private `Lobby`.
- Non-player cannot mutate Lobby game state.
- User cannot update another user's `PushSubscription`.
- User cannot update another user's `SoloLeaderboardEntry`.

Health Center keeps these as `NOT_AUTOMATABLE` or `WARNING` rather than fake
green PASS.

## Remaining Risks

- `OnlineMatchResult` pre-check is not a database-level unique constraint.
- Full global backfill for `SoloLeaderboardEntry` remains deferred.
- RLS tightening for broad direct update permissions should be handled in a
  backend-focused phase with two/three-account tests.
- Cleanup helpers are opt-in utilities; no scheduled retention job exists yet.

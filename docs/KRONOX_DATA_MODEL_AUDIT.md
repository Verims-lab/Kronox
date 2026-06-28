# Kronox Data Model Architecture Audit

Date: 2026-06-01
Branch inspected: Codex
Scope: Base44 entities, Base44 functions, data access helpers, source-of-truth contracts, persistence risks, RLS/security posture, Health Center recommendations.
Implementation follow-up: Codex139 DB/Data Model hardening package.
Economy follow-up: Codex152 introduced canonical `User.diamonds`,
`DiamondTransaction`, +100 starter bonus, and +20 UTC daily login reward.
Package 2 follow-up: Codex168 added authenticated/minimal question access,
active-category Solo deck wiring, strict Online start category filtering,
`User.kronox_puan_total` as the persisted unified leaderboard projection,
and guard/ledger recovery for Diamond reward idempotency. Older risk notes
below are kept as historical audit context where explicitly marked as future
or already mitigated.

This is an audit-first document. It does not apply destructive schema changes, delete data, run migrations, change product behavior, change scoring logic, or touch gameplay mechanics.

## 1. Executive Summary

The current Kronox data model is functional for the current feature set, but it is at the edge of what can safely scale without more explicit domain entities. The app has working persistence for Solo progress, Online score, friend requests, game invites, lobbies, push subscriptions, and a public-safe Solo leaderboard, but several important concepts are compressed into `User` JSON or the large `Lobby` row.

The model is sufficient for continued controlled beta work if runtime verification stays strict. It is not yet strong enough for high-volume production, robust auditability, or future economy/daily-quest/social ranking features without targeted schema improvements.

Top risks:

| ID | Area | Risk | Severity |
| --- | --- | --- | --- |
| DM-01 | Solo progress | Authenticated users can prefer an unscoped localStorage mirror over server `User.solo_progress`, which can cause cross-user/device drift on shared devices. | P1 |
| DM-02 | Solo leaderboard | `getSoloLeaderboard` duplicates Solo score math instead of importing the shared helper. The service copy can drift from UI/Profile/Solo helper behavior. | P1 |
| DM-03 | Online scoring | `online_progress.lastMatchId` protects only the most recent match, not a set of processed matches. A later replay/reopen of an older lobby can double-apply score. | P1 |
| DM-04 | Schema drift | `User.jsonc` omits live fields such as `hasCompletedTutorial`, `game_invite_notifications_enabled`, Solo score summary fields, and `online_progress.lastMatchAt`. | P1 |
| DM-05 | RLS/service-role | FriendRequest and GameInvite entity RLS allow broad sender/recipient updates; business invariants rely on client discipline plus functions. | P1 |
| DM-06 | Lobby state | Lobby stores roster, turn state, cards, status, selected categories, and result state in one mutable row with no immutable match result table. | P2 |
| DM-07 | Leaderboard scale | Global leaderboard reads `SoloLeaderboardEntry` projection first and returns compact top/current/friend rows. A bounded server-side `User.kronox_puan_total` repair window prevents stale/incomplete projection rows from hiding higher-score users, but exact rank outside the repaired window and platform index proof still need a scale pass. | P2 |
| DM-08 | Expired/stale row retention | GameInvite, Lobby, PushSubscription, and FriendRequest rows can accumulate without an explicit retention/cleanup plan. | P2 |

Release blocker: no immediate P0 destructive schema blocker was found from static inspection. The main near-term blockers are data-consistency and security-proof issues that need targeted implementation and two-account/runtime probes before broad release.

## 2. Current Entity Inventory

### User / profile

Schema: `base44/entities/User.jsonc`
Access path: `base44.auth.me()` and `base44.auth.updateMe(...)`

Purpose:
- Stores app role.
- Stores `solo_progress`.
- Stores `online_progress`.
- Live code also reads/writes profile fields now documented in schema:
  `hasCompletedTutorial`, `game_invite_notifications_enabled`, Diamond
  economy fields, Solo progress, and Online progress.

Important fields:
- `role`
- `solo_progress`
- `online_progress`
- `hasCompletedTutorial`
- `game_invite_notifications_enabled`
- `diamonds`
- `starter_bonus_granted_at`
- `last_daily_diamond_reward_date`
- `economy_updated_at`

Owner/access pattern:
- User-owned auth profile. Client writes current user's profile through `updateMe`.
- `getSoloLeaderboard` reads all users via service role and projects only safe fields.

Feature dependencies:
- Tutorial.
- Solo progress and score.
- Profile stats.
- Leaderboard projection.
- Online score/checkpoints.
- Notification preference.
- Elmas / Diamond balance.

Audit notes:
- This profile is currently overloaded with gameplay progress, notification preference, tutorial state, and Diamond economy guard fields.
- For current scale, this is workable. For future growth, split durable game stats into dedicated `UserGameStats` / `SoloLevelProgress` / `OnlineMatchResult` shapes.

### FriendRequest

Schema: `base44/entities/FriendRequest.jsonc`
Helpers/functions: `src/lib/friendsApi.js`, `sendFriendRequest`, `acceptFriendRequest`, `removeFriend`, `sendFriendRequestEmail`

Purpose:
- Pending friend requests.
- Accepted FriendRequest rows are also the normalized friendship source of truth.

Important fields:
- `from_email`
- `from_name` / `from_username`
- `to_email`
- `to_name` / `to_username`
- `status`: `pending`, `accepted`, `rejected`, `cancelled`

Owner/access pattern:
- Sender creates.
- Sender and recipient can read/update/delete by RLS.
- `acceptFriendRequest` uses service role but validates caller is `to_email`.
- `removeFriend` flips accepted requests back to `rejected`.

Feature dependencies:
- Friends page.
- Header notifications.
- Friend selection popup.
- Game invites, indirectly through the friend list.

Audit notes:
- The accepted-request model is simpler than mirrored Friendship rows and fixes reciprocal visibility.
- Duplicate protection is function-query based, not DB-unique.
- RLS allows both sender and recipient to update the row broadly; runtime business invariants depend on functions/UI discipline.
- `sendFriendRequest` stores sender/target username snapshots so friend and outgoing-request UI can render username-safe labels without exposing target email.

### Friendship

Schema: `base44/entities/Friendship.jsonc`
Current status: legacy / cleanup only.

Purpose:
- Earlier mirrored friendship model.
- No longer the source of truth.
- `removeFriend` deletes legacy Friendship rows if present.

Important fields:
- `user_email`
- `friend_email`
- `friend_name`

Owner/access pattern:
- Owner-scoped by `user_email`.

Feature dependencies:
- Legacy cleanup only.

Audit notes:
- Keeping the schema is safe for compatibility.
- Future cleanup can remove or archive it only after verifying no production rows or functions still depend on it.

### GameInvite

Schema: `base44/entities/GameInvite.jsonc`
Helpers/functions: `src/lib/inviteApi.js`, `src/lib/gameInviteSelectors.js`, `acceptGameInvite`, `sendGameInvitePush`

Purpose:
- Persistent online game invites.
- Header notifications and Online pending invites are derived from actionable pending rows.
- Push notification trigger source.

Important fields:
- `lobby_id`
- `lobby_code`
- `from_email`
- `from_name`
- `to_email`
- `to_name`
- `status`: `pending`, `accepted`, `declined`, `rejected`, `cancelled`, `expired`, `completed`
- `created_at`
- `expires_at`
- `expired_at`
- `accepted_at`
- `declined_at`

Owner/access pattern:
- Sender creates.
- Sender and recipient can read/update.
- Sender can delete.
- `acceptGameInvite` validates recipient and uses service role to add player to Lobby.
- `sendGameInvitePush` validates caller is sender and only sends to recipient subscriptions.

Feature dependencies:
- Online challenge friend invites.
- Header notification badge/list.
- In-app invite toast.
- Push notifications.
- Lobby deep links.
- Invite TTL Health cases.

Audit notes:
- TTL is now centralized client-side in `gameInviteSelectors.GAME_INVITE_TTL_MS` and mirrored in backend functions.
- `createGameInvites` writes both `created_at` and `expires_at`.
- Schema status includes `completed` and `cancelled`, but schema does not define `completed_at` or `cancelled_at`.
- Direct entity update RLS is broad for sender/recipient. Acceptance is guarded by function, but a malicious client could attempt direct status mutation unless Base44 RLS or app policy prevents field-level misuse.
- Retention/history policy is not defined.

### Lobby

Schema: `base44/entities/Lobby.jsonc`
Helpers/functions: `LobbyRoom`, `useWaitingRoomSync`, `useLobbySync`, `startLobbyGame`, `updateLobbyGameState`, `findLobbyByCode`, `activeLobby`

Purpose:
- Waiting room.
- Online game live state.
- Turn state.
- Player cards.
- Winner state.
- Selected online categories.
- Active lobby return.

Important schema fields:
- `code`
- `host_email`
- `host_name`
- `players`
- `status`: `waiting`, `starting`, `in_game`, `finished`
- `winner`
- `category`
- `selected_category_ids`
- `year_start`
- `year_end`
- `turn_duration`
- `win_card_count`
- `current_player_index`
- `current_question_id`
- `used_question_ids`
- `max_players`
- `invited_emails`

Live fields used but not in schema:
- `state_revision`
- `winner_email`

Missing fields recommended for future:
- `created_at` / `expires_at` explicit lobby TTL fields.
- `started_at`
- `completed_at`
- `cancelled_at`
- `last_activity_at`

Owner/access pattern:
- Host creates.
- Read if host or a player.
- Host/admin can update/delete by RLS.
- Functions use service role for controlled joining/start/state writes.

Feature dependencies:
- Online challenge.
- Join by code.
- Invite accept path.
- Waiting room.
- Multiplayer live game.
- Active lobby return.
- Online scoring result context.

Audit notes:
- Lobby is the most overloaded entity in the product.
- The server-authoritative logic is mostly in functions, but the row itself carries both setup and live game state.
- `state_revision` is critical to stale-write prevention but not declared in schema.
- `winner_email` is critical to online score perspective but not declared in schema.
- Lobby stale rule uses `updated_date` / `created_date` rather than explicit `expires_at`.
- There is no immutable `OnlineMatchResult` table for score audit.

### LobbyMessage

Schema: `base44/entities/LobbyMessage.jsonc`
Current status: legacy / inactive.

Purpose:
- Chat/system messages for lobby.

Feature dependencies:
- None in current flow from static inspection.

Audit notes:
- Safe to keep for compatibility.
- Candidate for Phase 3 dead-code/entity cleanup after runtime verification.

### PushSubscription

Schema: `base44/entities/PushSubscription.jsonc`
Helpers/functions: `notificationApi`, `sendGameInvitePush`

Purpose:
- Store browser/device PushSubscription rows for game invite push notifications.

Important fields:
- `user_email`
- `endpoint`
- `keys_p256dh`
- `keys_auth`
- `permission`
- `status`: `active`, `disabled`, `expired`
- `user_agent`
- `last_seen_at`
- `disabled_at`

Owner/access pattern:
- Owner can create/read/update/delete own rows.
- Admin can read/update/delete.
- `sendGameInvitePush` uses service role to find recipient active rows.

Feature dependencies:
- Header notification bell and in-app invite surfaces.
- Optional future user-initiated push subscription surface.
- Closed/background game invite push.
- Health notification diagnostics.

Audit notes:
- Duplicate endpoint is handled in client by filter/update.
- No DB-level uniqueness on endpoint/user.
- Stale 404/410 subscriptions are marked `expired`.
- Push subscription storage is properly separated from profile and from public leaderboard data.

### Question

Schema: `base44/entities/Question.jsonc`
Helpers/functions: `getQuestions`, `getOfflineQuestions`, `startLobbyGame`

Purpose:
- Question pool for Solo and Online gameplay.

Important fields:
- `question`
- `year`
- `category`
- `type`
- `media_url`
- `icon_url`
- `difficulty`

Owner/access pattern:
- Public read.
- Admin-only create/update/delete.

Feature dependencies:
- Solo gameplay.
- Online gameplay.
- Admin question management.
- Music/media question functions.

Audit notes:
- Online categories use stable UI ids mapped to legacy Question categories in `startLobbyGame`.
- Future content taxonomy should add a dedicated mapping or migrate Question categories to the new Online taxonomy.

### SoloLeaderboardEntry

Schema: `base44/entities/SoloLeaderboardEntry.jsonc`
Helpers/functions: `src/lib/leaderboard.js`, `getSoloLeaderboard`

Purpose:
- Public-safe leaderboard mirror per user.
- Entity fallback if function projection is unavailable.

Important fields:
- `owner_key`
- `display_name`
- `initial`
- `total_solo_score`
- `current_level`
- `unlocked_level`
- `total_stars`
- `completed_level_count`
- `aggregate_best_time_seconds`
- `updated_at`

Owner/access pattern:
- Public read.
- Creator/admin update/delete.
- Current user publishes their own row.

Feature dependencies:
- Liderlik page.
- Friend row marking through hashed owner keys.
- Leaderboard Health cases.

Audit notes:
- This is a good privacy-safe shape.
- Current primary load path first calls `getSoloLeaderboard`, which service-role projects rows from `User.solo_progress`; entity rows are best-effort/fallback.
- Dual paths can drift if projection math and client helper math differ.

### GameRecord

Schema: `base44/entities/GameRecord.jsonc`
Helpers/components: `useGameActions.saveGameRecord`

Purpose:
- Older single-player game record storage. The former Settings/Profile
  "En iyi 5 rekorun" list has been removed from current UI; backend rows remain
  for legacy/admin/reset/reporting compatibility.

Important fields:
- `user_email`
- `player_name`
- `duration_seconds`
- `cards_won`
- `win_card_count`
- `category`
- `year_start`
- `year_end`

Owner/access pattern:
- User-owned.
- Only creator/admin can read/update/delete.

Feature dependencies:
- Older top-score surfaces.
- Not sufficient for current Solo level scoring/level-specific ranking.

Audit notes:
- It does not store `solo_level_number`, `stars`, `score`, `mistakes`, or per-level result details.
- It should not be used for global Solo ranking without extension or a new entity.

## 3. Source-of-Truth Map

### Solo progress

Current source of truth:
- Signed-in users: `User.solo_progress`, written by `writeSoloProgress`.
- Guest/local mirror: `localStorage["kx_solo_progress_v1"]`.
- Read helper: `readSoloProgress(user)` picks the more advanced of server and local mirror.
- Summary helper: `summarizeSoloProgress(...)`.
- Score helper: `soloProgressHelpers`.

Fields:
- `currentLevel`
- `levels[level].bestStars`
- `levels[level].bestScore`
- `levels[level].bestScoreStars`
- `levels[level].bestScoreBaseScore`
- `levels[level].bestScoreTimeBonus`
- `levels[level].bestMistakes`
- `levels[level].bestTimeSeconds`
- `levels[level].attempts`
- `levels[level].completedAt`
- `levels[level].lastAttemptAt`
- `summary.totalSoloScore`, `summary.currentLevel`, `summary.unlockedLevel`, etc.

Health:
- Good modular Solo coverage exists.

Risks:
- P1: localStorage mirror is not scoped by user email. A signed-in user can inherit a more advanced local mirror from another account on the same device/browser.
- P1: `User.jsonc` does not document the current full Solo progress shape (`bestScore`, score breakdown, summary).
- P2: Per-level history is compressed inside one profile JSON blob; fine for 20 levels, weak for analytics/ranking/audit.
- P2: `getSoloLeaderboard` duplicates Solo scoring logic instead of importing the shared helper.

Recommendation:
- Short term: scope localStorage mirror by user key/email hash or treat it only as a write-through cache for the matching user.
- Short term: update User schema docs to match actual Solo progress shape.
- Medium term: introduce `SoloLevelProgress` one row per user+level.

### Online score

Current source of truth:
- `User.online_progress`, written by `applyOnlineMatchToCurrentUser`.
- Pure score math in `onlineRanking.js`.
- Current UI update is local user only.

Fields:
- `score`
- `peakScore`
- `peakCheckpoint`
- `wins`
- `losses`
- `lastMatchId`
- `lastMatchAt`

Risks:
- P1: idempotency uses only `lastMatchId`. It prevents immediate duplicate apply for the most recent match, but not re-application of an older match after another match has been processed.
- P1: `User.jsonc` still mentions `draws` and `lastUpdatedAt`; current code writes `lastMatchAt` and no draw counter.
- P2: No immutable match result/audit row.
- P2: Score write is client-side `updateMe`, not server validated against actual Lobby result.

Recommendation:
- Immediate/short term: align `User.online_progress` schema with actual writer.
- Medium term: create `OnlineMatchResult` with one row per player/lobby result and use it as durable idempotency/audit.

### Profile stats

Current source of truth:
- Puan: `getKronoxVisibleScore(user)` =
  `summarizeSoloProgress(...).totalSoloScore + User.online_progress.score`.
- Level: `getCurrentPlayableLevel(...)` from Solo progress.
- Elmas: canonical `User.diamonds`, with `DiamondTransaction` ledger rows
  where available. UI uses safe 0 only while auth/bootstrap data is missing.
- Avatar/initial: auth profile fields.
- Notification preference: `User.game_invite_notifications_enabled`.

Risks:
- P2: Visible Puan now combines Solo + Online through a helper, while Solo
  leaderboard ranking still uses Solo-only score. Keep labels/Health cases
  explicit so the two concepts do not drift.
- P1: notification preference is live and should remain documented in
  `User.jsonc`.
- P2/P1 hardening: Diamond multi-device duplicate prevention should be
  runtime-probed because Base44 uniqueness on
  `DiamondTransaction.idempotency_key` is not assumed. Current
  DiamondTransaction helpers provide function-level pre-check/post-confirm
  guards, not DB atomic upserts.

Recommendation:
- Document Profile stat semantics in schema docs and Health cases.
- Keep Diamond rewards idempotent through `User` guard fields plus
  `DiamondTransaction` rows.

### Leaderboard

Current source of truth:
- Display source: `getSoloLeaderboard` function reads `SoloLeaderboardEntry` first, then uses a bounded server-side `User.kronox_puan_total` repair/backfill window when the projection is stale or incomplete; client entity list remains a safe missing-function fallback.
- Current user mirror: `publishSoloLeaderboardEntry`.
- Ranking helper: `rankSoloLeaderboardEntries`.

Risks:
- P1: optional per-level fallback recomputes Solo score independently and may drift from `soloProgressHelpers`.
- P2: optional per-level record fallback still scans `User.list` until per-level best-score data has a rank-safe projection.
- P2: entity mirror is best-effort; rows can be stale if users never open Leaderboard or never trigger publish after score change. The runtime endpoint repairs top-score projection gaps server-side and returns `rankScope`/`rankConfidence` instead of treating an incomplete projection as exact.
- P2: exact current-user global rank beyond the fetched projection/User repair window is reported with `rankScope`/`rankConfidence` and still needs an indexed rank endpoint or dedicated projection for scale.

Recommendation:
- Short term: make `getSoloLeaderboard` match/import the canonical scoring helper logic or keep a Health case that compares boundary examples.
- Medium term: keep `SoloLeaderboardEntry` as the durable leaderboard source, update it on score writes, and add an idempotent backfill/current-rank function.

### Friends

Current source of truth:
- Accepted `FriendRequest` rows.
- `Friendship` is legacy cleanup only.

Risks:
- P1: no DB-level uniqueness means duplicate pending/accepted pairs are possible under race conditions.
- P1: RLS allows sender or recipient to update request status broadly.
- P2: friend display names are snapshot fields and may stale if the friend renames.

Recommendation:
- Short term: add two-account probes for duplicate/self/unauthorized status mutation.
- Medium term: add function-only accept/cancel/remove and tighten entity update policy if Base44 supports it.
- Medium term: consider `FriendshipEdge` or maintain accepted FriendRequest but enforce uniqueness.

### Game invites

Current source of truth:
- `GameInvite` rows.
- Active selector: `gameInviteSelectors`.
- Header/Online/toast derive from persisted pending actionable rows.

Risks:
- P1: entity RLS allows both sender and recipient update access; functions enforce accept/push but direct update paths exist.
- P2: TTL constant is duplicated across client and backend functions; Health currently checks parity, but it remains manual synchronization.
- P2: no retention policy for old completed/expired invites.
- P3: schema lacks `completed_at` and `cancelled_at`.

Recommendation:
- Short term: keep Health TTL parity and selector cases.
- Medium term: introduce a backend invite lifecycle function for all status transitions.
- Medium term: add cleanup/retention job or admin function.

### Lobby

Current source of truth:
- `Lobby` row for waiting room and live online game state.
- Functions enforce start and gameplay writes.
- Route state is bootstrap only.

Risks:
- P1: schema omits live critical fields `state_revision` and `winner_email`.
- P2: no explicit `expires_at` for lobby TTL; stale guard derives from `updated_date` / `created_date`.
- P2: no immutable match record; Lobby is mutable and can be deleted by host.
- P2: live state is a large nested JSON row; this is simple but can become fragile under concurrency and analytics needs.

Recommendation:
- Immediate/short term: add schema documentation for `state_revision` and `winner_email`.
- Short term: add explicit lobby lifecycle timestamps when safe.
- Medium term: create immutable `OnlineMatchResult`.

### Notifications

Current source of truth:
- Push subscriptions: `PushSubscription`.
- Notification preference: `User.game_invite_notifications_enabled`.
- Header notifications: derived from `FriendRequest` and `GameInvite`.
- Toast dismissed ids: local/in-memory only.
- Friend/game notification labels are public-username-only; missing or unsafe
  names fall back to generic Turkish labels instead of email/provider/internal
  ids.
- Valid pending notifications remain visible through transient empty
  fetch/subscription gaps and close only on explicit user action, terminal
  status, expiry, or confirmed source invalidation.

Risks:
- P1: notification preference field is absent from schema.
- P2: PushSubscription endpoint uniqueness is client-enforced.
- P2: delivery events are not persisted; troubleshooting is limited to function response/logs.

Recommendation:
- Short term: document preference in User schema.
- Medium term: add `NotificationEvent` only if product needs persistent inbox/history/delivery diagnostics.

## 4. Missing Persistence

| State | Current storage | Audit result | Recommendation |
| --- | --- | --- | --- |
| Solo current/unlocked/score | `User.solo_progress` + unscoped localStorage mirror | Persisted, but local mirror can drift/cross-account | Scope mirror per user or make server authoritative for signed-in users |
| Solo per-level history | Profile JSON best-only | Best result persisted; attempt history not durable | Add `SoloLevelProgress` / optional attempt history later |
| Solo level rank | Not persisted | Placeholder only | Add `SoloLevelProgress` or `SoloLevelCompletion` plus ranking function |
| Online match result | Only `User.online_progress.lastMatchId` and Lobby winner | Not enough audit/idempotency | Add `OnlineMatchResult` per user/lobby |
| Processed online match ids | Only last match | Weak idempotency | Use `OnlineMatchResult` unique row or processed ids |
| Online elapsed/result history | Mostly local/winner duration | Not durable | Store in `OnlineMatchResult` |
| Leaderboard sync state | `SoloLeaderboardEntry.updated_at` | Best effort | Make leaderboard entity authoritative or add backfill function |
| Tutorial completion | `User.hasCompletedTutorial`, schema missing | Persisted but schema drift | Document/add schema field |
| Notification preference | `User.game_invite_notifications_enabled`, schema missing | Persisted but schema drift | Document/add schema field |
| Toast dismissed ids | memory refs | Correctly transient | Keep local only |
| Active lobby return | derived from Lobby waiting membership | Correctly derived | Keep derived |
| Selected online categories | `Lobby.selected_category_ids` | Persisted | Keep |
| Invite recipients | `Lobby.invited_emails` and GameInvite rows | Persisted | Keep |
| Game completion audit | Lobby mutable final state; GameRecord for old solo | Weak for online | Add immutable match result later |
| Push delivery attempts | function return/log only | Not persisted | Add `NotificationEvent` only if operational debugging needs it |
| Health reports | localStorage last run | Correctly local/admin | Keep local |

## 5. Performance and Query Risks

| Query / flow | Current pattern | Risk | Recommendation |
| --- | --- | --- | --- |
| Global leaderboard | `getSoloLeaderboard` reads `SoloLeaderboardEntry.list('-total_kronox_score', limit)` first, merges a bounded server-side `User.kronox_puan_total` repair window when needed, and returns compact `topRows`, `currentUserRow`, friend keys, and `rankScope` | Projection-first and compact, repaired for stale/missing top projection rows, but exact off-window rank is scope-limited | Add indexed exact-rank/current-rank projection when user count grows |
| Optional per-level leaderboard record | `getSoloLeaderboard` service-role `User.list(..., 500)` fallback when `levelNumber` is requested | Not used by main Liderlik table, but still not scalable | Add rank-safe per-level projection or friend-record endpoint |
| Header notifications | Recent incoming FriendRequest lifecycle rows + GameInvite load + subscriptions + focus/visibility refresh | Reasonable; transient empty fetches are preserved while terminal rows remove actionable notifications | Keep shared selectors; monitor polling/subscription duplication |
| Online pending invites | `GameInvite.filter({ to_email })` then selector | Reasonable | Ensure status/email filters stay selective |
| Friend list | Two FriendRequest filters for accepted incoming/outgoing | Reasonable | Add uniqueness/normalization runtime probes |
| Active lobby return | Host fast path + filter waiting lobbies up to 20 | Reasonable now | Add explicit active lobby index/source if lobby volume grows |
| Lobby sync | subscription + 1.5s polling | Necessary fallback, potentially chatty | Keep for mobile reliability; revisit only after real device tests |
| Push subscriptions | filter by user+endpoint / user+status | Reasonable | Consider endpoint uniqueness if Base44 supports constraints |
| Expired rows | no retention cleanup | Rows accumulate | Add retention/cleanup admin function later |

Base44 schema files do not declare indexes/unique constraints. If Base44 supports index metadata, likely candidates are:
- `FriendRequest`: `(from_email, to_email, status)`
- `GameInvite`: `(to_email, status, expires_at)`, `(from_email, lobby_id)`
- `Lobby`: `(code)`, `(host_email, status)`
- `PushSubscription`: `(user_email, endpoint)`, `(user_email, status)`
- `SoloLeaderboardEntry`: `(owner_key)`, `total_solo_score`
- Future `OnlineMatchResult`: `(player_email, lobby_id)` unique
- Future `SoloLevelProgress`: `(user_email, level_number)` unique

## 6. Consistency and Duplication Risks

| Concept | Current duplication | Risk | Priority |
| --- | --- | --- | --- |
| Email normalization | `friendsApi.normalizeEmail`, `gameInviteSelectors.normalizeEmail`, backend local functions | Small drift risk | P2 |
| GameInvite TTL | central client constant plus mirrored backend constants | Parity must be maintained manually | P2 |
| Lobby stale TTL | client `LOBBY_STALE_AFTER_MS`, backend mirrors | Parity must be maintained manually | P2 |
| Solo score math | canonical helper plus duplicated service logic in `getSoloLeaderboard` | Leaderboard rank can drift | P1 |
| User schema docs | schema missing live fields/summary fields | Health/schema contracts can stale | P1 |
| Online score fields | code writes `lastMatchAt`; schema still says `lastUpdatedAt`/draws | Schema drift | P1 |
| Leaderboard source | function projection and entity mirror | Authority ambiguity/stale rows | P2 |
| Invite active filters | mostly centralized now | Good, keep it that way | P3 |
| Profile vs Solo level | shared helpers | Good | P3 |
| Elmas/Diamond balance | `User.diamonds` + `getDiamondBalance` + `getLeaderboardDiamondValue` | Keep one canonical economy field | P2 |

## 7. Security / RLS / Access Control Risks

Static inspection suggests a good baseline, but RLS/security needs real two-account and three-account probes.

| Area | Current guard | Risk | Required runtime probe |
| --- | --- | --- | --- |
| FriendRequest read | sender/recipient/admin RLS | Looks correct | User C cannot read A/B request |
| FriendRequest update | sender/recipient/admin RLS | Sender may be able to mutate status directly if client calls entity update | Sender cannot accept own outgoing request; User C cannot mutate |
| acceptFriendRequest | service role + recipient validation | Good | Recipient-only accept and idempotency |
| removeFriend | service role + current user pair lookup | Good | User C cannot remove A/B friendship |
| GameInvite read | sender/recipient/admin RLS | Looks correct | User C cannot read A/B invite |
| GameInvite update | sender/recipient/admin RLS | Broad direct update policy for lifecycle state | Sender cannot mark invite accepted/expired incorrectly via direct client |
| acceptGameInvite | service role + recipient validation + TTL + lobby stale | Good | Recipient-only accept; expired rejected |
| sendGameInvitePush | service role + sender validation | Good | Sender cannot push arbitrary invite id |
| Lobby read | host/player/admin RLS | Invited non-player cannot read until accept, by design | Invited user can accept via function; User C cannot read |
| Lobby update | host/admin RLS + gameplay function validation | Host direct update may bypass function if exposed | Non-active player cannot mutate via function; host direct write scope reviewed |
| User progress | current user updateMe | Client can write own score/progress | Server-side validation not present |
| SoloLeaderboardEntry | public read, creator/admin update | Good privacy shape | User cannot update someone else's row |
| PushSubscription | owner/admin RLS + service role send | Good | User C cannot read endpoint/key rows |

Service-role functions needing narrow ongoing review:
- `acceptFriendRequest`
- `removeFriend`
- `acceptGameInvite`
- `findLobbyByCode`
- `startLobbyGame`
- `updateLobbyGameState`
- `sendGameInvitePush`
- `getSoloLeaderboard`

The highest-risk service-role area is any function that reads all Users or mutates cross-user rows. `getSoloLeaderboard` appears privacy-safe because it returns only public projection fields, but it should remain covered by Health and code review.

## 8. Recommended Schema Changes

### P0 / release blocker

None found from static inspection. Do not run destructive migrations.

### P1 / near-term correctness and safety

1. Update `User.jsonc` to match live app fields.
   - Add/document `hasCompletedTutorial`.
   - Add/document `game_invite_notifications_enabled`.
   - Add full current `solo_progress` shape including `bestScore`, score breakdown, `lastAttemptAt`, and `summary`.
   - Update `online_progress`: remove or deprecate `draws` if no longer written; add `lastMatchAt`.
   - Risk: Low if schema is additive/documentary and does not remove old fields.

2. Scope Solo localStorage mirror per user.
   - Current key: `kx_solo_progress_v1`.
   - Safer shape: `kx_solo_progress_v1:<ownerKey>` or store `{ ownerKey, progress }`.
   - Keep guest fallback separately.
   - Risk: Medium because it touches read/write progress; requires manual regression.

3. Align `getSoloLeaderboard` with canonical Solo scoring.
   - Current function duplicates star/time/summary logic.
   - Fix by copying exact current boundary contract or moving a small pure shared module usable by both frontend and Base44 function.
   - Risk: Medium because it affects ranking.

4. Strengthen online idempotency.
   - Create `OnlineMatchResult` or similar immutable per-player result table.
   - Unique key: `(player_email, lobby_id)`.
   - Then `online_progress` can be derived or updated from durable applied rows.
   - Risk: Medium/high; requires migration/backfill strategy.

5. Tighten FriendRequest/GameInvite lifecycle writes.
   - Prefer function-mediated status transitions for accept/decline/cancel/expire.
   - Keep RLS read broad enough for sender/recipient, but narrow update if platform supports.
   - Risk: Medium due Base44 RLS behavior.

### P2 / short-term cleanup

1. Add Lobby schema fields already used by runtime.
   - `state_revision`
   - `winner_email`
   - `started_at`
   - `completed_at`
   - optional `expires_at` / `last_activity_at`

2. Add GameInvite lifecycle timestamps.
   - `cancelled_at`
   - `completed_at`

3. Keep leaderboard authority projection-first.
   - Current main-table authority: `SoloLeaderboardEntry`.
   - `getSoloLeaderboard` should query the projection first and may use a
     bounded server-side `User.kronox_puan_total` repair window when projection
     rows are stale/incomplete. Per-level record requests still use `User`
     until per-level rank data has its own projection.
   - Next scale step: indexed current-rank/pagination endpoint.

4. Add retention/cleanup functions.
   - Expired GameInvites.
   - Stale waiting Lobbies.
   - Expired PushSubscriptions.

5. Keep FriendRequest sender/target username snapshots backend-owned; add DB
   uniqueness proof before relying on them for hard duplicate prevention.

### P3 / future architecture

1. `UserGameStats`
   - Purpose: separate long-term gameplay stats from auth profile.
   - Fields: `user_email`, `solo_summary`, `online_summary`, `profile_xp`, `profile_level`, `diamonds`, `updated_at`.
   - Implement later when economy/account profile level becomes real.

2. `SoloLevelProgress`
   - Purpose: one row per user+level.
   - Fields: `user_email`, `level_number`, `best_stars`, `best_score`, `best_time_seconds`, `best_mistakes`, `attempts`, `completed_at`, `updated_at`.
   - Enables efficient level-specific ranking and safer backfill.

3. `OnlineMatchResult`
   - Purpose: immutable online score audit/idempotency.
   - Fields: `lobby_id`, `player_email`, `opponent_email`, `result`, `delta`, `score_before`, `score_after`, `elapsed_seconds`, `applied_at`.

4. `NotificationEvent` / `UserNotification`
   - Purpose: persistent notification inbox or delivery diagnostics.
   - Not needed now because header notifications derive from actionable FriendRequest/GameInvite rows.

5. `DailyQuestProgress`
   - Daily Quest is paused.
   - When resumed, use a dedicated entity; do not overload User profile JSON.

## 9. Migration / Compatibility Plan

General principles:
- Add fields before moving readers.
- Keep old readers working.
- Never reset progress.
- Never overwrite better stars/scores.
- Never reduce current/unlocked level.
- Never generate fake time values.
- Make backfills idempotent.
- Add Health cases before/with data model changes.

Suggested phased plan:

### Phase 1: documentation/schema alignment

- Update User schema to match live fields.
- Add Lobby schema fields used by runtime.
- Add GameInvite missing lifecycle timestamps.
- No data migration needed if additive.
- Health: schema/source contract cases.

### Phase 2: Solo local mirror hardening

- Introduce user-scoped localStorage key.
- On first read, if old unscoped mirror exists, only apply it for guest or for matching current user's previous marker if available.
- Persist server progress as authoritative for authenticated users unless an explicitly same-owner local mirror is newer/more advanced.
- Health: no cross-user local mirror case.

### Phase 3: leaderboard authority cleanup

- Decide `SoloLeaderboardEntry` authority.
- Add idempotent current-user publish on Solo write and Profile/Leaderboard load.
- Add admin/backfill function for all users if Base44 supports safe function invocation.
- Update `getSoloLeaderboard` to read `SoloLeaderboardEntry` or share exact scoring helper.

### Phase 4: online match result audit

- Add `OnlineMatchResult`.
- On game finish, create/apply current user's result through a function or an entity with unique `(player_email, lobby_id)`.
- Keep `User.online_progress` as summary.
- Backfill only from existing `online_progress`; do not invent historical matches.

### Phase 5: cleanup and retention

- Add cleanup functions for expired invites/lobbies/subscriptions.
- Review legacy `Friendship`, `LobbyMessage`, and old `GameRecord` usage after telemetry/runtime verification.

## 10. Health Center Recommendations

Do not add large cases to `simulationPanelExtraCases.js`. Use modular files and register through `simulationPanelCaseRegistry.jsx`.

Recommended new suites:

### data_model_health

Suggested cases:
- `user_schema_documents_live_profile_fields`
  - Static contract: User schema includes `hasCompletedTutorial`, `game_invite_notifications_enabled`, current Solo summary shape, and current Online fields.
- `solo_localstorage_mirror_user_scoped`
  - Static/runtime contract: signed-in users do not import another account's unscoped local progress.
- `solo_leaderboard_projection_uses_canonical_scoring`
  - Static/executable examples: 60-second boundary, star base score, missing-time behavior match `soloProgressHelpers`.
- `online_score_has_durable_idempotency_plan`
  - Warning until `OnlineMatchResult` exists.
- `lobby_schema_documents_state_revision_winner_email`
  - Static schema case.
- `game_invite_has_all_lifecycle_timestamps`
  - Static schema case.
- `push_subscription_owner_scoped`
  - Static RLS plus two-account NOT_AUTOMATABLE.

### persistence_contract_health

Suggested cases:
- `no_critical_gameplay_state_only_in_localstorage`
  - PASS for tutorial and signed-in Solo when server-backed; WARNING for unscoped mirror until fixed.
- `leaderboard_entry_source_matches_profile_score`
  - Executable on sample progress.
- `online_processed_match_not_last_only`
  - WARNING until immutable result records exist.
- `notification_badge_uses_persisted_actionable_entities`
  - Existing cases likely cover; keep.

### db_architecture_health

Suggested cases:
- `service_role_functions_scoped`
  - Static PASS for obvious user checks; NOT_AUTOMATABLE for RLS runtime probes.
- `schema_docs_exist`
  - PASS for this document plus profile/scoring docs.
- `scoring_docs_match_code`
  - Expand to include `getSoloLeaderboard` service projection.

Runtime-only cases should stay NOT_AUTOMATABLE:
- FriendRequest cross-user read/update.
- GameInvite cross-user read/update.
- PushSubscription privacy.
- Lobby join by invite/code authorization.
- Online score tampering prevention.

## 11. Open Questions

1. Should future ranking rows also become combined Kronox Puan, or should Solo and Online leaderboards stay separate while stat cards show combined Puan?
2. What is the smallest rank-safe projection needed to remove the remaining per-level `User` fallback?
3. Should authenticated Solo progress ever trust localStorage over server, or only use localStorage as a same-user cache?
4. Does Base44 support unique constraints/index metadata for entities? If yes, add them for FriendRequest, PushSubscription, SoloLeaderboardEntry, and future result entities.
5. Should old GameInvite/Lobby rows be retained for audit or cleaned after a fixed window?
6. Should FriendRequest accepted rows remain the long-term friendship model, or should a future dedicated FriendshipEdge replace it once uniqueness can be enforced?
7. When Daily Quest resumes, should it score against Solo, Online, or its own `DailyQuestProgress` entity?

## 12. Next Recommended Implementation Prompt

First safe DB/data-model improvement:

> Update User/Lobby/GameInvite schema documentation to match fields already used by runtime, without changing behavior. Add modular Health cases that verify schema docs include live fields: `hasCompletedTutorial`, `game_invite_notifications_enabled`, full `solo_progress` score summary shape, `online_progress.lastMatchAt`, `Lobby.state_revision`, `Lobby.winner_email`, and GameInvite `completed_at`/`cancelled_at` if added. Do not migrate data or change runtime logic.

Why first:
- Low risk.
- No product behavior change.
- Aligns Health and docs with actual code.
- Creates a safer base for later localStorage and leaderboard authority fixes.

## 13. What Was Intentionally Not Changed

- No destructive schema changes.
- No data deletion.
- No migrations.
- No scoring rule changes.
- No drag/drop, Timeline, QuestionCard, or GameLayout changes.
- No lobby/gameplay authority changes.
- No notification runtime changes.
- No Health score weakening.
- No Daily Quest implementation.
- No random matchmaking, bot fallback, or economy implementation.

---

## 14. Codex139 Implementation Status

The 5-step hardening roadmap was implemented only where it was additive and
safe.

### Phase 1 — Schema Documentation Alignment

Completed:

- `User.jsonc` documents live profile flags:
  `hasCompletedTutorial` and `game_invite_notifications_enabled`.
- `User.jsonc` documents the current `solo_progress` scoring/backfill shape,
  including per-level best score fields and derived summary fields.
- `User.jsonc` documents current `online_progress`, deprecates legacy `draws`
  / `lastUpdatedAt`, and points durable idempotency to `OnlineMatchResult`.
- `Lobby.jsonc` documents `state_revision`, `winner_email`, and lifecycle
  timestamp fields.
- `GameInvite.jsonc` documents `cancelled_at`.
- `OnlineMatchResult.jsonc` was added as an additive entity schema.

### Phase 2 — Solo localStorage User Scoping

Completed:

- Guest local mirror key: `kx_solo_progress_v1:guest`.
- Signed-in local mirror key: `kx_solo_progress_v1:<ownerKey>`.
- Signed-in reads accept only same-owner scoped/marked local mirrors.
- Old unscoped local progress migrates to guest-only fallback unless it has a
  matching owner marker.
- Server `User.solo_progress` remains the signed-in source of truth.

### Phase 3 — Leaderboard Authority / Scoring Drift Cleanup

Completed:

- `getSoloLeaderboard` projection now uses the canonical Solo time-bonus
  boundary: `seconds <= 60` gets +10.
- `SoloLeaderboardEntry` publishing remains a best-effort public-safe mirror
  built from normalized `User.solo_progress`.

Deferred:

- Making `SoloLeaderboardEntry` the only leaderboard authority. Current safe
  authority remains `User.solo_progress` projection plus mirror fallback.

### Phase 4 — OnlineMatchResult / Online Idempotency Hardening

Completed:

- Added `OnlineMatchResult` schema.
- `applyOnlineMatchToCurrentUser` checks an existing
  `OnlineMatchResult(player_email, lobby_id)` before applying score.
- The existing `lastMatchId` guard remains as recent-match compatibility.
- After `User.online_progress` is persisted, an `OnlineMatchResult` audit row
  is best-effort created with before/after score and delta fields.

Known limitation:

- Base44 unique-constraint support is not verified from this repo. Runtime
  uses a pre-check, but a database-level uniqueness guarantee would be
  stronger if supported.

### Phase 5 — Retention / Cleanup / RLS Hardening

Completed:

- Added `src/lib/dataRetention.js` cleanup utilities.
- Expired invites are marked expired; stale waiting lobbies are marked
  cancelled; no default deletion is performed.
- Push subscription and FriendRequest cleanup remain non-destructive/reporting
  policies.
- Added Health runtime probe matrix so RLS-sensitive checks remain visible and
  not fake-green.

Deferred:

- Tightening RLS/direct update permissions. This needs real two/three-account
  backend probes before changing production rules.

### Health Center

Added modular suite file:

- `src/components/game/simulationPanelDataModelCases.jsx`

Suites added:

- `data_model_health`
- `persistence_contract_health`
- `db_architecture_health`
- `online_match_result_health`
- `cleanup_retention_health`

No cases were added to `simulationPanelExtraCases.js`.
## Onboarding Phase 1 — GuestProfile

`GuestProfile` is the app-owned guest identity model. It is intentionally
portable: Kronox does not use Firebase and does not depend on Base44 anonymous
auth for guests. The row stores `guest_id`, `guest_token_hash`, public
`username` / `display_name`, status (`guest`, `linked`, `abandoned`), onboarding
status fields, future link fields, and last-seen timestamps.

Risk boundary: raw guest token must remain client/local-device only. Server-side
guest actions must verify `guest_id + token` by hashing with
`sha256:kronox_guest_v1` and comparing to `guest_token_hash`. `guest_id` alone is
not authorization.

Scale/uniqueness note: `username` and `guest_id` are logical unique keys. If the
platform supports unique indexes, configure them; until then, `createGuestProfile`
must retry collisions and later username-change/linking functions must repeat the
same uniqueness guard.

Post-onboarding Profile > Profil Bilgileri edits use `updateProfileSettings`.
Authenticated users are verified with `base44.auth.me()` and guest users with
`guest_id + token`. The editable fields are public `username` / `display_name`
plus optional private `age_group` / `gender`. Username uniqueness uses
`username_normalized` for case-insensitive checks. `age_group` and `gender` are not
leaderboard projection fields and must not influence scoring, economy,
matchmaking, Online selection, or Solo category weighting.

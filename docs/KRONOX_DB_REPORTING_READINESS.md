# Kronox DB Reporting Readiness

Status: reporting-readiness audit.

This document evaluates whether the current Base44 entities/functions can
support future product, economy, gameplay, and safety reports. It does not add
broad analytics implementation.

Privacy rule: reports may use internal identifiers server-side, but public UI
and exports must use username-safe or anonymized labels.

## Reporting Matrix

| Report | Current support | Source entity/function | Missing fields | Privacy risk | Recommended improvement | Backward-compatible |
| --- | --- | --- | --- | --- | --- | --- |
| DAU / WAU / MAU | Partial | `User`, `GuestProfile`, auth updates | normalized session/open event | raw email/guest ids | Add `AppSessionEvent` or compact daily aggregate | Yes |
| New vs returning users | Partial | `GuestProfile.created_at`, `User.created_date` | returning session events | guest token exposure | Store day-level login/open aggregate | Yes |
| Guest vs linked users | Good partial | `GuestProfile`, `AccountLinkTransaction`, `linkGuestAccount` | link cohort metadata | raw guest id | Keep link ledger, add anonymized cohort date | Yes |
| Level funnel | Partial | `User.solo_progress`, `GuestProfile.solo_progress` | attempt start/fail/pass event stream | user identity | Add compact `SoloLevelAttemptEvent` or aggregate | Yes |
| Level fail/pass rate | Partial | Solo progress best entries, `QuestionAttemptEvent` | failed attempts per level | question/user linkage | Add pass/fail event with level, moves, time | Yes |
| Average moves per level | Partial | Solo progress best entries | all attempts, not only best | identity | Add attempt-level HAMLE metrics | Yes |
| Average time per level | Partial | Solo best time | all attempts, failure time | identity | Add attempt-level elapsed seconds | Yes |
| Solo record counts | Partial | `getSoloLeaderboard` record context from progress | durable per-level record events | identity | Add per-level record projection or compact record event | Yes |
| Daily reward claims | Good partial | `DailyWheelSpin`, `UserDailyQuestProgress`, `DiamondTransaction` | device/session source | economy fraud | Add source/client platform metadata if available | Yes |
| Joker earn/spend/purchase | Good | `JokerTransaction`, `UserJokerInventory` | platform/session source | account id leakage | Keep ledger internal; public summaries only | Yes |
| Diamond balance changes | Good | `DiamondTransaction`, user/guest balance | platform/source metadata | financial-style audit risk | Add balance_after where safe/server-owned | Yes |
| Leaderboard movement | Partial | `SoloLeaderboardEntry`, `UserStatsProjection` | rank snapshot history | owner_key leakage | Add daily rank snapshot with leaderboard_id | Yes |
| Category preference distribution | Good partial | `UserCategoryPreference`, guest preferences | guest aggregate rollup | category plus identity | Aggregate by category_id only | Yes |
| Question exposure frequency | Good | `QuestionAttemptEvent`, `PlayerQuestionExposure`, daily exposure | normalized report aggregate | full question leakage | Keep admin-only, expose no question bank publicly | Yes |
| Question difficulty quality | Partial | question metadata + attempt correctness | denominator by active pool | question bank | Admin-only aggregate by category/difficulty | Yes |
| Correct/wrong distribution | Good partial | `QuestionAttemptEvent` | answer option diagnostics if needed | question text/years | Admin-only aggregate tables | Yes |
| Online lobby created/joined/started/abandoned | Partial | `Lobby`, `GameInvite`, `LobbyMatchStats` | lifecycle event log | player identity | Add `OnlineLobbyEvent` with public-safe actor hash | Yes |
| Invite sent/accepted/expired | Good partial | `GameInvite`, `createGameInvitesForTargets`, cleanup functions | notification channel/source | email/to/from leakage | Aggregate by status, day, and safe recipient_relation/source; keep email private | Yes |
| Notification shown/accepted/dismissed | Partial | UI only plus push subscription | durable shown/dismissed event | notification payload identity | Add compact `NotificationLifecycleEvent` if needed | Yes |
| Device/platform split | Weak | user agent/browser only if captured ad hoc | platform/device class | fingerprinting | Store coarse platform only with privacy note | Yes |
| Retention cohorts | Weak partial | creation dates plus progress | session/open events | identity | Add daily active aggregate, avoid raw device IDs | Yes |
| Economy fraud/race anomalies | Partial | idempotency keys in ledgers | duplicate-attempt diagnostics | account id | Add server-side duplicate/retry counters | Yes |

## Current Strengths

- Economy systems already use ledger-style entities and function-level
  idempotency keys.
- Question analytics has a private/admin report source in
  `QuestionAttemptEvent`.
- Leaderboard public payload is compact and username-safe.
- Guest account linking has a ledger-like `AccountLinkTransaction`.
- Daily Quest and Daily Wheel are separate from Kronox Puan.

## Current Gaps

- There is no general app/session event table for DAU/WAU/MAU or retention.
- Solo progress stores best/current state, not every attempt.
- Online lobby lifecycle is reconstructed from current `Lobby`/`GameInvite`
  rows instead of append-only events.
- Online player selection now records safe invite source/relation metadata on
  `GameInvite`, but it is still a lifecycle row, not an append-only reporting
  event stream.
- Notification shown/dismissed behavior is mostly UI state, not reporting data.
- DB unique/index proof is not present in repo for several idempotency keys.
- Coarse device/platform reporting is not defined.

## Question Analytics Manual Reset Scope

The admin `Soru Analitik Verilerini Sıfırla` card is guidance for manual DB
maintenance only; the function reset path remains disabled. The current email
report is admin-only and derives report sections from these sources:

- `Kategori Bazında Gösterim`: `QuestionAttemptEvent`,
  `PlayerQuestionDailyExposure`, `Question`, `Category`,
  `UserCategoryPreference`.
- `En Çok Soru Gören 10 Anonim Kullanıcı` and
  `Tekrar Riski En Yüksek 10 Anonim Kullanıcı`:
  `PlayerQuestionDailyExposure` plus `Category` labels.
- `En Çok Gösterilen Sorular` and `En Çok Yanlış Yapılan Sorular`:
  `QuestionAttemptEvent` plus current `Question` / `Category` labels.
- `Joker Kullanımı Analizi`: `QuestionAttemptEvent` for event-backed joker
  signals, plus protected `JokerTransaction` and `UserJokerInventory` ledger /
  current-state data for economy signals.
- `Oynanma Zamanı ve Kullanım Ritmi`: `QuestionAttemptEvent` timestamps for
  hour/day metrics, plus protected `DiamondTransaction` and `DailyWheelSpin`
  counts for activity notes.

Manual analytics reset clears `QuestionAttemptEvent`,
`PlayerQuestionDailyExposure`, and any populated `QuestionStatsProjection` /
`CategoryStatsProjection` manual aggregate rows. `PlayerQuestionExposure` is
optional and should be cleared only when the same-player anti-repeat memory
must restart.

The reset must not delete `Question`, `Category`, `User`, `GuestProfile`,
`PlayerProfile`, `UserCategoryPreference`, `UserJokerInventory`,
`JokerTransaction`, `DiamondTransaction`, Daily Wheel, Daily Quest,
leaderboard, score, progress, gameplay, or economy records. Ledger-derived
Joker/economy/activity signals can remain visible after a question analytics
reset because those protected ledgers are outside reset scope.

## FriendRequest Duplicate / Expiry Guard Phase 1

The repo does not prove a Base44 entity schema syntax for DB-level unique
constraints or indexes on active `FriendRequest` rows. Do not add invented
`unique`, `indexes`, or compound-key declarations until Base44 platform support
is captured and manually verified.

Phase 1 uses function-level hardening:

- `sendFriendRequest` resolves email/username targets server-side and keeps
  duplicate/open/expired/self/friend checks backend-owned.
- `FriendRequestOperationLock` is a short-lived admin-only operational lock for
  `friend_request_send`.
- Lock rows store hashed `lock_key`, `actor_key_hash`, and `target_key_hash`;
  they must not store or expose raw email, provider ID, owner_key, raw guest_id,
  or internal player_key.
- The function creates a TTL lock, re-reads active lock rows, selects one
  deterministic canonical winner, marks expired lock rows stale, and returns a
  safe in-progress response to losing duplicate sends.
- The lock is guard evidence, not transactional DB uniqueness proof.

Manual proof checklist before claiming production duplicate/expiry readiness:

- Account A sends an invite to Account B from Leaderboard.
- Account A retries while the invite is open and sees
  "Bu kişiye gönderilmiş açık davet var."
- Account A sends from Add Friend by registered username and by email and gets
  the same duplicate contract without target email exposure.
- An expired outgoing invite blocks resend with
  "Bu kişiye süresi dolmuş bir davetin var. Yeniden davet göndermeden önce eski daveti silmelisin."
- After Account A cancels/deletes the expired outgoing invite, Account A can
  send a fresh invite to the same target.
- Delivery failure does not remove the `FriendRequest` row.
- Rapid/parallel sends create at most one pending `FriendRequest`; competing
  calls return `FRIEND_REQUEST_IN_PROGRESS` or the open-invite warning.
- Public UI, client responses, and exported reports do not show email,
  provider ID, owner_key, raw guest_id, internal player_key, raw lock key, or
  lock hashes.

## Recommended Event Additions

These can be added later without changing existing product behavior:

| Event/table | Purpose | Minimal fields |
| --- | --- | --- |
| `AppSessionEvent` | DAU/WAU/MAU, retention | actor_key hash, player_type, day, platform_class, source |
| `SoloLevelAttemptEvent` | funnel, pass/fail, moves/time | actor_key hash, level, passed, used_moves, elapsed_seconds, stars, rules_version |
| `OnlineLobbyEvent` | lobby lifecycle | lobby_id, event_type, actor_key hash, player_count, status, source |
| `NotificationLifecycleEvent` | shown/dismissed/opened | notification_type, row_id, event_type, source, day |
| `EconomyIdempotencyEvent` | fraud/race diagnostics | idempotency_key hash, action, result, duplicate_detected |
| `LeaderboardRankSnapshot` | movement | leaderboard_id, rank, score, day, rank_confidence |

All actor identifiers should be internal hashes or opaque IDs, not public
emails, provider IDs, raw guest IDs, or owner keys in UI/exported reports.

## Economy Race Reporting Phase 1

Security Pass 2 adds a small backend-owned `EconomyOperationLock` guard for
same-player economy mutations. The row is operational, not a public analytics
surface. It may support admin-only diagnostics for race/fraud investigation.

Recommended Phase 1 economy anomaly reporting fields:

- anonymized actor key hash.
- operation scope: `market_purchase`, `solo_joker_spend`, `daily_wheel_claim`,
  or `daily_quest_claim`.
- hashed idempotency key.
- lock result: acquired / in_progress / stale_recovered / released.
- duplicate-attempt counter for same actor + scope + day.
- ledger consistency result: matched / partial / missing / repaired.
- `balance_before` and server-owned `balance_after` where already present in
  `DiamondTransaction`, `JokerTransaction`, or `DailyWheelSpin`.
- created day and coarse source.

Privacy rules:

- no email.
- no provider ID.
- no owner_key.
- no raw guest_id or guest token.
- no internal player_key in public UI/export.
- no full question bank or answer data.

DB unique/index proof remains a manual/platform gate for
`DiamondTransaction.idempotency_key`, `JokerTransaction.idempotency_key`,
`DailyWheelSpin.idempotency_key`, `DailyWheelSpin.user_email + spin_date`,
`UserJokerInventory.user_email + joker_type`, and active
`EconomyOperationLock.lock_key`. Until that proof exists, reports should label
race diagnostics as function-level guard evidence rather than transactional DB
proof.

## Online Player Selection / Invite Reporting Phase 1

Phase 1 does not add a broad invite analytics table. It adds small
backend-owned foundations to existing invite rows:

- `GameInvite.invite_target_ref`: opaque target ref used during backend invite
  creation; never displayed in UI.
- `GameInvite.recipient_relation`: `friend` / `not_friend` / `unknown` at
  creation time.
- `GameInvite.created_source`: for example `online_player_selection` or
  `legacy_friend_email`.

Public reports may aggregate by day/status/relation/source. They must not
export `from_email`, `to_email`, `user_email`, raw `target_ref`, provider ID,
owner_key, raw guest_id, internal player_key, or full question data.

## SoloLevelAttemptEvent Phase 1 Contract

`SoloLevelAttemptEvent` is the planned append-only reporting event for Solo
level funnel, pass/fail rate, HAMLE distribution, elapsed time, joker usage,
and record-readiness analysis. Phase 1 defines the contract and Health guard;
runtime writes stay deferred until a backend-owned function path is added and
manually proven. The client reducer must not write this event directly.

Minimum fields:

- `actor_key_hash`: internal anonymized actor key generated server-side.
- player_type: `guest` / `linked` / `unknown`.
- `level_id` or `level_number`.
- `rules_version`.
- `passed`.
- `used_moves`.
- `elapsed_seconds`.
- `stars`.
- `correct_placements`.
- `evaluated_moves`.
- `joker_used_summary`.
- category context only if safe and already present in the backend completion
  path.
- `created_at` and day.
- source: `solo_completion` / `solo_attempt`.

Privacy rules:

- no email.
- no provider ID.
- no owner_key.
- no raw guest_id.
- no internal player_key in public UI/export.
- no full question bank.
- no answer years / correct answers in public reports.

Implementation plan before enabling writes:

- Add a backward-compatible `SoloLevelAttemptEvent` entity schema only after a
  backend writer is ready; do not expose it in public UI.
- Add a backend-owned function such as `recordSoloLevelAttemptEvent` or fold the
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

## Implementation Guidance

- Prefer backend-owned event writes in Base44 functions for rewards, Online
  start, account linking, and leaderboard projections.
- Gameplay analytics must remain best-effort and non-blocking.
- Do not expose question text, correct answer years, full question bank, raw
  private identifiers, or auth/provider IDs in public reports.
- Keep report exports summarized or anonymized.
- Treat uniqueness/index constraints as manual/platform proof until Base44
  configuration is captured.

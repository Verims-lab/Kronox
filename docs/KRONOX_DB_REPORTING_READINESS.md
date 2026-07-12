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
| DAU / WAU / MAU | Good partial | `recordAppOpen`, `User.last_app_open_at`, `GuestProfile.last_app_open_at` | append-only session/open event | raw email/guest ids | Add `AppSessionEvent` or compact daily aggregate when cohort history is needed | Yes |
| New vs returning users | Good partial | `GuestProfile.created_at`, `User.created_date`, `recordAppOpen` | returning session history | guest token exposure | Store day-level login/open aggregate when history is needed | Yes |
| Guest vs linked users | Good partial | `GuestProfile`, `AccountLinkTransaction`, `linkGuestAccount` | link cohort metadata | raw guest id | Keep link ledger, add anonymized cohort date | Yes |
| Level funnel | Partial | `User.solo_progress`, `GuestProfile.solo_progress` | attempt start/fail/pass event stream | user identity | Add compact `SoloLevelAttemptEvent` or aggregate | Yes |
| Level fail/pass rate | Partial | Solo progress best entries, `QuestionAttemptEvent` | failed attempts per level | question/user linkage | Add pass/fail event with level, moves, time | Yes |
| Average moves per level | Partial | Solo progress best entries | all attempts, not only best | identity | Add attempt-level HAMLE metrics | Yes |
| Average time per level | Partial | Solo best time | all attempts, failure time | identity | Add attempt-level elapsed seconds | Yes |
| Solo record counts | Partial | `getSoloLeaderboard` record context from progress | durable per-level record events | identity | Add per-level record projection or compact record event | Yes |
| Daily reward claims | Good partial | `DailyWheelSpin`, `UserDailyQuestProgress`, `DiamondTransaction`, `JokerTransaction` | device/session source | economy fraud | Daily Wheel V2 stores server-selected reward type/id/segment, Gift Box package, Diamond ledger rows when Diamonds are granted, and Joker ledger rows when approved jokers are granted; keep first-login account-link rewards distinct via `first_login_reward` source | Yes |
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
| Device/platform split | Good partial | `recordAppOpen` coarse `app_platform` | historical platform event stream | fingerprinting | Keep only iOS/Android/Other/Unknown; add daily aggregate later if needed | Yes |
| Retention cohorts | Good partial | creation dates plus `last_app_open_at` | append-only session/open events | identity | Add daily active aggregate, avoid raw device IDs | Yes |
| Economy fraud/race anomalies | Partial | idempotency keys in ledgers | duplicate-attempt diagnostics | account id | Add server-side duplicate/retry counters | Yes |

## Current Strengths

- Economy systems already use ledger-style entities and function-level
  idempotency keys.
- Question analytics has a private/admin report source in
  `QuestionAttemptEvent`.
- Leaderboard public payload is compact and username-safe.
- Leaderboard reads use the materialized `SoloLeaderboardEntry.total_kronox_score`
  projection first. The fast player-facing Liderlik path may skip bounded
  `User.kronox_puan_total` repair and friend enrichment so top rows can render
  from projection/cache; repair remains a bounded server-side maintenance or
  fallback path and never returns full User rows.
- Guest account linking has a ledger-like `AccountLinkTransaction`.
- Daily Quest and Daily Wheel are separate from Kronox Puan.
- Unified Kronox Puan is the player-facing score source: Solo contributes the
  Solo best-score component and Online contributes `User.online_progress.score`.
- Online match scoring is flat and unified: winner `+15` Kronox Puan, loser
  `-6` Kronox Puan with checkpoint protection, and no Online speed bonus.
- Online result writes use the current `OnlineMatchResult` per-user/lobby
  actor idempotency row plus backend-owned `User`/`GuestProfile.online_progress`
  and `kronox_puan_total` projection updates. The durable receipt is reserved
  before visible score writes, partial writes reconcile from that receipt, and
  the client cannot write result/profile/leaderboard rows. Elapsed seconds are
  audit/display only and do not change the Online score delta.
- Visible score reads prefer the materialized `kronox_puan_total` projection
  when present, with derived Solo+Online computation only as a compatibility
  fallback for older rows.

## Current Gaps

- There is no append-only app/session event table for DAU/WAU/MAU or
  retention history. Current admin reporting has latest-open support through
  `recordAppOpen`.
- Solo progress stores best/current state, not every attempt.
- Online lobby lifecycle is reconstructed from current `Lobby`/`GameInvite`
  rows instead of append-only events.
- Online player selection now records safe invite source/relation metadata on
  `GameInvite`, but it is still a lifecycle row, not an append-only reporting
  event stream.
- Notification shown/dismissed behavior is mostly UI state, not reporting data.
- DB unique/index proof is not present in repo for several idempotency keys.
- DB/index proof for `SoloLeaderboardEntry.total_kronox_score` and
  `owner_key` remains manual/platform-level; the repo uses bounded sorted
  projection reads, owner-key dedupe, and optional repair rather than fake
  unsupported index syntax.
- Coarse device/platform reporting is latest-state only through
  `recordAppOpen`; historical platform/session cohorts still need a future
  aggregate/event table.

## Admin User Report Phase 1

`Kullanıcı Raporu` is an admin-only, read-only aggregate report. It does not
delete users, does not mutate score/economy data, and does not return raw rows
or private identifiers.

Current sources of truth:

- Total users: distinct valid `username` across `User` and `GuestProfile`.
  Invalid/empty unsafe usernames are excluded and reported as an excluded row
  count.
- Logged-in users: `User` rows with authenticated `email` / `user_email`,
  counted server-side only. Emails are not returned to the client.
- Guest users: active guest `GuestProfile` rows by valid username; linked guest
  profiles are not counted as guest-only users.
- Users with more than 0 Kronox Puan: `SoloLeaderboardEntry.total_kronox_score`
  as the leaderboard projection source, with non-destructive
  `User.kronox_puan_total` / `GuestProfile.kronox_puan_total` repair input when
  a projection row is missing.
- Inactive 10+ days: server-written `last_app_open_at` or `last_seen_at`.
  Users with no latest-open timestamp are reported separately as
  `Son açılış bilgisi olmayan kullanıcılar`; they are not silently merged into
  the inactive count.
- New users in 7 days: `created_at` / `created_date` by valid username.
- Active 1/7/30 days: latest server-owned open/seen timestamp.
- Platform breakdown: coarse `app_platform` only: `ios`, `android`, `other`,
  or `unknown`.
- Kronox ID coverage: aggregate counts only for rows with and without
  `kronox_user_id` across supported user/profile projections. The report must
  not return raw Kronox IDs, emails, provider IDs, owner_key, raw guest_id,
  internal player_key, or unsafe Base44 row IDs.

`recordAppOpen` is the small server-owned latest-open foundation:

- Authenticated users are derived from `auth.me` and updated through
  `base44.auth.updateMe`.
- Guest users require `guest_id + raw guest token` proof against
  `GuestProfile.guest_token_hash`.
- The function writes server time to `last_app_open_at` and `last_seen_at`;
  client timestamps are ignored.
- Platform is coarse only and may come from a client coarse class or request
  user-agent fallback. No precise device ID, fingerprint, provider ID,
  owner_key, raw guest_id, internal player_key, or raw guest token is stored or
  returned.
- Frontend calls are best-effort and throttled so app first paint is not
  blocked.

## Canonical Kronox ID Phase 1

`kronox_user_id` is the app-owned immutable user identifier for durable
relationship/reporting correlation. It is generated by backend-owned profile
creation/ensure paths, preserved through guest-to-account linking, and never
accepted from client update payloads.

Phase 1 implementation scope:

- New and existing `GuestProfile` / `User` actors receive a stable opaque
  `KX-XXXX-XXXX-XXXX` value through create/ensure/backfill paths.
- Account linking preserves the guest Kronox ID when a guest profile is linked
  to a registered account.
- Friend requests, Online presence, game invites, lobbies, match results,
  leaderboard/stat projections, preferences, and economy/reporting schemas
  carry optional Kronox ID fields for internal correlation while legacy keys
  remain available for backward-compatible reads.
- Public leaderboard, lobby, friend, invite, and notification payloads continue
  to expose username-safe labels and opaque public ids only.
- Admin reporting may show aggregate Kronox ID coverage counts, but must not
  export raw Kronox IDs in public/client reports.
- Account deletion and inactive-guest cleanup tombstone deleted Kronox IDs via
  `KronoxUserIdTombstone` so they are not reused.

Privacy and security rules:

- Do not use `kronox_user_id` as authorization proof.
- Do not derive it from email, provider ID, owner_key, raw guest_id, internal
  player_key, auth user ID, or Base44 row ID.
- Do not expose it in public UI or public exports; the current player may see
  and copy only their own ID in Profile Info, and admin/support tooling may use
  it only behind AdminUser-gated flows.
- Keep legacy fallback fields during migration so existing guest/auth rows,
  friend rows, presence rows, invites, lobbies, and leaderboard rows remain
  readable until all deployed rows are backfilled.

## Admin Inactive Guest Username Cleanup Phase 1

`Pasif Guest Kullanıcı Adlarını Temizle` is a separate AdminUser-gated
maintenance action. It is not part of the read-only `Kullanıcı Raporu` and it
does not run automatically.

Phase 1 behavior:

- Dry-run/preview is required before deletion. Preview returns only safe
  usernames, last-open timestamp, score, guest-only status, friend count, and
  aggregate skipped reason counts.
- Confirmed execution re-runs eligibility server-side and requires the admin to
  submit the unchanged preview candidate count plus the `SİL` confirmation
  phrase.
- Eligibility requires all of these to be true: server-written
  `last_app_open_at` / `last_seen_at` older than 10 days, known score exactly
  0 from `SoloLeaderboardEntry.total_kronox_score` or safe
  `GuestProfile.kronox_puan_total` repair source, `GuestProfile.status=guest`
  with no linked account evidence, no accepted friends, no pending social/game
  invite or active lobby relation, no fresh presence, and no positive Diamond
  balance.
- Missing/invalid last-open, ambiguous score source, linked/login evidence,
  score > 0, positive Diamond balance, friends, pending social relations, or
  active presence/lobby state blocks deletion.
- Confirmed cleanup deletes the eligible `GuestProfile`, deletes only that
  guest-owner zero-score `SoloLeaderboardEntry` projection, and removes that
  guest-owner presence rows. It does not delete `User` rows, real auth/provider
  accounts, Diamond/Joker ledgers, questions, categories, gameplay analytics,
  or unrelated records.
- Username reuse is achieved by removing the active `GuestProfile` username
  source and its guest-owner zero-score leaderboard projection. `kronox_user_id`
  reuse is blocked separately by `KronoxUserIdTombstone`; there is still no
  separate username registry/reservation entity in the repo.
- The response and UI must not expose email, provider ID, owner_key, raw
  guest_id, internal player_key, auth ID, or unsafe Base44 row IDs.
- Each preview/execute attempt writes an admin-only `AdminMaintenanceLog` row
  with safe aggregate counts and no private candidate IDs.

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
  or `daily_calendar_streak_claim`.
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

## Online Presence Operational Contract

`PlayerPresence` is operational state for Online/social availability, not a
public analytics/reporting table. Runtime writes go only through
`updatePlayerPresence`.

Current contract:

- linked actors are derived from `auth.me`;
- guest actors require `guest_id + raw guest token` proof against
  `GuestProfile.guest_token_hash`;
- server writes `last_heartbeat_at` and `presence_expires_at`;
- online freshness uses a 75 second TTL;
- the frontend sends a visible heartbeat every 25 seconds and refreshes
  friend/player presence every 12 seconds while visible;
- explicit offline writes are session-scoped, with TTL as the final safety net;
- public responses return username/status/opaque refs only.

Privacy rules:

- no email in public presence/player-selection responses;
- no provider ID;
- no owner_key;
- no raw guest_id or guest token;
- no internal player_key in public UI/export.

Base44 index/unique syntax is still not repo-proven for presence. `PlayerPresence`
therefore relies on backend guards plus bounded queries today; live two-device
proof and platform index/unique proof remain manual release gates.

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
- `level_type`: `before_after` / `timeline_basic` / `normal` / `special`.
- `rules_version`.
- `passed`.
- `used_moves`.
- `elapsed_seconds`.
- `stars`.
- `correct_placements`.
- `evaluated_moves`.
- `reference_card_count`.
- `playable_card_count`.
- `slot_selected_summary` for onboarding levels only, without question text or
  answer years.
- `joker_used_summary`.
- `hint_used_summary`.
- `training_consumable_used`: true only for onboarding training usage, where no
  real inventory decrement or spend ledger occurred.
- category context only if safe and already present in the backend completion
  path.
- `created_at` and day.
- source: `solo_completion` / `solo_attempt`.

Onboarding Phase 1 also has privacy-safe local/no-op analytics for
`before_after` and `timeline_basic` level start, first drag, drop, correct,
wrong, complete, fail, and tutorial close/skip. These local events are
best-effort and must not be treated as durable DB reporting until a
backend-owned writer exists.

Privacy rules:

- no email.
- no provider ID.
- no owner_key.
- no raw guest_id.
- no internal player_key in public UI/export.
- no full question bank.
- no answer years / correct answers in public reports.
- no question text or reference-card answer payloads in public reports.

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

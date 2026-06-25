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
| Invite sent/accepted/expired | Good partial | `GameInvite`, cleanup functions | notification channel/source | email/to/from leakage | Aggregate by status and day; keep email private | Yes |
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
- Notification shown/dismissed behavior is mostly UI state, not reporting data.
- DB unique/index proof is not present in repo for several idempotency keys.
- Coarse device/platform reporting is not defined.

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

## Implementation Guidance

- Prefer backend-owned event writes in Base44 functions for rewards, Online
  start, account linking, and leaderboard projections.
- Gameplay analytics must remain best-effort and non-blocking.
- Do not expose question text, correct answer years, full question bank, raw
  private identifiers, or auth/provider IDs in public reports.
- Keep report exports summarized or anonymized.
- Treat uniqueness/index constraints as manual/platform proof until Base44
  configuration is captured.


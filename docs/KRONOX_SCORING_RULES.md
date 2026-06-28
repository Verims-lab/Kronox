# Kronox Scoring Rules

## Purpose

This document is the source of truth for Kronox scoring.

Kronox has one player-facing score language:

```text
Kronox Puan
```

Internally, two scoring components feed that visible score:

* Solo scoring
* Online scoring

Visible UI must use:

* `Puan`
* `Kronox Puan`

Visible UI must use **Puan** or **Kronox Puan**.

Visible UI must not create separate player-facing labels such as:

* Solo Puan
* Online Puan

Solo and Online score components may remain separate internally for auditability, idempotency, backfill, and rule clarity.
Technical/internal docs may discuss base score, bonus, streak, accuracy, Solo
component, Online component, and projection details, but those components must
not fragment visible UI language into competing score names.

---

# 1. Unified Kronox Puan

Kronox has one visible score system.

Visible Kronox Puan is:

```text
Kronox Puan = Solo score component + Online score component
```

Expected helper/source:

```text
getKronoxVisibleScore(user)
```

All visible score surfaces must use the same source/helper:

* Home
* Solo
* Online
* Profile
* Leaderboard
* Header/stat surfaces
* Result popups where total score is shown

Rules:

* Do not show separate visible Solo Puan and Online Puan.
* Do not mutate Solo score from Online games.
* Do not mutate Online score from Solo games.
* Leaderboard displayed score and ranking score must match.
* Profile Puan and current-user Leaderboard row Puan must match.
* Online result popup must show actual persisted score/delta, not preview-only data.

---

# 2. Solo Mode Scoring

Implementation reference:

```text
src/lib/soloProgressHelpers.js
src/lib/soloLevels.js
```

## 2.1 Solo Level Rules

Each Solo level:

* normal Solo levels require the player to reach 7 correct timeline cards, including seed cards already on the timeline
* special Solo levels start at level 10 and repeat every 5 levels: 10, 15, 20, 25, ...
* special Solo levels require the player to reach 10 correct timeline cards, including seed cards already on the timeline
* has a total time limit of 180 seconds
* does not have per-question time limits
* fails if the timer reaches 180 seconds before completion
* starts with 2 timeline anchor cards
* has 10 evaluated placement moves
* Deck sizing is 2 anchors + 10 playable moves + Kart Değiştir buffer
* fails when 10 moves are used and the target card count has not been reached

Constants:

```text
SOLO_RULES_VERSION = 3
SOLO_NORMAL_CARD_TARGET = 7
SOLO_SPECIAL_CARD_TARGET = 10
SOLO_INITIAL_TIMELINE_CARDS = 2
SOLO_MAX_EVALUATED_MOVES = 10
SOLO_CORRECT_PLACEMENTS_NEEDED = 5
SOLO_SCORE_TIME_LIMIT_SECONDS = 180
```

Legacy `SOLO_SCORE_MAX_MISTAKES` / `SOLO_MAX_MISTAKES` aliases are not current
runtime constants. Internal historical metadata may still use `mistakes`, but
the visible Solo limit and failure model are HAMLE / evaluated moves.

Helper:

```text
getSoloCardsRequiredForLevel(level)
```

## 2.2 Solo Star Rules

Stars are based on used evaluated moves, not public error count. The live game UI shows remaining moves as `10 HAMLE`, `9 HAMLE`, and so on. A move is counted only when a valid timeline placement is evaluated as correct or wrong.

| Used Moves | Result  |
| ---------: | ------- |
|        5–6 | 3 stars |
|        7–8 | 2 stars |
|       9–10 | 1 star  |
| 10 without target | Fail |

Touching a card, drag start, drag movement, cancelled drag, invalid drop, tutorial hand animation, tutorial popup time, or joker activation does not consume a move.

Helper:

```text
calculateSoloStars(usedMoves, completedCards, elapsedSeconds, requiredCards, maxMoves)
```

For normal Solo levels, `requiredCards` is 7. For special Solo levels, `requiredCards` is 10.

## 2.3 Solo Base Points

Solo base points are awarded only when the level is passed.

|   Stars | Base Points |
| ------: | ----------: |
| 3 stars |          15 |
| 2 stars |          10 |
|  1 star |           5 |
|  Failed |           0 |

## 2.4 Solo Time Bonus

Solo time bonus is based on completion time.

|  Completion Time | Bonus |
| ---------------: | ----: |
|     0–60 seconds |   +15 |
|    61–90 seconds |   +10 |
|   91–120 seconds |    +5 |
|  121–180 seconds |    +0 |
| Timeout / failed |    +0 |

Helper:

```text
calculateSoloTimeBonus(elapsedSeconds, passed)
```

Boundary rule:

* exactly 60.0 seconds gets +15
* exactly 90.0 seconds gets +10
* exactly 120.0 seconds gets +5
* over 120 seconds gets +0
* exactly 180 seconds without completion is timeout/fail
* failed or timeout gets +0

## 2.5 Solo Total Level Score

Formula:

```text
levelScore = starPoints + timeBonus
```

Examples:

| Result               | Score |
| -------------------- | ----: |
| 3 stars, 54 seconds  |    30 |
| 3 stars, 75 seconds  |    25 |
| 2 stars, 110 seconds |    15 |
| 1 star, 150 seconds  |     5 |
| Failed level         |     0 |

Helper:

```text
calculateSoloLevelScore({ stars, elapsedSeconds, passed })
```

## 2.6 Solo Replay / Improvement Rule

Players can replay completed Solo levels.

Replay must not add the full score again.

Only the positive difference between the previous best and the new result is added.

Examples:

| Previous Best | New Result | Added |
| ------------: | ---------: | ----: |
|            15 |         25 |   +10 |
|            25 |          5 |    +0 |
|            25 |         25 |    +0 |

Rules:

* lower replay score does not reduce total score
* equal replay score does not change total score
* same-score replay does not add points
* lower-score replay does not add points
* better replay score adds only the improvement delta
* total Solo score is derived from per-level best scores
* total Solo score is not an accumulator that can double-apply
* old completed Solo results are not retroactively recalculated
* new Solo attempts use `soloRulesVersion: 3`

Helper:

```text
getBestSoloLevelResult(previousBest, newAttempt)
summarizeSoloProgress(progress)
```

## 2.7 Solo Progress Persistence

Solo progress is stored on:

```text
User.solo_progress
```

Expected shape:

```text
{
  currentLevel: number,
  levels: {
    "<levelNumber>": {
      bestStars: number,
      bestScore: number,
      bestScoreStars: number,
      bestScoreBaseScore: number,
      bestScoreTimeBonus: number,
      bestTimeSeconds: number?,
      bestUsedMoves: number?,
      bestRemainingMoves: number?,
      bestMaxMoves: number?,
      bestMistakes: number?,
      attempts: number,
      completedAt: string?,
      lastAttemptAt: string?
    }
  },
  summary: {
    currentLevel: number,
    unlockedLevel: number,
    totalSoloScore: number,
    completedLevelCount: number,
    totalStars: number,
    totalAttempts: number
  }
}
```

Rules:

* `currentLevel` is the unlocked frontier.
* Profile Seviye and Solo map must read through shared helpers.
* `totalSoloScore` is derived by `summarizeSoloProgress`.
* Do not directly accumulate `totalSoloScore`.

## 2.8 Solo Backfill Rule

For existing users with Solo progress but missing score fields:

* recalculate score from existing stars
* include time bonus only if `bestTimeSeconds` exists
* do not invent missing time
* backfill must be idempotent
* running backfill multiple times must not duplicate points

Helper:

```text
backfillSoloScores(progress, totalLevels)
```

---

# 3. Online Mode Scoring

Implementation reference:

```text
src/lib/onlineRanking.js
src/lib/applyOnlineResult.js
```

## 3.1 Online Match Result Rules

Every Online match must have:

* exactly one winner
* exactly one loser

There is no draw/tie scoring.

Do not add:

* draw result
* +3 / +3 tie score
* shared points for both players

If a match result is ambiguous, winner selection must be deterministic.

Suggested deterministic winner order:

1. higher correct count
2. shorter individual elapsed time
3. earlier finishedAt timestamp
4. deterministic lobby/player ordering

## 3.2 Online Winner Score

Winner receives:

```text
baseWinPoints = +15
```

Constant:

```text
ONLINE_WIN_POINTS = 15
```

## 3.3 Online Loser Score

Loser receives:

```text
lossPenalty = -6
```

Constant:

```text
ONLINE_LOSS_POINTS = -6
```

The loss is protected by checkpoint floor rules.

## 3.4 Online Winner Time Bonus

Only the winner can receive time bonus.

The bonus uses the winner’s own gameplay time, not total match time.

| Winner Individual Time | Bonus |
| ---------------------: | ----: |
|           0–60 seconds |   +10 |
|          61–90 seconds |    +5 |
|            91+ seconds |    +0 |
|   missing/unknown time |    +0 |

Examples:

| Winner Time | Winner Delta |
| ----------: | -----------: |
|      54 sec |          +25 |
|      75 sec |          +20 |
|     110 sec |          +15 |
|     missing |          +15 |

Rules:

* winner always gets +15 base score
* missing time gives +0 bonus
* loser never receives time bonus
* valid 0 seconds remains in the 0–60 tier

Helper:

```text
getOnlineWinnerTimeBonus(durationSeconds)
calculateOnlineWinnerDelta(elapsedSeconds)
```

## 3.5 Online Checkpoint System

Online score uses checkpoint protection.

Checkpoint ladder:

```text
0
100
250
500
1000
1500
2000
3000
```

Rule:

A player who has reached a checkpoint cannot fall below that checkpoint because of a loss.

Examples:

| Current Score | Loss | Result |
| ------------: | ---: | -----: |
|           263 |   -6 |    257 |
|           252 |   -6 |    250 |
|           101 |   -6 |    100 |
|            99 |   -6 |     93 |

Score must never go below 0.

Helpers:

```text
getOnlineCheckpoint(score)
applyOnlineScoreWithCheckpoint(currentScore, delta)
applyOnlineMatchResult(progress, { result, durationSeconds })
```

## 3.6 Online Helper Expectations

Recommended helper names:

```text
calculateOnlineWinnerDelta(elapsedSeconds)
calculateOnlineLoserDelta()
getOnlineCheckpoint(score)
applyOnlineScoreWithCheckpoint(currentScore, delta)
applyOnlineMatchResultOnce(matchResult)
```

Expected behavior:

```text
calculateOnlineWinnerDelta(elapsedSeconds):
- base = 15
- <= 60 sec: base + 10
- > 60 and <= 90 sec: base + 5
- otherwise: base

calculateOnlineLoserDelta():
- return -6
```

## 3.7 Online Idempotency Rule

Online score must be applied exactly once per user per match/lobby.

Rules:

* same match must not add points twice
* same match must not deduct points twice
* refreshing result screen must not apply score again
* re-entering a completed lobby/game must not apply score again
* idempotency is per user, because winner and loser each need their own update

Expected durable idempotency source:

```text
OnlineMatchResult
```

Expected fields include:

```text
idempotency_key
player_email
lobby_id
result
score_before
score_after
delta
effective_delta
applied_at
```

Critical rule:

A durable per-user/lobby idempotency record must exist before or safely together with the visible score write.
The current idempotency key shape is:

```text
online_match_result:<lobby_id>:<player_email>
```

If score persistence fails:

* do not show success state
* show a meaningful error
* allow safe retry
* do not double-apply on retry

## 3.8 Online Score Persistence

Recommended user fields:

```text
online_progress.score
online_progress.peakScore
online_progress.peakCheckpoint
online_progress.wins
online_progress.losses
online_progress.lastMatchId
online_progress.lastMatchAt
```

Rules:

* Online scoring must not mutate Solo progress.
* Solo scoring must not mutate Online progress.
* Visible Kronox Puan combines Solo + Online through the shared helper.
* Legacy `draws` or `lastUpdatedAt` fields may be tolerated for old rows but must not be written by new scoring logic.

---

# 4. Leaderboard / Profile Display

Leaderboard and Profile must use unified Kronox Puan.

Expected persisted/index-friendly projection:

```text
User.kronox_puan_total
SoloLeaderboardEntry.total_kronox_score
```

Rules:

* `User.kronox_puan_total` should match `getKronoxVisibleScore(user)`.
* `SoloLeaderboardEntry` is the current internal leaderboard projection source;
  despite the historical name, `total_kronox_score` is unified Kronox Puan.
  Public leaderboard rows come from `getSoloLeaderboard` with sanitized
  `username` and opaque `leaderboard_id`.
* Leaderboard sort score and displayed score must match.
* Profile visible Puan and current user Leaderboard row Puan must match.
* Leaderboard should not expose unnecessary private user fields.
* Elmas must not be derived from Kronox Puan.

---

# 5. Health Coverage Expectations

Health Center should cover:

## Solo

```text
solo_star_rules_contract
solo_time_bonus_contract
solo_level_score_contract
solo_replay_delta_only_contract
solo_backfill_idempotent_contract
solo_total_score_separate_from_online_contract
```

## Online

```text
online_score_win_loss_contract
online_score_time_bonus_contract
online_score_checkpoint_floor_contract
online_score_no_draw_contract
online_score_idempotent_match_result
online_score_applied_on_game_completion
online_score_persistence_field_matches_reader
online_score_not_solo_total_score
online_score_authority_model_documented
```

## Unified Puan

```text
unified_kronox_score_health
online_score_visible_puan_health
leaderboard_health
profile_economy
```

Rules:

* Do not add large cases to `simulationPanelExtraCases`.
* Use modular Health suites.
* Runtime/two-account tests may remain NOT_AUTOMATABLE.
* Do not fake PASS.

---

# 6. Manual Test Matrix

## Solo

1. 5 used moves, 55 sec → 3 stars, 30 points.
2. 6 used moves, 75 sec → 3 stars, 25 points.
3. 7 used moves, 100 sec → 2 stars, 15 points.
4. 9 used moves, 150 sec → 1 star, 5 points.
5. 10 moves used without reaching the target → fail, 0 points.
6. Same-score replay does not add points.
7. Lower-score replay does not add points.
8. Better replay adds only the positive score delta.

## Online

1. Winner 54 sec → winner +25, loser -6 checkpoint protected.
2. Winner 75 sec → winner +20, loser -6 checkpoint protected.
3. Winner 110 sec → winner +15, loser -6 checkpoint protected.
4. Loser 252 score → protected to 250.
5. Loser 263 score → becomes 257.
6. Loser 101 score → protected to 100.
7. Same match processed twice → score applied once.
8. Code/lobby path completed → score updates.
9. Friend invite path completed → score updates.
10. No draw/tie score is created.

---

# 7. Developer Notes

This document is the product scoring source of truth.

If code behavior differs from this file:

1. report the mismatch
2. confirm product decision
3. update code
4. update Health
5. run regression tests

If product decisions change:

1. update this document first
2. update implementation second
3. update Health third
4. run regression tests

Do not leave historical audit reports inside this file. Historical scoring audits should live in archive docs if needed.
## GuestProfile Scoring Boundary

Onboarding Phase 1 adds app-owned `GuestProfile` identity only. Onboarding
Phase 2 replaces the old tutorial with a guided first Solo level but does not
change Solo scoring, Online scoring, Kronox Puan calculation, drag/drop, or
leaderboard ranking rules.

The guided first level is intentionally forgiving and instructional. It may
persist normal guest Solo progress locally after successful completion, but it
must not create free normal-mode joker fallback or spend real joker inventory.
Account linking preserves the user-beneficial score/progress state without
double-counting guest and registered sources. `linkGuestAccount` keeps the best
per-level Solo result, keeps user-beneficial Online progress fields, and stores
the safest higher `User.kronox_puan_total` projection. It does not change the
Kronox Puan formula or Solo/Online scoring rules. Guest leaderboard rows use a
guest internal owner key and are migrated/passivated when the account links.

Profile > Profil Bilgileri may update `username` and optional private `age_group` / `gender`.
`display_name` is only a legacy/internal projection mirror of username. Only
username affects public identity display; public leaderboard payloads must not
return `display_name`.
Age and gender must not affect scoring, level unlocks, matchmaking, leaderboard
rank, Solo question weighting, or Online question selection.

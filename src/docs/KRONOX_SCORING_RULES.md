# Kronox Scoring Rules

> **Source of truth for Solo + Online scoring.** This document describes the
> product rules. Implementation pointers are noted under each section.
> Historical mismatches are tracked at the bottom of this file. As of
> Codex139, the active scoring code and Health Center contracts are aligned
> with the product rules below.

---

## 1. Purpose

Kronox uses two score systems:

- **Solo scoring** rewards level completion quality, stars, completion time,
  and replay improvement.
- **Online scoring** rewards competitive match wins, applies a small loss
  penalty, gives winner time bonuses, and protects users from falling below
  reached checkpoint floors.

Solo score and Online score MUST remain conceptually separate unless a future
product decision explicitly merges them. Persisted fields, helpers, and UI
surfaces must reflect that separation.

---

## 2. Solo Mode Scoring

Implementation: `lib/soloProgressHelpers.js`.

### 2.1 Solo Level Rules

Each Solo level:

- Requires the player to place **10 cards**
  (`SOLO_SCORE_CARD_TARGET = 10`).
- Has a total time limit of **120 seconds**
  (`SOLO_SCORE_TIME_LIMIT_SECONDS = 120`).
- Does **not** have per-question time limits.
- **Fails** if the player reaches 120 seconds without completing the level.
- **Fails** if the player makes **8 or more mistakes**
  (`SOLO_SCORE_MAX_MISTAKES = 8`).

### 2.2 Solo Star Rules

Stars are based on mistake count:

| Mistakes      | Result               |
| ------------: | -------------------- |
| 0 mistakes    | 3 stars              |
| 1 mistake     | 3 stars              |
| 2–4 mistakes  | 2 stars              |
| 5–7 mistakes  | 1 star               |
| 8+ mistakes   | Fail / no level pass |

Helper: `calculateSoloStars(mistakes, completedCards, elapsedSeconds)`.

### 2.3 Solo Base Points by Stars

Solo score awarded for a passed level
(`SOLO_STAR_BASE_SCORES`):

| Stars   | Points    |
| ------: | --------: |
| 3 stars | 10 points |
| 2 stars | 8 points  |
| 1 star  | 5 points  |
| Failed  | 0 points  |

### 2.4 Solo Time Bonus

Solo time bonus is based on completion time:

| Completion Time   | Bonus      |
| ----------------: | ---------: |
| 0–60 seconds      | +10 points |
| 61–90 seconds     | +5 points  |
| 91–120 seconds    | +0 points  |
| Timeout / failed  | +0 points  |

Helper: `calculateSoloTimeBonus(elapsedSeconds, passed)`.

Implementation boundary: `elapsedSeconds <= 60` receives +10, `<= 90`
receives +5, and `> 90` receives +0. Exactly **60.0s yields +10**.

### 2.5 Solo Total Level Score

Solo level score formula:

```
levelScore = starPoints + timeBonus
```

Examples:

- 3 stars, 54 seconds → 10 + 10 = **20 points**
- 3 stars, 75 seconds → 10 + 5 = **15 points**
- 2 stars, 100 seconds → 8 + 0 = **8 points**
- 1 star, 88 seconds → 5 + 5 = **10 points**
- Failed level → **0 points**

Helper: `calculateSoloLevelScore({ stars, elapsedSeconds, passed })`.

### 2.6 Solo Replay / Improvement Rule

Players can replay completed Solo levels to improve stars and score.

**Important rule:**

- Replaying a level must **not** add the full score again.
- Only the **positive difference** between the old best score and the new
  score is added.
- If the new score is lower or equal, total score does not change.

Examples:

- Previous best for Level 3: 8 points
  - New result: 15 points
  - Added to `totalSoloScore`: **+7**

- Previous best for Level 3: 15 points
  - New result: 10 points
  - Added to `totalSoloScore`: **+0**

Helper: `getBestSoloLevelResult(previousBest, newAttempt)` returns
`{ updatedBestLevelResult, previousBestScore, scoreDelta, didImprove }`.
`totalSoloScore` is **derived** every read from per-level `bestScore` values
via `summarizeSoloProgress(...)`, so this rule holds even if a write is
double-applied.

### 2.7 Solo Progress Persistence

Stored on `User.solo_progress`. Shape:

```
{
  currentLevel: number,           // unlocked frontier writer
  levels: {
    "<levelNumber>": {
      bestStars: number (0..3),
      bestScore: number,
      bestScoreStars: number,
      bestScoreBaseScore: number,
      bestScoreTimeBonus: number,
      bestTimeSeconds: number?,   // optional
      bestMistakes: number?,      // optional
      attempts: number,
    }
  },
  summary: {                       // derived; rewritten on every save
    currentLevel, unlockedLevel,
    totalSoloScore, completedLevelCount,
    totalStars, totalAttempts,
  }
}
```

- `currentLevel` is the persisted unlocked frontier.
- Profile **Level** tile and Solo Level Path CTA both read through
  `getCurrentPlayableLevel(progress, totalLevels)` — single source of truth.
- `totalSoloScore` is **derived** by `summarizeSoloProgress(...)` summing
  per-level `bestScore`. It is **never** an accumulator.

### 2.8 Solo Backfill Rule

If existing users already have Solo level/star progress but missing score
fields:

- Recalculate score from existing stars
  (`SOLO_STAR_BASE_SCORES[bestStars]`).
- If `bestTimeSeconds` exists, include the time bonus.
- If `bestTimeSeconds` does **not** exist, calculate score using star points
  only (do **not** invent a time).
- Backfill must be **idempotent**.
- Running the backfill multiple times must **not** duplicate points.

Helper: `backfillSoloScores(progress, totalLevels)` → `{ progress, changed }`.

---

## 3. Online Mode Scoring

Implementation: `lib/onlineRanking.js` + `lib/applyOnlineResult.js`.

### 3.1 Online Match Result Rules

Every Online match **must** have:

- exactly **one** winner
- exactly **one** loser

There is **no** draw/tie scoring.

Do **not** add:

- draw result
- +3 / +3 tie score
- shared points for both players

If a match result is ambiguous, winner selection must be deterministic.

**Suggested deterministic winner order:**

1. higher correct count
2. if tied, shorter elapsed time
3. if tied, earlier `finishedAt` timestamp
4. if still tied, deterministic lobby/player ordering

Implementation note: active code returns zero delta for unsupported result
values and does not emit `draws`. Legacy rows may still contain old `draws`
data, but new writes ignore it.

### 3.2 Online Winner Score

Winner receives:

```
baseWinPoints = +15
```

Constant: `ONLINE_WIN_POINTS = 15`.

### 3.3 Online Loser Score

Loser receives:

```
lossPenalty = -6
```

Constant: `ONLINE_LOSS_POINTS = -6`.

The loss is protected by the **checkpoint floor** rules (see 3.5).

### 3.4 Online Winner Time Bonus

Only the **winner** can receive a time bonus.

| Winner Completion Time | Bonus      |
| ---------------------: | ---------: |
| 0–60 seconds           | +10 points |
| 61–90 seconds          | +5 points  |
| 91+ seconds            | +0 points  |
| missing/unknown time   | +0 points  |

The winner must still receive the +15 base score even if `elapsedSeconds`
is missing.

Examples:

- Winner finishes in 54 seconds → +15 +10 = **+25**
- Winner finishes in 75 seconds → +15 +5 = **+20**
- Winner finishes in 110 seconds → +15 +0 = **+15**
- Winner time missing → **+15**

Loser **never** receives a time bonus.

Helper: `getOnlineWinnerTimeBonus(durationSeconds)`.

Implementation note: missing, null, non-finite, or negative elapsed time
receives +0 bonus. A valid `0` seconds value remains in the 0–60s tier.

### 3.5 Online Checkpoint System

Online score uses checkpoint protection.

Checkpoint values (`ONLINE_CHECKPOINTS`):

| Checkpoint |
| ---------: |
| 0          |
| 100        |
| 250        |
| 500        |
| 1000       |
| 1500       |
| 2000       |
| 3000       |

**Rule:** A player who has reached a checkpoint cannot fall below that
checkpoint because of a loss.

Examples:

- Current score: 263, current checkpoint: 250, loss: −6 → new score **257**.
- Current score: 252, current checkpoint: 250, loss: −6 → raw 246 →
  protected score **250**.
- Current score: 101, current checkpoint: 100, loss: −6 → protected
  score **100**.
- Current score: 99, current checkpoint: 0, loss: −6 → new score **93**.

Score must **never** go below 0.

Helper: `applyOnlineMatchResult(progress, { result, durationSeconds })`.
The floor is `max(stored peakCheckpoint, getReachedCheckpoint(previousScore))`.

### 3.6 Online Score Helper Expectations

Online score calculation should be centralized. Recommended helpers (names
the Health Center looks for):

- `calculateOnlineWinnerDelta(elapsedSeconds)`
- `calculateOnlineLoserDelta()`
- `getOnlineCheckpoint(score)`
- `applyOnlineScoreWithCheckpoint(currentScore, delta)`
- `applyOnlineMatchResultOnce(matchResult)`

**Expected behavior:**

`calculateOnlineWinnerDelta(elapsedSeconds)`:

- `base = 15`
- if `elapsedSeconds <= 60` → `base + 10`
- if `elapsedSeconds > 60 && elapsedSeconds <= 90` → `base + 5`
- otherwise → `base`

`calculateOnlineLoserDelta()`:

- return `-6`

`getOnlineCheckpoint(score)`:

- `score >= 3000` → 3000
- `score >= 2000` → 2000
- `score >= 1500` → 1500
- `score >= 1000` → 1000
- `score >= 500` → 500
- `score >= 250` → 250
- `score >= 100` → 100
- otherwise → 0

`applyOnlineScoreWithCheckpoint(currentScore, delta)`:

- if `delta >= 0`: return `currentScore + delta`
- if `delta < 0`:
  - `checkpoint = getOnlineCheckpoint(currentScore)`
  - `rawScore = currentScore + delta`
  - return `Math.max(rawScore, checkpoint, 0)`

Implementation note: the canonical helpers and doc-named aliases are both
exported from `lib/onlineRanking.js`; aliases are thin wrappers and do not
duplicate math.

### 3.7 Online Idempotency Rule

Online score must be applied **exactly once per user per match/lobby**.

Important:

- Same match must **not** add points twice.
- Same match must **not** deduct points twice.
- Refreshing result screen must **not** apply score again.
- Re-entering a completed lobby/game must **not** apply score again.
- Idempotency must be **per-user**, because winner and loser each need
  their own update.

Implementation (current):

- `OnlineMatchResult` stores the durable per-user/lobby audit/idempotency
  row for future matches.
- `online_progress.lastMatchId` remains a recent-match guard for the most
  recent lobby id.
- `applyOnlineMatchToCurrentUser({ lobbyId, ... })` first checks
  `OnlineMatchResult(player_email, lobby_id)`, then falls back to
  `lastMatchId`, then applies the score only once.

**Critical rule:** Mark a match as score-applied only **after** score
persistence succeeds.

If score persistence fails:

- Do **not** mark as applied.
- Show/log a meaningful error.
- Allow safe retry.

If `updateMe` fails, no `OnlineMatchResult` row is created and the function
returns a structured retryable error. If the audit row write fails after the
score update succeeds, `lastMatchId` still protects the immediate re-open
path and the function reports the audit persistence status.

### 3.8 Online Score Persistence

Online score must be **separate** from Solo score.

Recommended user fields:

- `online_progress.score`
- `online_progress.peakScore`
- `online_progress.peakCheckpoint`
- `online_progress.wins`
- `online_progress.losses`
- `online_progress.lastMatchId`
- `online_progress.lastMatchAt`

Rules:

- Online scoring must **not** mutate `totalSoloScore`.
- Solo scoring must **not** mutate `online_progress.score`.
- Codex146 product decision: visible **Kronox Puan** is explicitly derived
  by `getKronoxVisibleScore(user)` as
  `solo_progress.totalSoloScore + online_progress.score`.
- Solo and Online storage remain separate even though the player-facing
  Puan combines them.

Implementation (current):

- `applyOnlineMatchResult(...)` writes
  `{ score, peakScore, peakCheckpoint, wins, losses, lastMatchAt }`.
- `applyOnlineMatchToCurrentUser(...)` adds `lastMatchId` and writes the
  whole `online_progress` block via `base44.auth.updateMe(...)`.
- `applyOnlineMatchToCurrentUser(...)` then best-effort creates
  `OnlineMatchResult` with `score_before`, `score_after`, `delta`,
  `effective_delta`, and `applied_at`.
- If a previous bad deploy created an `OnlineMatchResult` without making
  the user-visible score reflect it, `reconcileOnlineMatchResultForCurrentUser`
  repairs only the safe case where the current score still matches the
  audit row's `score_before`.
- **`totalSoloScore` is never touched by these paths** (verified — the
  only writers of solo state are `lib/soloLevels.js` /
  `lib/soloProgressHelpers.js`).

Legacy rows with `draws` or `lastUpdatedAt` are still tolerated, but new
writes do not emit them.

### 3.9 Online Authority Model

The current implementation uses **Option A — each client updates only
its own score.**

- Winner client applies winner score to its own profile via
  `base44.auth.updateMe(...)`.
- Loser client applies loss score to its own profile via
  `base44.auth.updateMe(...)`.
- Guarded against duplicate apply via `online_progress.lastMatchId`.
- Hardened against older lobby reopens via `OnlineMatchResult`.
- One client cannot update another user, because `updateMe` is
  scoped to the authenticated caller.

**This is the documented authority model for Kronox today.** If the
product team chooses to migrate to Option B (a backend function that
applies both players atomically), this section must be updated first,
implementation second, Health Center third.

---

## 4. Leaderboard / Profile Display

Current expected behavior:

- Solo leaderboard uses **Solo score / `totalSoloScore`** unless product
  explicitly changes it.
- Online score is **separate** unless an Online leaderboard is added.
- Profile must not accidentally show stale or mismatched score fields.
- Visible **Kronox Puan** on Home/Solo/Online/Profile/Liderlik stat
  surfaces means `getKronoxVisibleScore(user)`.
- Solo leaderboard rows/ranking still use Solo score (`totalSoloScore`).

Important:

- Do **not** mix Solo and Online storage writes. The visible combined Puan
  must stay in the shared helper, not duplicated in UI components.
- Do **not** calculate **Elmas** from score.
- Do **not** calculate **Elmas** from stars.
- Elmas economy is **separate** and currently a placeholder/real-field
  based value depending on implementation (`getLeaderboardDiamondValue`).

---

## 5. Health Center Requirements

Health Center should include or preserve cases for:

**Solo:**

- `solo_star_rules_contract`
- `solo_time_bonus_contract`
- `solo_level_score_contract`
- `solo_replay_delta_only_contract`
- `solo_backfill_idempotent_contract`
- `solo_total_score_separate_from_online_contract`

**Online:**

- `online_score_win_loss_contract`
- `online_score_time_bonus_contract`
- `online_score_checkpoint_floor_contract`
- `online_score_no_draw_contract`
- `online_score_idempotent_match_result`
- `online_score_applied_on_game_completion`
- `online_score_code_lobby_path_supported`
- `online_score_invite_path_supported`
- `online_score_persistence_field_matches_reader`
- `online_score_not_solo_total_score`
- `online_score_authority_model_documented`

**Health rules:**

- Do **not** add large cases to `simulationPanelExtraCases`.
- Use the modular Health registry.
- Runtime / two-account tests can remain `NOT_AUTOMATABLE` when real
  backend / device proof is required.
- Static scoring contracts should **PASS**.

---

## 6. Manual Test Matrix

**Solo:**

1. 0 mistakes, 55 sec → 3 stars, **20 points**.
2. 1 mistake, 75 sec → 3 stars, **15 points**.
3. 3 mistakes, 100 sec → 2 stars, **8 points**.
4. 6 mistakes, 80 sec → 1 star, **10 points**.
5. 8 mistakes → fail, **0 points**.
6. Replay lower score → no total increase.
7. Replay higher score → only difference is added.

**Online:**

1. Winner 54 sec → winner **+25**, loser **−6** checkpoint protected.
2. Winner 75 sec → winner **+20**, loser **−6** checkpoint protected.
3. Winner 110 sec → winner **+15**, loser **−6** checkpoint protected.
4. Loser 252 score → **250**.
5. Loser 263 score → **257**.
6. Loser 101 score → **100**.
7. Same match processed twice → score applied **once**.
8. Code/lobby path completed → score updates.
9. Friend invite path completed → score updates.
10. No draw/tie score is created.

---

## 7. Developer Notes

This document is the product scoring source of truth.

If code behavior differs from this file:

- **report** the mismatch
- update code only after product confirmation
- update Health Center cases accordingly

If product decisions change:

- update this document first
- then update implementation
- then update Health Center
- then run regression tests

---

## 8. Audit — Code vs. Documented Rules (Codex136/Codex139 alignment)

Codex136 aligned the implementation with this document. Every mismatch
from the original audit is now either fixed in code or covered by a
backward-compatible alias. Health Center cases were added in a new
modular file: `components/game/simulationPanelScoringContractCases.jsx`.

### 8.1 ✅ Matches (PASS)

- **Solo cards/time/mistakes constants** (`SOLO_SCORE_CARD_TARGET=10`,
  `SOLO_SCORE_TIME_LIMIT_SECONDS=120`, `SOLO_SCORE_MAX_MISTAKES=8`).
- **Solo star table** (0–1 → 3⭐, 2–4 → 2⭐, 5–7 → 1⭐, 8+ → fail).
- **Solo base points** (10 / 8 / 5 / 0).
- **Solo timeout → 0 stars, 0 score.**
- **Solo replay-delta-only rule** (`scoreDelta = max(0, nextBest - prevBest)`,
  `totalSoloScore` derived from sum of `bestScore`).
- **Solo backfill idempotency** (`backfillSoloScores(...)` only writes
  missing score fields and recomputes `summary`; second run produces no
  delta).
- **Solo / Online persistence separation** (no code path writes
  `totalSoloScore` from online flow, no code path writes
  `online_progress.score` from solo flow).
- **Online +15 / −6 base values.**
- **Online checkpoint ladder** `[0,100,250,500,1000,1500,2000,3000]`.
- **Online checkpoint floor on loss** (clamps loss-only, never wins).
- **Online never below 0** (defensive `nextScore < 0 → 0`).
- **Online idempotency** (`lastMatchId` short-circuit in
  `applyOnlineMatchToCurrentUser`, plus Codex139 `OnlineMatchResult`
  durable per-user/lobby audit row).
- **Online authority model** (Option A — each client updates itself via
  `updateMe`).

### 8.2 Mismatches — fixed in Codex136

| Tag         | Severity        | Where                                                          | Fix applied                                                                                                                                                |
| ----------- | --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MISMATCH-S1 | minor           | `calculateSoloTimeBonus` (lib/soloProgressHelpers.js)          | Boundary changed to `elapsed <= 60 → +10`, `elapsed <= 90 → +5`. 60.0s now yields +10. 90.0s remains +5. 91+ remains +0.                                  |
| MISMATCH-O1 | **significant** | lib/onlineRanking.js + lib/applyOnlineResult.js                | Draw scoring REMOVED from active path: no `ONLINE_DRAW_POINTS`, no `ONLINE_RESULT.DRAW`, no `'draw'` branch awarding points, no `draws` counter. Passing `'draw'` returns a zero delta. Legacy `draws` field on existing rows is ignored, never re-emitted. |
| MISMATCH-O2 | minor           | `getOnlineWinnerTimeBonus`                                     | Missing/null/NaN/non-finite/negative duration now returns +0. Valid 0 still passes through the 0–60s tier. Winner +15 base still applied via `calculateOnlineMatchDelta`. |
| MISMATCH-O3 | naming          | lib/onlineRanking.js                                           | Doc-named aliases added as thin wrappers (no duplicated math): `calculateOnlineWinnerDelta`, `calculateOnlineLoserDelta`, `getOnlineCheckpoint`, `applyOnlineScoreWithCheckpoint`, `applyOnlineMatchResultOnce`. The pre-existing names remain exported for callers. |
| MISMATCH-O4 | minor           | `applyOnlineMatchToCurrentUser`                                | Returns structured result: `{ ok: true, ... }`, `{ ok: true, skipped: true, reason: 'already_applied' }`, `{ ok: false, error, retryable: true, where: 'auth'\|'persist' }`. `lastMatchId` is only persisted on a successful `updateMe`. `Game.jsx` resets `onlineResultAppliedRef` on retryable failure. |
| MISMATCH-O5 | minor           | `applyOnlineMatchResult` persistence shape                     | Writer now emits `lastMatchAt` (ISO string). `draws` field is no longer written. Legacy users with `draws` on disk are not crashed — the field is simply ignored.                                                              |

### 8.2.1 Codex139 DB/Data Model hardening

- `OnlineMatchResult` introduced as the durable idempotency/audit source for
  future Online scoring applications.
- `User.online_progress.lastMatchId` remains a recent-match guard and
  compatibility field.
- `getSoloLeaderboard` projection now uses the same 60/90 second Solo
  boundary as `calculateSoloTimeBonus`.
- Signed-in Solo localStorage mirrors are owner-scoped and cannot overwrite
  another signed-in user's server `User.solo_progress`.

### 8.3 Health Center cases delivered

New modular suite — `components/game/simulationPanelScoringContractCases.jsx`
(registered through `simulationPanelCaseRegistry.jsx`):

- `scoring_contract.solo_time_bonus_contract` (executable)
- `scoring_contract.online_score_no_draw_contract` (static + executable)
- `scoring_contract.online_score_time_bonus_missing_time_zero` (executable)
- `scoring_contract.online_score_base_applies_even_without_bonus_time` (executable)
- `scoring_contract.online_score_helper_naming_contract` (executable)
- `scoring_contract.online_score_persistence_field_matches_reader` (executable)
- `scoring_contract.online_score_authority_model_documented` (static)
- `scoring_contract.online_score_persistence_failure_retry_safe` (static)
- `scoring_contract.online_score_idempotency_does_not_block_first_apply` (static)

Existing `online_ranking` suite updated in place (no new file) to drop
the obsolete `draws` / `ONLINE_DRAW_POINTS` / `ONLINE_RESULT.DRAW`
expectations. All Solo executable cases in
`simulationPanelSoloProgressCases.jsx` continue to pass.

Codex139 adds `components/game/simulationPanelDataModelCases.jsx`
(registered through `simulationPanelCaseRegistry.jsx`) for:

- schema documentation alignment,
- Solo user-scoped localStorage mirrors,
- getSoloLeaderboard scoring boundary drift,
- OnlineMatchResult durable idempotency,
- cleanup/retention utilities,
- RLS runtime probe matrix.

### 8.4 Summary

1. **Code now matches the doc.** All six audited mismatches are fixed.
2. **No product logic outside of scoring was changed.** Drag/drop,
   Timeline, QuestionCard, GameLayout, invite/lobby/notification/
   tutorial, Solo progression, Leaderboard behavior — untouched.
3. **Backward compatibility:** existing `online_progress` objects with
   `draws` or `lastUpdatedAt` fields are still readable and do not
   crash. New writes omit `draws` and emit `lastMatchAt`.

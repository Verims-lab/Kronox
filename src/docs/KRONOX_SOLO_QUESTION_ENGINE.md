# Kronox Solo Question Selection Engine

> **Status:** Active product contract (Codex166).
> **Implementation:** `src/lib/soloQuestionEngine.js` (`buildSoloAttemptDeck`).
> **Consumer:** `src/pages/Game.jsx` Solo Level init effect.
> **Health suite:** `solo_question_engine_health`.

---

## 1. Purpose

Solo question selection is **controlled random**, not naive random.

Every Solo attempt opens with a **pre-computed deck of exactly 18
questions** that the engine produces once, at attempt start. Gameplay
then walks that deck sequentially. No live API call, no mid-attempt
re-randomization, no chance of running out of distinct years.

This document is the source of truth for the engine's rules. Any change
to the engine's behavior must update both the implementation _and_ this
document, and must keep the matching Health cases green.

---

## 2. Core rules

| Rule | Value |
|---|---|
| Attempt deck size | **18 questions** |
| Win condition | **10 correct placements** |
| Fail condition (mistakes) | **8 mistakes** |
| Fail condition (time) | **Solo level total timer expires** |
| Replay | **Creates a new attempt and a new deck** |

Player may not see all 18 questions (they win at 10 correct). Player
may also fail before seeing all 18 (8 mistakes or timeout). The deck
size of 18 = win target + max mistakes is intentional: gameplay is
guaranteed to have enough cards to reach either outcome.

---

## 3. Unique year rule (HARD)

Within a single 18-question deck:

* every question must have a usable `year` (integer)
* **the same year MUST NOT appear twice**

Reason: Kronox timeline ordering is year-based. If two cards share a
year, drop-zone hit-testing and "correct placement" validation become
ambiguous and unfair to the player.

If fewer than 18 distinct years are available in the active pool, the
engine returns a clean failure:

```
{ ok: false, reason: 'insufficient_unique_years',
  message: 'Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.' }
```

The Solo init effect surfaces this message via the existing `setError`
path — the level does **not** start.

Future note: if Kronox later adds month/day to `answer`, this rule
becomes "unique chronological key" instead of just year. Until then,
answer → year is the single uniqueness axis.

---

## 4. Active filtering

* **Active questions only.** `question.state === 'A'` is required when
  the field exists. Rows without `state` are accepted (legacy
  backward-compatibility) until the dataset migration completes.
* **Active categories only.** Caller passes
  `allowedMainCategoryIds` — a numeric whitelist of
  `Category.category_id` values where `Category.status === 'a'` (see
  `lib/categoryFilters.js`). Passive categories cannot enter the deck.
* Questions without a valid `main_category_id` are excluded when the
  caller enforces a strict whitelist.

The engine itself does NOT consult `Category.status`; that
responsibility stays in the data layer (Online lobby + future Solo
category picker), so the engine remains a pure function.

---

## 5. Category balance

When the caller supplies `N` active categories, the engine applies a
**soft cap** per category:

```
perCategoryCap = ceil(deckSize / max(1, N)) + 1
```

For the default 18-card deck and 6 active categories, that is 4 per
category. The cap is _soft_: if the pool is thin, the engine relaxes
the cap as part of the fallback ladder. The 18-card target and the
unique-year rule are **not** soft.

Target: at least 4 different active categories represented when the
pool allows it. This is a guidance value, not a hard contract — the
unique-year rule wins.

---

## 6. Recently-seen avoidance

If the caller supplies `recentlySeenQuestionIds` (e.g. from
`lib/questionHistory`), the engine prefers questions the user has not
recently seen. Recently-seen avoidance is relaxed in fallback tier 2
but never bypasses the unique-year rule.

Future-ready: when a `SoloQuestionHistory` entity exists, the caller
can pass that set instead of (or in addition to) the local recent
history. The engine signature stays unchanged.

---

## 7. Attempt deck as source of truth

* The deck is built **once**, in the Solo init effect inside
  `pages/Game.jsx`, the first time the level boots.
* `useGameActions.pickQuestion` (the live picker used during gameplay)
  is fed the deck as its `questionPool`. It removes cards already used
  in the attempt via `used_question_ids`, but it cannot pull from
  outside the deck.
* **No mid-attempt re-randomization.** Gameplay walks the deck only.
* The attempt also stores a runtime `soloAttemptId` so debugging /
  future telemetry can prove a fresh attempt produced a fresh deck.

When the player taps **Replay** or **Sonraki Seviye** in the Solo
result popup, both attempt state AND the deck are dropped — the Solo
init effect then runs the engine again with a fresh `attemptId`.

---

## 8. Fallback strategy

Engine tries selection in this order:

| Tier | Recently-seen | Category balance |
|---|---|---|
| 1 | Avoid | Enforce soft cap |
| 2 | Allow | Enforce soft cap |
| 3 | Allow | No cap |
| Fail | — | Clean failure |

The engine **never** relaxes:

* deck size 18
* unique question ids
* unique answer/years
* active question / active category gating

If all three tiers fail to produce a 18-unique-year deck, the engine
returns the clean `insufficient_unique_years` failure (see §3) and the
level refuses to start.

---

## 9. Determinism

The engine accepts an optional `random` function (any `() => number in
[0,1)`). When omitted, it uses `Math.random`. This lets future tests
or debug sessions reproduce a specific deck.

Suggested seed shape for future deterministic builds:

```
seed = user.email + level.levelNumber + attemptId
```

The current attempt id is generated as
`solo_{Date.now()}_{base36(random)}`, which guarantees replay → new
deck even without a deterministic seed.

---

## 10. Data model / persistence

Current implementation keeps the attempt deck in **runtime state**
inside `pages/Game.jsx`:

```
soloAttemptDeck : Question[] (length 18)
soloAttemptId   : string
```

There is **no `SoloLevelAttempt` entity yet**. The 18 ids live only
for the lifetime of the React state. This is a documented limitation;
when the project introduces `SoloLevelAttempt`, the engine signature
is already future-ready (caller passes `recentlySeenQuestionIds`, gets
back `attemptId` + `deck`).

Future preferred shape (NOT implemented yet):

```jsonc
// SoloLevelAttempt
{
  "user_email":       string,
  "level":            number,
  "question_ids":     number[],     // the 18 selected ids
  "started_at":       ISO-8601,
  "completed_at":     ISO-8601 | null,
  "status":           "in_progress" | "passed" | "failed",
  "correct_count":    number,
  "mistake_count":    number,
  "duration_seconds": number,
  "score":            number,
  "stars":            number
}

// SoloQuestionHistory (cross-attempt)
{
  "user_email":  string,
  "question_id": number,
  "level":       number,
  "attempt_id":  string,
  "shown_at":    ISO-8601,
  "result":      "correct" | "wrong"
}
```

---

## 11. Future extensions

* **Difficulty weighting** — use `question.difficulty` as a soft
  preference once the new dataset is fully tagged.
* **Tags / sub_category preference** — match the Solo player's
  recent picks.
* **Month/day chronological key** — when `answer` carries month/year,
  the unique-year rule becomes a unique YYYY-MM key.
* **Zone-/theme-based Solo map levels** — the engine accepts an
  `allowedMainCategoryIds` whitelist today, so theme-locked levels
  drop in with no engine change.

---

## 12. What this engine MUST NOT change

* Solo scoring values (`calculateSoloAttemptResult`,
  `calculateSoloStars`)
* Solo star rules / monotonic stars
* Solo result popup behavior
* Online scoring / Online deck (Online keeps its own filter in
  `functions/startLobbyGame`)
* Unified Kronox Puan (`getKronoxVisibleScore`)
* Diamond economy
* Drag/drop placement validation, timeline ordering
* Question/Category schema beyond reading `state` and
  `main_category_id`

Anything that would violate the above contracts is out of scope for
this engine.
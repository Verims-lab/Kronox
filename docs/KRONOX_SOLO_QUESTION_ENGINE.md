# Kronox Solo Question Selection Engine

Status: active product contract.

Implementation reference:

```text
src/lib/soloQuestionEngine.js
buildSoloAttemptDeck
```

Runtime consumer:

```text
src/pages/Game.jsx
```

Health suite:

```text
solo_question_engine_health
```

---

# 1. Purpose

Solo question selection is controlled random, not naive random.

The engine exists to create fair, replayable, level-based Solo attempts while preserving Kronox timeline clarity.

The engine must protect:

* question uniqueness
* year uniqueness
* active content filtering
* category eligibility
* no mid-game rerandomization
* predictable attempt behavior

---

# 2. Core Rules

Each Solo attempt creates exactly:

```text
18 questions
```

The player wins at:

```text
10 correct placements
```

The player fails at:

```text
8 mistakes
```

The player also fails when:

```text
120 second Solo level timer expires
```

Rules:

* the 18-question attempt deck must have 18 unique question IDs
* the 18-question attempt deck must have 18 unique years
* duplicate years are not allowed in a single attempt
* the deck is created once at attempt start
* no mid-game rerandomization is allowed
* replay creates a new attempt ID and a new deck
* the player may not see all 18 questions if they win earlier
* the player may fail before seeing all 18 questions if mistakes or time limit are reached

---

# 3. Unique Year Rule

Every selected question must have a unique runtime year.

Rule:

```text
18 questions = 18 different years
```

Reason:

Kronox timeline ordering is currently year-based. If two cards have the same year, ordering can become ambiguous or unfair.

This rule must not be relaxed during fallback.

If the system cannot find 18 valid questions with 18 unique years, the level must not start.

Clean error message:

```text
Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.
```

Future note:

If Kronox later supports month/day precision, this rule can become:

```text
unique chronological key
```

Until then, runtime year must be unique inside one Solo attempt.

---

# 4. Active Filtering

Solo uses only playable active content.

Required:

* `Question.state === "A"`
* active categories only
* passive categories excluded

Category rules:

```text
Category.status === "a" -> active
Category.status === "p" -> passive
```

Missing category status may be treated as active only as a backward-compatible seed/backfill fallback.

Seeded rows should carry explicit:

```text
status: "a"
```

---

# 5. Runtime Wiring

Expected runtime flow:

1. `getQuestions` authenticates the user.
2. `getQuestions` returns a minimal playable projection.
3. Returned questions are active playable rows.
4. Returned data includes or supports active `main_category_id` values.
5. `useOfflineQuestions` exposes playable questions and active category IDs.
6. `Game.jsx` passes active category whitelist into `buildSoloAttemptDeck`.
7. `buildSoloAttemptDeck` enforces active category whitelist before selecting the deck.

Expected engine option:

```text
allowedMainCategoryIds
```

Passive categories must be excluded by the real Solo start path, not only by a helper-unit test.

---

# 6. Attempt Deck Flow

At Solo attempt start:

1. Load candidate question pool.
2. Filter active/playable questions.
3. Filter active categories.
4. Validate question text.
5. Validate answer/year.
6. Normalize runtime year from `answer`.
7. Exclude invalid or missing years.
8. Enforce unique question IDs.
9. Enforce unique years.
10. Prefer not recently seen questions if available.
11. Apply soft category balance if possible.
12. Select exactly 18 questions.
13. Store/use this deck as the attempt source of truth.
14. Gameplay consumes the deck sequentially.

During gameplay:

```text
currentQuestion = attemptDeck[currentIndex]
```

After each answer:

```text
correct -> correctCount + 1
wrong -> mistakeCount + 1
```

If:

```text
correctCount === 10 -> success
mistakeCount >= 8 -> failure
time expires -> failure
```

If attempt is not finished, move to the next question in the deck.

The engine must ensure the player cannot run out of questions before reaching either 10 correct or 8 mistakes.

---

# 7. Fallback Strategy

The engine tries:

1. avoid recently seen questions and keep soft category balance
2. allow recently seen questions but keep soft category balance
3. allow recently seen questions and relax category balance
4. clean failure if 18 unique years are still impossible

Fallback may relax:

* recently seen avoidance
* soft category balance

Fallback must never relax:

* deck size 18
* unique question IDs
* unique years
* active question filtering
* active category filtering

Clean failure message:

```text
Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.
```

---

# 8. Category Balance

For an 18-question deck, the engine should target category variety when the pool allows it.

Soft target:

* at least 4 different active categories if possible
* avoid one category dominating the deck
* keep category distribution varied

Soft category balance may be relaxed if the pool is limited.

Category balance must not override:

* unique years
* active categories
* active questions
* exact 18 question deck size

---

# 9. Recently Seen / Repeat Avoidance

If user history or attempt history exists:

* prefer questions the user has not recently seen
* avoid repeating questions from recent Solo attempts when possible

This is a preference, not a hard requirement.

Hard requirements remain:

* 18 questions
* 18 unique question IDs
* 18 unique years
* active questions
* active categories

Future persistence may include:

```text
SoloLevelAttempt
SoloQuestionHistory
```

---

# 10. Data Boundary

The current `Question` entity stores:

```text
answer
```

not a legacy stored:

```text
year
```

The authenticated question fetch layer derives runtime year from `answer`.

Examples:

```text
2007 -> 2007
Ocak 2007 -> 2007
```

Runtime compatibility layer:

```text
src/lib/questionRuntimeAdapter.js
base44/functions/getQuestions/entry.ts
```

Do not remove the compatibility layer until Timeline/gameplay intentionally migrates to read `answer` directly.

---

# 11. Replay Behavior

Replay creates:

* a new attempt ID
* a new 18-question deck

Replay should not be forced to reuse the same deck.

Reason:

Kronox Solo should reduce memorization and keep replay attempts fresh.

Future option:

A separate “same deck retry” mode may be considered later, but it is not the current default contract.

---

# 12. Future Design Decisions

The following decisions are not final yet and should not be implemented silently:

## Level-Based Question Type

Open questions:

* Which levels ask which type of questions?
* Should early levels use easier/broader-year questions?
* Should later levels use harder/closer-year questions?
* How does difficulty 1–5 map to Solo level progression?

## Category / Subcategory Distribution

Open questions:

* How many categories should each level include?
* Should some levels be category-themed?
* Should subcategories be balanced?
* How should missing subcategory data be treated?

## Player Category Selection

Open questions:

* Should Solo ask the player to choose category or subcategory?
* Should this be mandatory or optional?
* Should default Solo remain fast, automatic, and mixed?
* Should “Category Focused Solo” become a separate future mode?

## Player Choice Impact

If player category selection is added later:

* deck generation must respect selected category filters
* fallback rules must remain clear
* 18 unique years must still be enforced
* insufficient pool must produce a clean error
* player selection must not silently produce invalid decks

Current product decision:

```text
Default Solo remains controlled mixed deck generation.
Player category/subcategory selection is not implemented yet.
```

---

# 13. Health Coverage Expectations

Health should cover:

```text
solo_attempt_deck_size_is_18
solo_attempt_requires_10_correct
solo_attempt_allows_max_8_mistakes
solo_attempt_deck_unique_question_ids
solo_attempt_deck_unique_years
solo_attempt_uses_active_categories_only
solo_attempt_uses_active_questions_only
solo_attempt_no_mid_game_rerandomization
solo_replay_creates_new_attempt_deck
solo_question_engine_fallback_never_relaxes_unique_year
solo_question_engine_clean_error_when_insufficient_unique_years
solo_question_engine_runtime_wires_active_category_whitelist
solo_question_engine_doc_exists
```

Rules:

* Do not only test the helper in isolation.
* Runtime wiring must be covered.
* Manual/runtime proof may remain NOT_AUTOMATABLE when needed.
* Do not fake PASS.

---

# 14. Do Not Move Into This Engine

Do not move the following into the Solo question engine:

* Online scoring
* Solo scoring
* Diamond economy
* drag/drop
* Timeline
* QuestionCard
* GameLayout
* multiplayer sync
* leaderboard logic

The engine selects Solo attempt decks. It should not become a general gameplay controller.

# Kronox Solo Question Selection Engine

Status: active product contract.  
Implementation: `src/lib/soloQuestionEngine.js` (`buildSoloAttemptDeck`).  
Runtime consumer: `src/pages/Game.jsx` Solo Level init effect.  
Health suite: `solo_question_engine_health`.

## Core Rules

- Each Solo attempt creates exactly **18 questions**.
- The player wins at **10 correct placements**.
- The player fails at **8 mistakes** or when the **120 second** Solo level timer expires.
- The 18-question attempt deck must have **18 unique question IDs**.
- The 18-question attempt deck must have **18 unique years**.
- Duplicate years are not allowed in a single attempt.
- The deck is created once at attempt start.
- No mid-game rerandomization is allowed.
- Replay creates a new attempt ID and a new deck.

## Active Filtering

Solo uses only playable active content:

- `Question.state === "A"` is required by the authenticated question fetch path.
- `Category.status === "a"` categories are active.
- `Category.status === "p"` categories are passive and must not enter a Solo deck.
- Missing category status can be treated as active only as a backward-compatible seed/backfill fallback.

Runtime wiring:

1. `base44/functions/getQuestions/entry.ts` authenticates the user and returns a minimal playable projection.
2. The projection includes active `main_category_id` values.
3. `src/hooks/useOfflineQuestions.js` exposes `activeCategoryIds`.
4. `src/pages/Game.jsx` passes `allowedMainCategoryIds: activeCategoryIds` to `buildSoloAttemptDeck`.
5. The engine enforces the whitelist before selecting the 18-card deck.

This means passive categories are excluded by the real Solo start path, not only by a helper-unit test.

## Fallback Strategy

The engine tries:

1. Avoid recently seen questions and keep soft category balance.
2. Allow recently seen questions but keep soft category balance.
3. Allow recently seen questions and relax category balance.
4. Clean failure if 18 unique years are still impossible.

The fallback never relaxes:

- deck size 18,
- unique question IDs,
- unique years,
- active question filtering,
- active category filtering.

Clean failure message:

```text
Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.
```

## Data Boundary

The current `Question` entity stores `answer`, not a legacy `year` field. The authenticated question fetch layer derives the runtime `year` from `answer` and returns only the minimal fields needed for gameplay.

Do not move Online scoring, Solo scoring, Diamond economy, drag/drop, Timeline, QuestionCard, or GameLayout logic into this engine.

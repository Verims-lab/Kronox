# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

This document describes the Solo question-selection rules used by `src/lib/soloQuestionEngine.js` and the Solo runtime in `src/pages/Game.jsx`. These rules apply only to new attempts after the Solo v2 rules update. Old completed Solo results are not retroactively recalculated or rewritten.

## Core Attempt Rules

Normal Solo levels:
- end successfully at 7 correct cards
- use a 16-question attempt deck
- use the 180 seconds timer
- fail when the timer reaches 180 seconds before completion
- fail on the 10th mistake

Special Solo levels:
- start at level 10 and repeat every 5 levels: 10, 15, 20, 25, ...
- end successfully at 10 correct cards
- use a 19-question attempt deck
- use the 180 seconds timer unless a future explicit config changes it
- fail on the 10th mistake

Deck size formula:
- `deckSize = correctTarget + maxNonFailingMistakes`
- normal: `7 + 9 = 16 questions`
- special: `10 + 9 = 19 questions`

## Hard Deck Rules

The full attempt deck is built before gameplay starts. Gameplay consumes that prebuilt deck in order. There is no live question fetch, no per-card randomization, and no mid-attempt re-randomization.

Every valid deck must satisfy:
- required deck size: 16 questions for normal levels, 19 questions for special levels
- unique question IDs
- unique years across the full deck
- active questions only
- active categories only
- passive categories excluded
- first 5 ordered questions have answer years at least 5 years apart

The first 5 spacing rule means every pair among the first 5 ordered answer years must differ by at least 5. Example allowed: 1990 and 1995. Example not allowed: 1990 and 1994.

## Balance Rules

The engine should distribute questions across categories and subcategories as evenly as the available pool allows. It should also prefer an era/year spread so the deck is not mainly newest questions, mainly oldest questions, or clustered in one narrow historical period.

These are soft balance preferences:
- category balance
- subcategory balance
- era/year distribution
- recently-seen avoidance

Fallback order:
1. active questions/categories, unique years, first 5 minimum 5-year spacing, category/subcategory balance, era spread, not recently seen
2. relax recently-seen avoidance
3. relax category/subcategory balance
4. relax era distribution
5. fail cleanly if a valid deck still cannot be created

Never relax:
- required deck size
- unique question IDs
- unique years
- active question filtering
- active category filtering
- first 5 minimum 5-year spacing, unless no valid spaced deck exists at all

If no valid deck can be created, the level must not start. The UI should show a clean user-facing error instead of starting an invalid attempt.

## Runtime Wiring

The Solo start path passes the active category whitelist into `buildSoloAttemptDeck`. The engine enforces active-category filtering on the actual runtime deck, not only in UI.

Replay and next-level actions clear the current attempt deck and create a new deck. Replay after this change uses the new Solo v2 rules.

## Placement Assist

The subtle placement hint remains visual-only for levels 1-3:
- active only while dragging a Solo card
- highlights the already-computed correct placement zone
- disappears after placement or drag end
- no score penalty
- no hit-testing, drag behavior, or validation changes
- disabled for level 4+ and Online mode

## Backward Compatibility

Do not recalculate old completed Solo results. Do not rewrite old stored `bestScore`, `bestStars`, or `bestTimeSeconds`. New attempts can record `soloRulesVersion: 2` so future audits can distinguish Solo v2 results from legacy stored results.

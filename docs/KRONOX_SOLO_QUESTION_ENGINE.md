# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

This document describes the Solo question-selection rules used by `src/lib/soloQuestionEngine.js` and the Solo runtime in `src/pages/Game.jsx`. These rules apply only to new attempts after the Solo v2 rules update. Old completed Solo results are not retroactively recalculated or rewritten.

## Core Attempt Rules

Normal Solo levels:
- end successfully at 7 correct timeline cards, including seed cards already on the timeline
- use a 16-question deck
- use the 180 seconds timer
- fail when the timer reaches 180 seconds before completion
- fail on 10 mistakes; the 10th mistake ends the attempt

Special Solo levels:
- start at level 10 and repeat every 5 levels: 10, 15, 20, 25, ...
- end successfully at 10 correct timeline cards, including seed cards already on the timeline
- use a 19-question deck
- use the 180 seconds timer unless a future explicit config changes it
- fail on 10 mistakes; the 10th mistake ends the attempt

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
- first 5 ordered questions must satisfy minimum 5-year spacing between answer years

The first 5 ordered questions spacing rule means every pair among the first 5 ordered answer years must differ by at least 5. Example allowed: 1990 and 1995. Example not allowed: 1990 and 1994.

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

## Solo Jokers v1

Solo jokers are first-version, attempt-local helpers:
- Solo-only; Online mode has no joker UI or joker effects
- every new Solo level attempt starts with 3 options: `Hata Affı`, `Kart Değiştir`, `Zaman Dondur`
- only 1 joker total may be used per attempt
- after one joker is used, the other two stay visible but disabled/passive
- jokers are free in v1; there is no inventory, earning, spending, shop, ad, or Diamond cost
- jokers do not directly grant Kronox Puan and do not change Solo scoring values

Joker behavior:
- `Hata Affı`: activates one-time protection. The next wrong placement does not count as a mistake; correct placements do not consume it.
- `Kart Değiştir`: replaces the current active card using the already prepared Solo attempt deck. It must not fetch a new question, rebuild the deck, or rerandomize the attempt mid-game.
- `Zaman Dondur`: freezes the Solo level timer for 10 seconds. It does not add score, add extra time, or alter timeout rules beyond pausing the elapsed timer during the freeze window.

## Backward Compatibility

Do not recalculate old completed Solo results. Do not rewrite old stored `bestScore`, `bestStars`, or `bestTimeSeconds`. New attempts can record `soloRulesVersion: 2` so future audits can distinguish Solo v2 results from legacy stored results.

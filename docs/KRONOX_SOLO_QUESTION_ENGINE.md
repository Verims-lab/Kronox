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

The first active player question card shown to the user must be `soloAttemptDeck[0]`, the second must be `soloAttemptDeck[1]`, and so on unless an explicit deck-safe joker replacement is used. Seed/preplaced timeline cards are not counted as the first 5 active player question cards unless they are actual player question cards.

Seed/preplaced timeline cards are still part of the early visible gameplay context. The deck order must choose them so they do not create obvious close-year conflicts with the first 5 active player question cards.

Normal Solo also uses a visible timeline spacing guardrail during runtime. Before the next active card is shown, the ordered deck picker prefers an unused prebuilt-deck card whose answer year is at least 5 years away from already visible timeline years, including placed cards and seed/preplaced cards. This avoids player-facing 1-4 year conflicts such as 1996/1997, 1998/1999, and 1913/1914 where a safe alternative exists. If no safe candidate remains, the runtime may choose the least-bad valid deck candidate instead of fetching or randomizing a new question.

Every valid deck must satisfy:
- required deck size: 16 questions for normal levels, 19 questions for special levels
- unique question IDs
- unique years across the full deck
- active questions only
- active categories only
- passive categories excluded
- first 5 ordered active player question cards must satisfy minimum 5-year spacing between answer years
- missing, null, undefined, empty, approximate, or non-numeric years are invalid

The first 5 ordered questions spacing rule means every pair among the first 5 displayed active-player answer years must differ by at least 5. The exact runtime target is the first 5 ordered active player question cards. Example allowed: 1990 and 1995. Example not allowed: 1990 and 1994.

## Balance Rules

The engine should distribute questions across categories and subcategories as evenly as the available pool allows. It should also prefer an era/year spread so the deck is not mainly newest questions, mainly oldest questions, or clustered in one narrow historical period.

These are soft balance preferences:
- category balance
- subcategory balance
- tag/theme balance, including sports-like theme clustering
- era/year distribution
- recently-seen avoidance
- exposure cooldown / rotation: prefer never-shown, less-shown, and
  not-recently-shown questions when local or projected stats are available
- user Category preferences: when at least 3 active valid
  `UserCategoryPreference` rows are available before the attempt starts, Solo
  question selection targets 70% selected user categories and 30% full eligible
  pool. The selected-category 70% lane keeps the current selection behavior.
  The global 30% lane prefers `difficulty = 1` questions from the full
  eligible pool where possible. This is a soft target with fallback, not a
  hard filter.

P1/P2 balancing applies during deck selection and deck ordering where the pool allows:
- normal and special decks distribute across active categories so one category does not dominate a rich pool
- exposure weighting is soft only: high/recent shown questions are downweighted,
  never/low-shown questions are preferred, and deck build must not fail solely
  because exposure stats are missing, stale, or concentrated
- category, subcategory, theme, and year-band balance are pool-proportional,
  not equal-count. A group that is large in the eligible pool may stay large in
  a deck, while smaller valid groups receive gentle protection from accidental
  starvation where deck size and hard rules allow.
- normal 16-card Solo decks target 11 selected-category cards and 5 global-pool
  cards; special 19-card decks target 13 selected-category cards and 6
  global-pool cards. Global-pool cards prefer difficulty 1 when enough usable
  candidates exist; if the difficulty-1 global pool is too small, the broader
  full eligible pool fills safely. If selected categories cannot supply enough
  valid questions, the full eligible pool fills the gap.
- first 7 active displayed cards avoid 4+ same-category cards where alternatives exist
- first 5 active displayed cards avoid 3+ same-subcategory or obvious sports-cluster cards where metadata and alternatives allow
- first 7 active displayed cards avoid 4+ same-subcategory/theme cards where alternatives exist
- ordering avoids same category, subcategory, sports/theme, or decade back-to-back where alternatives exist
- decade/era spread is preferred so the deck does not cluster around one narrow historical period

The engine exposes safe diagnostics for Health/admin/debug only: eligible-pool and selected-deck category distribution, subcategory distribution, theme/sports distribution, decade/year-band distribution, first-5/first-7 distributions, max consecutive cluster counts, pool-proportional targets, and fallback tier. These diagnostics must not be shown to normal players or used to expose the protected question bank publicly.

The runtime may pass local recent-history exposure stats into the deck builder
before the attempt starts. This is not a gameplay source of truth and must not
fetch questions or stats mid-attempt. Corrupt or missing local history is ignored
safely.

The runtime may also pass active valid current-user Category preference IDs
into the deck builder before the attempt starts. Missing, corrupt, passive, or
unavailable preferences fall back to global Solo selection. Online question
selection is not affected.

P2 adds a helper-only quality layer on top of these rules:
- deck diagnostics include level number, level type, deck size, correct target, fail threshold, question IDs, answer years, first 5 years, minimum first-5 gap, visible-spacing conflict count, category/subcategory/theme/decade/difficulty distributions, fallback tier, balance score, and warnings
- question pool health can warn about sparse categories, sparse subcategories, overrepresented buckets, invalid years, missing sub_category/tag/difficulty metadata, insufficient unique years, and limited 16/19 deck readiness
- pool-health warnings do not block gameplay by themselves; hard deck failures still block the level cleanly
- difficulty progression is readiness-oriented only. Missing difficulty data falls back safely to easy behavior, and special-level strategy can differ without forcing unavailable difficulty levels
- replay variety diagnostics can flag exact repeated early sequences where alternatives exist, but replay variety remains a soft preference
- Kart Değiştir diagnostics can report swapped-out card, replacement card, replacement source, visible-spacing preservation, balance impact, and no-safe-replacement state
- all P2 diagnostics are admin/Health/helper-only and must not be exposed to normal gameplay UI

P3 adds question analytics without changing question selection:
- Solo runtime writes best-effort `QuestionAttemptEvent` rows for shown cards,
  answered placements, `Kart Değiştir` swapped-out cards, and replacement
  cards.
- analytics writes must never block drag/drop, placement validation, scoring,
  result popups, or deck progression.
- events are private/admin analytics data and must not expose a public full
  question bank.
- manual admin email reports can summarize question exposure and outcomes; no
  scheduled report exists in this version.
- `QuestionStatsProjection` refresh remains an admin/manual aggregate path and
  is not updated synchronously during gameplay.
- Health guardrails must detect projection narrowing, repeated-deck low
  unique coverage, high/recent exposure reuse, category/subcategory/year-band
  concentration, and active-pool versus runtime-projection mismatch.
- Health/reporting guardrails compare selected/shown distribution to the
  eligible pool proportionally. They must not require equal category,
  subcategory, or era counts.
- Runtime exposure improvement is proven over new gameplay events; historical
  analytics reports can remain concentrated until enough fresh events exist.

Fallback order:
1. active questions/categories, unique years, first 5 minimum 5-year spacing, category/subcategory balance, era spread, not recently seen
2. relax recently-seen avoidance
3. relax category/subcategory/theme/era balance
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

The Solo start path also loads current-user active valid Category preferences
before the deck is built and passes them as a soft 70/30 weighting input. This
must not fetch questions mid-attempt, and it must not hard-filter the deck to
only selected categories.

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
- every new Solo level attempt starts with 3 options: `Kronokalkan`, `Kart Değiştir`, `Zaman Dondur`
- only 1 joker total may be used per attempt
- after one joker is used, the other two stay visible but disabled/passive
- jokers are free in v1; there is no inventory, earning, spending, shop, ad, or Diamond cost
- jokers do not grant Kronox Puan directly and do not change Solo scoring values

Joker behavior:
- `Kronokalkan`: activates one-time protection. The next wrong placement does not count as a mistake; correct placements do not consume it.
- `Kart Değiştir`: replaces the current active card using the already prepared Solo attempt deck/reserve. It must not fetch a new question, rebuild the deck, or rerandomize the attempt mid-game, and the swapped-out card should not reappear later in the same attempt while unused deck cards are available. Replacement must respect visible timeline spacing and prefers a balanced reserve card that does not worsen category/subcategory/theme repetition. If no safe replacement exists, the joker is not consumed and the player sees `Bu kart şu anda değiştirilemiyor.`
- `Zaman Dondur`: freezes the Solo level timer for 10 seconds. It does not add score, add extra time, or alter timeout rules beyond pausing the elapsed timer during the freeze window.

## Backward Compatibility

Do not recalculate old completed Solo results. Do not rewrite old stored `bestScore`, `bestStars`, or `bestTimeSeconds`. New attempts can record `soloRulesVersion: 2` so future audits can distinguish Solo v2 results from legacy stored results.

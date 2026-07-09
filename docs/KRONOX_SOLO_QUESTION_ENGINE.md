# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

This document describes the Solo question-selection rules used by `src/lib/soloQuestionEngine.js` and the Solo runtime in `src/pages/Game.jsx`. These rules apply only to new attempts after the Solo v3 move-based rules update. Old completed Solo results are not retroactively recalculated or rewritten.

## Core Attempt Rules

Normal Solo levels:
- end successfully at 7 correct timeline cards, including seed cards already on the timeline
- start with 2 timeline anchor cards
- use a 10 evaluated move limit
- use an internal 18-question deck buffer for anchors, playable moves, and joker reserve
- use the 180 seconds timer
- fail when the timer reaches 180 seconds before completion
- fail when 10 evaluated moves are used and the 7-card target has not been reached

Special Solo levels:
- start at level 10 after onboarding and repeat every 5 levels: 10, 15, 20, ...
- end successfully at 10 correct timeline cards, including seed cards already on the timeline
- use a 13 evaluated move limit, giving a 3-move mistake buffer without changing scoring
- use an internal 21-question deck buffer for the special target lane
- use the 180 seconds timer unless a future explicit config changes it
- fail when 13 evaluated moves are used and the 10-card target has not been reached

Internal deck buffer formula:
- `deckSize = initialTimelineCards + maxEvaluatedMoves + cardSwapBuffer + kronokalkanBuffer`
- before_after onboarding: `1 reference + 10 attempt cards + 3 + 3 = 17 questions`
- timeline_basic onboarding: `2 references + 10 attempt cards + 3 + 3 = 18 questions`
- normal: `2 + 10 + 3 + 3 = 18 questions`
- special: `2 + 13 + 3 + 3 = 21 questions`
- Deck sizing is 2 anchors + 10 playable moves + Kart Değiştir buffer + Kronokalkan buffer for normal levels.
- Zamanı Dondur does not require a card buffer
- Kart Değiştir uses the card-swap buffer and does not consume a move
- Kronokalkan uses the shield buffer and protects one wrong valid placement from consuming a move
- If a user owns more jokers than the per-attempt buffer, extra Kart Değiştir/Kronokalkan attempts fail safely before spend; no raw client question list or full-bank fallback is used.

## Solo Onboarding Level Types

Levels 1-6 are real Solo scoring levels, not scoreless tutorials. They use the
existing Solo progress, star, Kronox Puan, replay/best-score, and leaderboard
projection pipeline, but their timeline layout is simplified:

- levels 1-3 use `level_type = before_after`
- levels 4-6 use `level_type = timeline_basic`
- level 7 returns to the existing normal timeline type
- special levels resume at level 10 and then every 5 levels

`before_after` uses one fixed reference event card and two labeled slots:
`ÖNCESİ` and `SONRASI`. Ten attempt question cards are prepared so the player
can make mistakes, while the progress target remains 6 correct placements.
Answer cards are consumed after each answer and are not added to the persistent
timeline.

`timeline_basic` uses two fixed reference event cards sorted by year and three
labeled slots: `ÖNCESİ`, `ARASI`, and `SONRASI`. Ten attempt question cards are
prepared so the player can make mistakes, while the progress target remains 6
correct placements. Answer cards are consumed after each answer and are not
added to the persistent timeline.

Onboarding levels use 10 evaluated moves, complete after 6 correct/progress
placements unless the level fails first, and keep the existing Solo scoring
thresholds.
Joker and Hint controls remain visible in levels 1-6, but they run in training
mode: no `spendUserJoker`, no `consumeUserHint`, no `JokerTransaction` or
`HintTransaction` spend row, no real inventory decrement, and no Daily Calendar
joker/hint task progress. Level 7 and later use normal inventory-consuming
Joker/Hint behavior.

Level-start tutorial popups appear every time levels 1, 2, 3, 4, and 7 start.
Levels 5, 6, and 8+ do not show this popup. Level 1 uses the local
`/assets/tutorials/Seviye1tutorial.mp4` asset in the existing video slot, with
title `Önce mi, Sonra mı` and subtitle `Kartı doğru tarafa sürükle` (no final
period). Other tutorial popup levels keep their existing copy/video config. The
popup has a safe video/config slot, no remote dependency, an X close button, and
pauses the effective Solo timer until closed. It must not consume questions,
inventory, score, or Daily progress.

Onboarding analytics are best-effort/local and privacy-safe. Events may record
level number, level type, slot type, correctness, elapsed seconds, first-drag
timing, completion/failure, and tutorial close/skip. They must not include
email, provider ID, owner_key, raw guest_id, internal player_key, unsafe Base44
IDs, secrets, full question-bank payloads, or answer-year exports.

## Question Loading Bootstrap

Game entry first attempts an online `getQuestions` fetch whenever the browser
is online or network state is unknown. The default signed-in gameplay response
is an authenticated bounded server attempt candidate buffer; first-time guest
Solo uses only the explicit capped `guest_gameplay_runtime` minimal projection.
Admin/full-bank diagnostics still require AdminUser authorization. Empty
local question cache is not an offline condition by itself. While the first
fetch is pending, the user sees the shared visual-only Kronox hourglass
preparation screen. This screen is only a loading visual replacement: it must
not add artificial wait, minimum display duration, or block gameplay start once
the deck is ready. The old spinner/text/back-button preparation screen is not
used for normal question preparation.

The offline/no-cache screen is reserved for known offline state, a failed online
fetch, and no usable local cache. Online data failures use a question-load retry
message instead of `İnternet bağlantısı yok`. `Tekrar Dene` clears the
transient error and re-fetches online before using cache fallback.

Question-set replacements invalidate old local question cache through a cache
version. Stale or deleted cached question IDs must not block a fresh DB fetch or
crash deck creation. Direct `/game` access without Solo launch state is handled
as missing game state and sends the user back to Home/Solo entry instead of
showing a false offline screen.

## Hard Deck Rules

The full attempt deck is built before gameplay starts. Gameplay consumes that prebuilt deck in order. There is no live question fetch, no per-card randomization, and no mid-attempt re-randomization.

The first active player question card shown to the user must be `soloAttemptDeck[0]`, the second must be `soloAttemptDeck[1]`, and so on unless an explicit deck-safe joker replacement is used. Seed/preplaced timeline cards are not counted as the first 5 active player question cards unless they are actual player question cards.

Seed/preplaced timeline cards are still part of the early visible gameplay context. The deck order must choose them so they do not create obvious close-year conflicts with the first 5 active player question cards.

Normal Solo also uses a visible timeline spacing guardrail during runtime. Before the next active card is shown, the ordered deck picker prefers an unused prebuilt-deck card whose answer year is at least 5 years away from already visible timeline years, including placed cards and seed/preplaced cards. This avoids player-facing 1-4 year conflicts such as 1996/1997, 1998/1999, and 1913/1914 where a safe alternative exists. If no safe candidate remains, the runtime may choose the least-bad valid deck candidate instead of fetching or randomizing a new question.

Every valid deck must satisfy:
- required deck size: 17 questions for before_after onboarding, 18 questions for timeline_basic onboarding, 18 questions for normal levels, 21 questions for special levels
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
  pool. The selected-category 70% lane uses selected user categories with
  `difficulty = 1` and `difficulty = 2` eligible. The global 30% lane uses all
  active categories with `difficulty = 1` only. This is a soft target with
  fallback, not a hard filter.
- live category ids are normalized from `Category.category_id` as any positive
  id; runtime must not clamp Solo to the original seed IDs or to categories
  1-6.

P1/P2 balancing applies during deck selection and deck ordering where the pool allows:
- normal and special decks distribute across active categories so one category does not dominate a rich pool
- exposure weighting is soft only: high/recent shown questions are downweighted,
  never/low-shown questions are preferred, and deck build must not fail solely
  because exposure stats are missing, stale, or concentrated
- when the candidate pool is nearly all recent, Health must use explicit
  scarcity metadata instead of demanding an impossible ratio drop. The deck is
  acceptable only if selected recent cards are at the computed minimum plus
  small tolerance and selected average shown count does not exceed the candidate
  pool average. Non-scarce pools still require meaningful recent-ratio
  improvement.
- category, subcategory, theme, and year-band balance are pool-proportional,
  not equal-count. A group that is large in the eligible pool may stay large in
  a deck, while smaller valid groups receive gentle protection from accidental
  starvation where deck size and hard rules allow.
- normal 18-card Solo decks target 13 selected-category cards and 5 global-pool
  cards; special 21-card decks target 15 selected-category cards and 6
  global-pool cards. Selected-category cards are eligible only at difficulty 1
  or 2. Global-pool cards first use difficulty 1 from all active categories.
  If selected categories or global difficulty-1 candidates cannot supply enough
  valid cards/unique years, the broader active global pool fills safely before
  the deck clean-fails.
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

Exposure diagnostics expose `candidateNonRecentHistoryCount`,
`minimumRecentHistoryNeeded`, `selectedRecentHistoryOverMinimum`,
`recentHistoryScarcity`, and `recentHistoryScarcityReason` for Health/admin
only. These fields explain fallback states such as
`candidate_pool_nearly_all_recent` or `non_recent_alternatives_below_deck_size`
without changing the soft-cooldown behavior.

The runtime may also pass active valid current-user Category preference IDs
into the deck builder before the attempt starts. Category preferences are
optional for Solo question selection: signed-in users with no
saved preferences, empty preferences, or fewer than 3 active valid preferences
use all active categories. Missing authentication uses the explicit capped guest
Solo projection and must not expose raw questions. Missing, corrupt, passive, empty, or
unavailable preferences fall back to global Solo selection and must not become
an empty question pool or offline/no-cache error. Saved preferences only become
a soft 70/30 weighting input when at least 3 active valid preferences exist.
Online question selection is not affected.

Online game start remains a separate path. `startLobbyGame` creates one
authoritative bounded `online_question_deck` from the lobby's selected active
categories only; all participants read that same persisted deck/order from the
Lobby row. Online does not call the Solo `getQuestions`/guest path, does not
use user Category preferences or 70/30 weighting, and accepts only difficulty
1 and difficulty 2 questions for the current Online phase. The game route must
not become playable until the Lobby has both `current_question_id` and a
readable shared Online deck.

`Game.jsx` must explicitly resolve `getValidActiveSelectedCategoryIds(preferences,
activeCategories)` in the Solo-only path so stale, passive, or invalid
preference rows are filtered against active Categories before the deck builder
receives any selected IDs. This helper is not used by Online category selection
or by `/getQuestions`.

P2 adds a helper-only quality layer on top of these rules:
- deck diagnostics include level number, level type, deck size, correct target, fail threshold, question IDs, answer years, first 5 years, minimum first-5 gap, visible-spacing conflict count, category/subcategory/theme/decade/difficulty distributions, fallback tier, balance score, and warnings
- question pool health can warn about sparse categories, sparse subcategories, overrepresented buckets, invalid years, missing sub_category/tag/difficulty metadata, insufficient unique years, and limited 18/21 deck readiness
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
- manual admin email reports currently send the full `nine-section-email-v1`
  report inside the email body, with no PDF attachment requirement. The report
  uses exactly 9 table/card sections, including category pool, category
  preference, category exposure, top/underused/wrong question, joker, and
  play-rhythm views. This report informs future tuning but does not change
  runtime question selection by itself; no scheduled report exists in this
  version.
- report wording must keep active pool, Solo-eligible pool, and Runtime
  Projection diagnostics separate. Runtime Projection is diagnostic/admin proof
  only, is based on `getQuestions diagnostics`, and must not be faked by the
  email builder when the report does not call live projection.
- top-shown category/subcategory concentration is a guardrail only:
  high concentration is not automatically unfair because the distribution must
  be compared with the Solo-eligible pool first.
- Runtime `/getQuestions` category projection must be driven by active
  `Category` rows, not a stale hardcoded seed-category list. Category read
  failure must produce an empty/retryable state instead of falling back to old
  seeded category IDs; normal runtime must not hardcode active categories 7+
  out of the Solo-eligible pool.
- Codex329 fix: `/getQuestions`, Category helpers, and preference helpers
  accept active status aliases (`a`, `active`, `aktif`, plus missing status for
  backward compatibility), fetch candidates per active category before
  pool-proportional server attempt buffers, and expose admin/debug diagnostics
  showing that source eligibility is not capped before category balancing. The
  local question cache version is `question-runtime-v10-solo-architecture`
  so stale broad projections and old difficulty-lane buffers are invalidated.
- Codex338 fix: gameplay fetches now request the v2 per-category projection
  explicitly instead of relying on an empty default payload. `/getQuestions`
  reads all active Category rows, fetches Question rows per active category
  across numeric/string `main_category_id` and `category_id` variants, and only
  applies the bounded response cap after category coverage is known. If
  categories 7,8,9,11 lack active Category rows in live data, that remains a
  data/category seeding blocker rather than a deck-builder issue.
- Codex340/Codex372/Codex373 fix: `/getQuestions` now has an explicit Base44 function
  manifest, v2 gameplay requests return small server-side attempt buffers,
  safe `projectionDiagnostics` require admin/debug context, stale Category
  fallback IDs are forbidden even when the `Category` read fails, and `Question`
  category-id schema fields are no longer capped to the original 1-6 seed set.
  Runtime proof should show `projectionVersion: per_category_projection_v2`,
  `projectionCappedBeforeCategoryCoverage: false`, all active Category IDs in
  `activeCategoryIdsFromGetQuestions`, and explicit zero-playable reasons when
  an active category has no playable questions.
- Codex417 proof marker: `/getQuestions` now returns backend-only
  `getQuestionsRuntimeMarker` / diagnostics `runtimeMarker`
  `getQuestions-live-per-category-v8-Codex417`. If this marker is absent
  from Solo debug JSON after deployment, the frontend is invoking stale or
  different deployed function code.
- Codex417 fetch bound: authenticated gameplay candidate reads use
  `QUESTION_FETCH_PER_CATEGORY_LIMIT =
  MAX_AUTH_GAMEPLAY_RESPONSE_LIMIT * AUTH_GAMEPLAY_CANDIDATE_FETCH_MULTIPLIER`
  (`96 * 3 = 288`) per active category/query variant before the bounded
  attempt response is selected. This keeps enough buffer for anchors, 10
  evaluated moves, Kart Değiştir/Kronokalkan replacement pressure, soft
  category weighting, and exposure-aware rotation without reading thousands of
  rows per category.
- Codex330 fix: the global 30% difficulty-1 candidate diagnostics/scorer use
  the full eligible Solo pool, not only the non-selected category subset.
  The separate selected-vs-non-selected 70/30 pressure remains soft and
  pool-proportional; this does not force equal category counts.
- Codex333 diagnostic: the broken production Admin Ekranı diagnostic button
  was removed. The requested-account/preference-user Solo query audit is now run directly
  with `scripts/diagnoseSoloQuestionStartQuery.mjs` or the optional admin-only
  `diagnoseSoloQuestionStartQuery` backend function after deployment. The
  direct runner requires live Base44 service-role credentials and the same
  app-specific `BASE44_APP_BASE_URL` / `VITE_BASE44_APP_BASE_URL` used by the
  deployed frontend; Node must not default to the generic `base44.app` host.
  A specific account is supplied through `SOLO_DIAGNOSTIC_REQUESTED_EMAIL` or
  admin request payload, never as a committed literal. Output masks all email
  addresses generically.
  It captures the fresh `getQuestions`-compatible per-category
  `Question.filter` query descriptor, active/Solo-eligible/difficulty-1 counts
  by category, cache key/version notes, actual frontend `buildSoloAttemptDeck`
  dry-run output, and current active category presence/removal reasons. Focused
  manual probes may supply `SOLO_DIAGNOSTIC_CATEGORY_IDS` or
  `diagnosticCategoryIds`, but historical category IDs are not runtime policy.
  It must not write gameplay, progress, analytics, or economy rows.
- Codex334 diagnostic connectivity: `scripts/diagnoseSoloQuestionStartQuery.mjs`
  reports `missing_base44_app_config` when app URL/service credentials are not
  supplied and `token_app_mismatch_or_wrong_app_id` when Base44 returns
  "App not found". It prints a safe config summary with app id/base URL/token
  presence booleans only, never token values. The backend-function transport is
  available with `BASE44_DIAGNOSTIC_MODE=backend-function` plus an admin access
  token after the backend function is deployed.
- `QuestionStatsProjection` and `CategoryStatsProjection` refresh remains an
  admin/manual `aggregateQuestionStats` path, defaults to dry-run unless
  explicitly run for write, and is not updated synchronously during gameplay.
  The current 9-section Question Analytics email report reads
  `QuestionAttemptEvent` directly, so empty projection tables are not by
  themselves a report bug.
- Health guardrails must detect projection narrowing, repeated-deck low
  unique coverage, high/recent exposure reuse, category/subcategory/year-band
  concentration, and active-pool versus runtime-projection mismatch.
- Health/reporting guardrails compare selected/shown distribution to the
  eligible pool proportionally. They must not require equal category,
  subcategory, or era counts.
- Health exposure cooldown guardrails must keep normal-pool ratio improvement
  strict, while allowing scarcity-aware proof only when the diagnostic metadata
  shows too few non-recent alternatives for a full deck.
- Runtime exposure improvement is proven over new gameplay events; historical
  analytics reports can remain concentrated until enough fresh events exist.
- Per-player exposure projections are active for Solo freshness. Selection
  prefers questions never shown to the same player in the same mode, then lower
  per-player `shown_count`, then older per-player `last_shown_at`. Global
  exposure remains a secondary tie-breaker only. Low-correct/high-latency
  questions are still reported for review rather than automatically cooled
  down.
- The additive fallback ladder remains mandatory: per-player recent exclusion
  may relax before hard deck rules, but it must never turn a valid all-category
  pool into an empty pool.

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
before the deck is built when a user is signed in. Authenticated users with no
saved preferences, empty preferences, or fewer than 3 active valid preferences
use all active categories. Missing authentication uses the explicit capped guest
Solo projection and must not expose raw questions. Guest onboarding category
selection uses only current safe Category metadata before those preferences are
saved; it must not call raw `Question.list` and must not render stale hardcoded
category fallbacks. When at
least 3 active valid preferences exist,
the runtime passes them as a soft 70/30 weighting input. This must not fetch
questions mid-attempt or hard-filter the deck to only selected categories.

Replay and next-level actions clear the current attempt deck and create a new deck. Replay after this change uses the new Solo v2 rules.

## Placement Slots

Solo drop slots are static and readable in every placement mode. Kronox no
longer uses blinking, pulsing, flashing, shimmering, or automatic correct-slot
guidance in `before_after`, `timeline_basic`, or normal timeline play. The
level-start tutorial popup/video copy explains the rule; the slots themselves
must not reveal or suggest the correct answer before the player drops the card.
Drag-over feedback may remain only while the player is actively dragging over a
slot and must stay non-blinking. Correct/wrong feedback remains post-drop only.

## Mobile Browser Drag Guard

Solo card dragging on mobile web uses a gameplay-scoped pull-to-refresh guard:
- the drag lock is active only while the question card is being dragged
- native touchmove prevention must use `passive:false` where needed
- the timeline keeps horizontal `scrollLeft` auto-scroll and drop-zone
  hit-testing intact
- Profile, Settings, and other non-game screens must keep normal scrolling
- Friends, Liderlik, and Admin Ekranı may use app-provided Pull-to-Refresh
  wrappers for list reloads; those wrappers are container-scoped and separate
  from the gameplay drag guard
- iOS Safari, Android Chrome, and PWA/standalone require real-device proof
- if a full browser refresh still happens, current-attempt restore remains a
  separate release risk unless proven by runtime testing
- used jokers are not refunded if refresh/close happens after a joker effect
  was successfully applied

## Solo Jokers / User Inventory

Solo jokers are user-owned and Solo-only:
- Online mode has no joker UI or joker effects
- Solo joker buttons read `UserJokerInventory` balances and show the owned
  counts for `Kronokalkan`, `Kart Değiştir`, and `Zamanı Dondur`
- a player may use multiple jokers across one Solo level when they own enough
  balance
- only one joker may be used for the current question/card decision
- `Kart Değiştir` keeps the same current-card joker guard for the replacement
  card, so a swap cannot reset the guard for a second joker on the same
  decision
- balance is spent through the server-backed joker inventory path with a
  `JokerTransaction` reason of `solo_use`
- used jokers are not refunded on fail, timeout, or exit
- no refund also applies to replay, browser close, or abandoned attempts
- jokers do not grant Kronox Puan directly and do not change Solo scoring values

Inventory foundation:
- `UserJokerInventory` stores current owned balances per user and joker type
- `JokerTransaction` stores the joker ledger/idempotency audit
- every authenticated user receives 3 `mistake_shield` / Kronokalkan, 3
  `card_swap` / Kart Değiştir, and 3 `time_freeze` / Zamanı Dondur once
- starter grant keys are idempotent (`starter_jokers:<email>:<joker_type>`)
- missing inventory for existing users self-heals through the authenticated
  `ensureUserJokerInventory` path; partial missing joker-type rows are repaired
  without overwriting existing balances
- identity is normalized through lowercase `user_email` across starter grant,
  Profile, Solo spend, Mağaza purchase, and ledger rows
- if inventory rows are missing but ledger rows exist, repair uses the latest
  `JokerTransaction.balance_after` so spent jokers are not refunded
- duplicate, unknown, or malformed inventory rows must not crash Profile or
  Solo loading; valid known balances are still displayed
- Profile displays Kronokalkan, Kart Değiştir, Zamanı Dondur, and separate
  `İpucu` balances under `Joker Çantası`
- Mağaza Store sells Solo joker packages with Diamonds, may grant Hint balances
  through server-owned Hint inventory, and shows real-money Diamond packages
  only as no-grant display until approved IAP/payment verification exists.
- Mağaza purchase validates price and sufficient Diamonds server-side through
  `purchaseJokerWithDiamonds`, writes Diamond plus matching Joker/Hint ledgers
  with `market_purchase`, and does not change Solo scoring, timer, question
  selection, or Online mode.
- `purchaseJokerWithDiamonds` explicitly binds `UserJokerInventory`,
  `UserHintInventory`, `DiamondTransaction`, `JokerTransaction`, and
  `HintTransaction`; deployed runtime proof must confirm the Diamond decrease,
  inventory increase, and ledgers.
- purchased jokers appear through the same persistent `UserJokerInventory`
  balances that Solo already reads; using them in Solo still spends through
  `spendUserJoker` and writes `JokerTransaction.reason = solo_use`
- `spendUserJoker` is Solo-context-only, uses deploy-safe
  `UserJokerInventory`/`JokerTransaction` entity fallback, and returns safe
  user-facing errors without changing scoring, timer, deck order, or Online
- Solo Hint / İpucu is separate from Joker. `ensureUserHintInventory`
  initializes exactly 3 starter Hints once for authenticated and token-proven
  completed guest players, while `consumeUserHint` spends one Hint with
  `HintTransaction.reason = solo_use`, `source = solo_hint`, and an
  idempotency key. The left-card Hint launcher opens the popup and does not
  consume. The popup has one clear hammer action, pauses the effective Solo
  timer, keeps stage 0 fully covered from first render, reveals only the active
  card year in 1/3, 2/3, and full stages after server confirmation, can satisfy
  Daily `hint_used`, and does not count as Joker use, change scoring, grant
  Kronox Puan, affect leaderboard, or expose the full question bank.

## Daily Calendar / Streak

The legacy Solo-only Daily Quest runtime is replaced by Daily Calendar /
Streak:

- Home uses the `GÜNLÜK` calendar shortcut to open `/daily`; it is not a
  BottomNav item.
- `UserDailyQuestProgress` stores 3 `daily_calendar:*` task rows per UTC server
  day from the 9-day rotating task template cycle.
- Solo emits real-event progress for level completion, correct answers,
  consecutive-correct-4, joker usage, Time Freeze usage, and jokerless level
  completion.
- Daily Wheel and Friends emit their own event progress; Solo does not fake
  those tasks.
- `Çark çevir` is completed by a successful Daily Wheel claim and can be
  reconciled by `getDailyQuestStatus` from the same-day `DailyWheelSpin` row;
  opening/reopening the wheel does not count as a task event.
- Hint tasks use the real `hint_used` event and require a matching
  `HintTransaction.reason = solo_use` row, so opening the popup or a failed
  consume cannot complete the task.
- Daily task-relevant events invalidate the Daily status cache so `/daily`
  refreshes without app restart while older background status responses are
  ignored.
- `recordDailyQuestProgress` is idempotent and never grants Diamonds.
- A day is complete only after all 3 task rows are complete; missing a UTC day
  breaks the computed streak.
- `claimDailyQuestReward` grants only the 7-day streak reward and writes
  `DiamondTransaction.source = daily_calendar_streak_reward` for exactly 200
  Diamonds.
- Daily Calendar does not grant Kronox Puan and does not affect Leaderboard.
- `cleanupLegacyDailyQuests` is the admin-gated dry-run/delete path for old
  DailyQuestDefinition and non-`daily_calendar:*` progress rows.
  summary/availability fields, not the sole idempotency source
- Online mode does not increment Daily Quest progress
- Daily Wheel, Mağaza, Solo joker inventory, scoring, timer, and question
  selection remain separate from Daily Quest rewards

Joker behavior:
- `Kronokalkan`: activates one-time protection. The next wrong valid placement does not consume a move; correct placements do not consume the shield.
- `Kart Değiştir`: replaces the current active card using the already prepared Solo attempt deck/reserve and does not consume a move. It must not fetch a raw client question list, rebuild the deck, or rerandomize the attempt mid-game, and the swapped-out card should not reappear later in the same attempt while unused deck cards are available. Replacement must respect visible timeline spacing and prefers a balanced reserve card that does not worsen category/subcategory/theme repetition. If no safe replacement exists, the joker is not consumed and the player sees `Bu kart şu anda değiştirilemiyor.`
- `Zamanı Dondur`: freezes the Solo level timer for 10 seconds and does not consume a move. It does not add score, add extra time, or alter timeout rules beyond pausing the elapsed timer during the freeze window.
- `İpucu`: opens the active-card Hint popup without consuming, pauses the
  visible Solo timer, renders one hammer action, keeps stage 0 fully covered
  from first render, and reveals only the active card year in 1/3, 2/3, and
  full stages after server-confirmed Hint spends. If `Zamanı Dondur` is already
  active, the Hint pause is overlap-aware and must not subtract the same frozen
  seconds twice.

## Backward Compatibility

Do not recalculate old completed Solo results. Do not rewrite old stored `bestScore`, `bestStars`, or `bestTimeSeconds`. New attempts can record `soloRulesVersion: 3` so future audits can distinguish Solo v3 move-based results from legacy stored results.

## First Launch Level 1 Handoff

First-time guests can still enter level 1 from `/onboarding`, but the route
flag is now a GuestProfile handoff flag only. Gameplay uses the same real
`before_after` level type, level-start popup, 6-card target, training
Joker/Hint behavior, scoring, and progress write rules as any other level 1
attempt. The old guided hand-demo overlay, forced joker sequence, and separate
old tutorial flow must not run on top of this onboarding level.

The level still uses the safe Solo question runtime: no raw `Question.list`
fallback, no full question bank, and guest callers only receive the capped
gameplay deck. The onboarding route/context flag is not a new question source.

After a successful first-launch level 1, the result popup returns to GuestProfile
onboarding for profile setup, then category setup, then Ana Sayfa. The category
completion CTA is `Ana Sayfa`; a successful token-proven guest category save
marks `category_setup_status = completed` and `onboarding_status =
onboarding_complete` before routing home. Closing the app during onboarding
resumes from the persisted GuestProfile state, and restarting after onboarding
completion opens Ana Sayfa.

## Per-Player Anti-Repeat Selection

Solo freshness is evaluated per player. The same question shown to different
players is acceptable; repeating the same question for the same player too soon
is the problem.

Selection order within the already-selected category/lane:

1. questions never shown to this player in the relevant mode
2. lower per-player `shown_count`
3. older per-player `last_shown_at`
4. global shown count / global last shown only as secondary tie-breakers
5. stable randomization

Normal Solo, including the real level-type onboarding levels 1-6, reads and
writes `PlayerQuestionExposure` with `mode=solo`. The retired guided tutorial
mode remains legacy only and must not be required by the current first-launch
onboarding path. `getQuestions` applies the same exposure-aware ranking before its
bounded server attempt response cap, and `buildSoloAttemptDeck` receives
`playerQuestionExposureStats` so final ordering and replacement reserve ordering
keep the same priority.

Exposure is written only after a question becomes visible to the player:
active card shown or `Kart Değiştir` replacement shown. Server candidate rows,
unused deck reserve cards, and never-shown buffered cards are not exposure.
`Kart Değiştir` and `Kronokalkan` replacement needs must use the existing
bounded deck/reserve or safe server-side replacement path; raw client
`Question.list` fallback and full question bank exposure remain forbidden.

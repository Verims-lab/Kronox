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

## Question Loading Bootstrap

Game entry first attempts an online `getQuestions` fetch whenever the browser
is online or network state is unknown. The default gameplay response is a
public-safe minimal playable projection so guest Solo can load questions without
login; admin/full-bank diagnostics still require AdminUser authorization. Empty
local question cache is not an offline condition by itself. While the first
fetch is pending, the user sees a loading state such as `Sorular hazırlanıyor...`.

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
- live category ids are normalized from `Category.category_id` as any positive
  id; runtime must not clamp Solo to the original seed IDs or to categories
  1-6.

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
into the deck builder before the attempt starts. Login and Category preferences
are optional for question selection: guest users, signed-in users with no saved
preferences, and signed-in users with fewer than 3 active valid preferences use
all active categories. Missing, corrupt, passive, empty, or unavailable
preferences fall back to global Solo selection and must not become an empty
question pool or offline/no-cache error. Saved preferences only become a soft
70/30 weighting input when at least 3 active valid preferences exist. Online
question selection is not affected.

`Game.jsx` must explicitly resolve `getValidActiveSelectedCategoryIds(preferences,
activeCategories)` in the Solo-only path so stale, passive, or invalid
preference rows are filtered against active Categories before the deck builder
receives any selected IDs. This helper is not used by Online category selection
or by `/getQuestions`.

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
- Codex321 audit finding: runtime `/getQuestions` category projection must be
  driven by active `Category` rows, not a stale hardcoded seed-category list.
  The fallback list is only for Category read failure; normal runtime must not
  accidentally hardcode active categories 7+ out of the Solo-eligible pool.
- Codex329 fix: `/getQuestions`, Category helpers, and preference helpers
  accept active status aliases (`a`, `active`, `aktif`, plus missing status for
  backward compatibility), fetch candidates per active category before
  pool-proportional projection, and expose diagnostics showing that projection
  is not capped before category balancing. The local question cache version is
  `question-runtime-v4-active-category-full-pool` so stale narrow projections
  are invalidated.
- Codex330 fix: the global 30% difficulty-1 candidate diagnostics/scorer use
  the full eligible Solo pool, not only the non-selected category subset.
  The separate selected-vs-non-selected 70/30 pressure remains soft and
  pool-proportional; this does not force equal category counts.
- Codex333 diagnostic: the broken production Admin Ekranı diagnostic button
  was removed. The owner/preference-user Solo query audit is now run directly
  with `scripts/diagnoseSoloQuestionStartQuery.mjs` or the optional admin-only
  `diagnoseSoloQuestionStartQuery` backend function after deployment. The
  direct runner requires live Base44 service-role credentials, captures the
  fresh `getQuestions`-compatible per-category `Question.filter` query
  descriptor, active/Solo-eligible/difficulty-1 counts by category, cache
  key/version notes, actual frontend `buildSoloAttemptDeck` dry-run output, and
  category 6/7/8/9/11 presence/removal reasons. It must not write gameplay,
  progress, analytics, or economy rows.
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
- Runtime exposure improvement is proven over new gameplay events; historical
  analytics reports can remain concentrated until enough fresh events exist.
- Remaining audit risk: repeat avoidance is currently per-device/local-history
  soft weighting. It does not yet use a server-side per-user or global exposure
  ledger, and low-correct/high-latency questions are reported for review rather
  than automatically cooled down.
- Future server-side exposure balancing requires explicit product/architecture
  approval before implementation. The safe target is additive: per-user recent
  exclusion, session-level no-repeat, global underexposure boost,
  overexposure/recency penalty, low-correct cooldown only after a minimum
  sample threshold, and a fallback ladder that never turns a valid all-category
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
before the deck is built when a user is signed in. If no user or no qualifying
preferences are available, the deck builder uses all active categories. When at
least 3 active valid preferences exist, the runtime passes them as a soft 70/30
weighting input. This must not fetch questions mid-attempt, block guest play,
or hard-filter the deck to only selected categories.

Replay and next-level actions clear the current attempt deck and create a new deck. Replay after this change uses the new Solo v2 rules.

## Placement Assist

The subtle placement hint remains visual-only for levels 1-3:
- active only while dragging a Solo card
- highlights the already-computed correct placement zone
- disappears after placement or drag end
- no score penalty
- no hit-testing, drag behavior, or validation changes
- disabled for level 4+ and Online mode

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
  counts for `Kronokalkan`, `Kart Değiştir`, and `Zaman Dondur`
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
  `card_swap` / Kart Değiştir, and 3 `time_freeze` / Zaman Dondur once
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
- Profile displays balances under `Joker Çantası`
- Mağaza Phase 1 sells only Solo jokers with Diamonds:
  `Zaman Dondur = 40`, `Kart Değiştir = 50`, `Kronokalkan = 60`
- Mağaza purchase validates price and sufficient Diamonds server-side through
  `purchaseJokerWithDiamonds`, writes both Diamond and Joker ledgers with
  `market_purchase`, and does not change Solo scoring, timer, question
  selection, or Online mode
- `purchaseJokerWithDiamonds` explicitly binds `UserJokerInventory`,
  `DiamondTransaction`, and `JokerTransaction`; deployed runtime proof must
  confirm the Diamond decrease, joker increase, and both ledgers
- purchased jokers appear through the same persistent `UserJokerInventory`
  balances that Solo already reads; using them in Solo still spends through
  `spendUserJoker` and writes `JokerTransaction.reason = solo_use`

## Daily Quest Runtime V1

Daily Quest Runtime v1 is Solo-focused:
- admin-managed `DailyQuestDefinition` rows define system quest templates
- `DailyQuestDefinition.quest_key` is the logical unique key; create/default
  seed paths skip or reject existing keys, and existing duplicate rows are
  grouped/warned in Admin UI instead of auto-deleted
- `UserDailyQuestProgress` tracks 1 selected user/day quest per UTC day
- Günlük Görev requires active `DailyQuestDefinition` rows; the runtime selects
  one canonical active definition per `quest_key` by `sort_order`, `created_at`,
  and stable id, then selects the first logical daily quest
- the runtime seeds the default Solo-focused templates idempotently only when no
  definition rows exist
- `getDailyQuestStatus` is authenticated but not admin-only, and preserves
  newly created progress rows if an immediate Base44 refresh is stale
- loading or ensuring today’s quests does not grant Diamonds;
  `claimDailyQuestReward` remains the only reward path
- completing progress alone does not grant Diamonds; completed and unclaimed
  quests expose the `Al` claim action
- Home Daily Quest copy is `Günlük Görevleri Yap, Elmasları Kazan!`
- supported v1 quest types are `start_solo_attempt`, `correct_cards`,
  `complete_solo_level`, and `use_joker`
- `title` and `description` are display-only Turkish copy and are never parsed
  into logic
- Solo progress is measured only by `quest_type + target_value`
- `start_solo_attempt` increments only after the Solo deck is built, the first
  question is selected, and the attempt actually starts; failed question loading
  must not count
- `correct_cards` increments after correct Solo card placement
- `complete_solo_level` increments only after a successful Solo level
- `use_joker` increments only after a Solo joker is successfully consumed
- `reward_diamonds` is the only reward field; Daily Quest does not grant
  Kronox Puan and does not affect leaderboard
- Daily Quest does not grant Kronox Puan and has no leaderboard impact
- Daily Quest grants diamonds only through `claimDailyQuestReward`
- `claimDailyQuestReward` writes `DiamondTransaction.source = daily_quest_reward`
  updates visible `User.diamonds`, returns `diamondBalanceAfter`, marks the row
  claimed, and blocks duplicate claims
- `getDailyQuestStatus`, `recordDailyQuestProgress`, and
  `claimDailyQuestReward` explicitly bind `UserDailyQuestProgress` in their
  Base44 runtime functions
- one claim per quest per UTC day is enforced by progress status and the
  `daily_quest_reward` idempotency key
- `daily_quest_last_claim_date` and `daily_quest_next_available_at` are User
  summary/availability fields, not the sole idempotency source
- Online mode does not increment Daily Quest progress
- Daily Wheel, Mağaza, Solo joker inventory, scoring, timer, and question
  selection remain separate from Daily Quest rewards

Joker behavior:
- `Kronokalkan`: activates one-time protection. The next wrong placement does not count as a mistake; correct placements do not consume it.
- `Kart Değiştir`: replaces the current active card using the already prepared Solo attempt deck/reserve. It must not fetch a new question, rebuild the deck, or rerandomize the attempt mid-game, and the swapped-out card should not reappear later in the same attempt while unused deck cards are available. Replacement must respect visible timeline spacing and prefers a balanced reserve card that does not worsen category/subcategory/theme repetition. If no safe replacement exists, the joker is not consumed and the player sees `Bu kart şu anda değiştirilemiyor.`
- `Zaman Dondur`: freezes the Solo level timer for 10 seconds. It does not add score, add extra time, or alter timeout rules beyond pausing the elapsed timer during the freeze window.

## Backward Compatibility

Do not recalculate old completed Solo results. Do not rewrite old stored `bestScore`, `bestStars`, or `bestTimeSeconds`. New attempts can record `soloRulesVersion: 2` so future audits can distinguish Solo v2 results from legacy stored results.

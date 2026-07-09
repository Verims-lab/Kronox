// Codex167 — Runtime mirror of docs/KRONOX_SOLO_QUESTION_ENGINE.md so the
// Health Center can prove that the engine contract is present in the app
// bundle. Keep this string in sync with the canonical markdown.

export const SOLO_QUESTION_ENGINE_DOC_PATH = 'docs/KRONOX_SOLO_QUESTION_ENGINE.md';

export const SOLO_QUESTION_ENGINE_DOC = `# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

Normal Solo levels end at 7 correct timeline cards, including seed cards
already on the timeline, start with 2 timeline anchor cards, use a 10
evaluated moves limit, and use an internal 18-question deck buffer.
Special Solo levels start at level 10 after onboarding and repeat every
5 levels: 10, 15, 20, and so on. Special Solo levels end at 10 correct timeline cards,
including seed cards already on the timeline, use a 13 evaluated moves limit,
and use an internal 21-question deck buffer. The 3 extra moves are only a
mistake buffer and do not change scoring.

Levels 1-3 use level_type before_after with one fixed reference card, ÖNCESİ /
SONRASI slots, 10 attempt question cards, a 6-correct progress target, and no
answer-card insertion into the persistent timeline. Levels 4-6 use level_type
timeline_basic with two fixed reference cards, ÖNCESİ / ARASI / SONRASI slots,
10 attempt question cards, a 6-correct progress target, and no answer-card
insertion into the persistent timeline. Levels 1-6 are real Solo
levels that keep existing Solo progress, stars, Kronox Puan, replay/best-score,
and leaderboard projection guards. Level 7 returns to normal timeline play.

All new Solo attempts use a 180 seconds timer and fail when their level-specific
evaluated move limit is used before the target timeline card count is reached.
Internal deck sizing is before_after 1 reference + 10 attempt cards + Kart Değiştir
buffer + Kronokalkan buffer, timeline_basic 2 references + 10 attempt cards +
Kart Değiştir buffer + Kronokalkan buffer, normal 2 anchors + 10 playable moves
+ Kart Değiştir buffer + Kronokalkan buffer, and special 2 anchors + 13
playable moves + Kart Değiştir buffer + Kronokalkan buffer. Zaman Dondur does not require extra card buffer.
Deck sizing is 2 anchors + 10 playable moves + Kart Değiştir buffer + Kronokalkan buffer for normal levels.
Extra Kart Değiştir or Kronokalkan use beyond the per-attempt buffer fails
safely before spend; there is no raw client question list fallback.

Onboarding level-start tutorial popups appear on levels 1, 2, 3, 4, and 7 every
attempt, with a safe video placeholder/config slot and an X close button.
Levels 5, 6, and 8+ have no level-start popup. Popup time is excluded from the
effective Solo timer and popup close/skip analytics must stay privacy-safe.
Onboarding levels 1-6 show Joker and Hint controls in training mode: no
spendUserJoker, no consumeUserHint, no JokerTransaction or HintTransaction
spend row, no real inventory decrement, and no Daily Calendar joker/hint task
progress. Level 7 and later use normal inventory-consuming Joker/Hint behavior.

Question loading bootstrap first attempts online getQuestions when the browser
is online or network state is unknown. The default gameplay response is an
authenticated bounded server attempt candidate buffer for signed-in users;
first-time guest Solo uses only the explicit capped guest_gameplay_runtime
minimal projection.
Admin/full-bank diagnostics still require AdminUser authorization. Empty
local question cache is not an offline condition. While the first fetch is
pending, the UI shows the shared visual-only Kronox hourglass preparation
screen; it must not add artificial wait, minimum display duration, or block
gameplay start once the deck is ready. The old spinner/text/back-button
preparation screen is not used for normal question preparation. The
offline/no-cache screen is reserved for known offline state plus failed online
fetch plus no usable cache.
Tekrar Dene clears the transient error and re-fetches online before cache fallback.
Question-set replacements invalidate stale local question cache by version, and
direct /game access without Solo launch state returns the user to Home/Solo
entry instead of showing a false offline screen.

The full attempt deck is built before gameplay starts. Gameplay consumes
the prebuilt deck in order. There is no mid-attempt re-randomization.
The first active player question card shown to the user must be
soloAttemptDeck[0], the second must be soloAttemptDeck[1], and so on. Seed
or preplaced timeline cards do not count as the first 5 active player
question cards unless they are actual player question cards. They must still
avoid close-year conflicts with the first 5 active player cards in the early
visible timeline context.

Normal Solo also uses a visible timeline spacing guardrail during runtime.
Before the next active card is shown, the ordered deck picker prefers an
unused prebuilt-deck card whose answer year is at least 5 years away from
already visible timeline years, including placed cards and seed/preplaced
cards. This avoids player-facing 1-4 year conflicts such as 1996/1997,
1998/1999, and 1913/1914 where a safe alternative exists.

Hard deck rules:
- 17 questions for before_after onboarding.
- 18 questions for timeline_basic onboarding.
- 10 evaluated moves for onboarding levels.
- 18 questions for normal levels.
- 21 questions for special levels.
- 10 evaluated moves for normal levels.
- 13 evaluated moves for special levels.
- unique question IDs.
- unique years.
- active questions only.
- active categories only.
- passive categories excluded.
- first 5 ordered active player question cards must satisfy minimum 5-year spacing between answer years.
- first 5 ordered questions means the first 5 displayed active player question cards at runtime.
- missing, null, undefined, empty, approximate, or non-numeric years are invalid.

Soft deck preferences:
- category balance.
- subcategory balance.
- tag/theme balance, including sports-like theme clustering.
- era/year spread.
- recently-seen avoidance.
- exposure cooldown / rotation prefers never-shown, less-shown, and not-recently-shown questions when local or projected stats are available.
- user Category preferences target 70% selected user categories and 30% full eligible pool when at least 3 active valid UserCategoryPreference rows are available before the attempt starts. The selected-category lane uses selected categories with difficulty 1 and 2 eligible. The global 30% lane first uses all active categories with difficulty 1, then selected-category shortage or global difficulty-1 shortage fills from the broader active global pool before clean failure.

The P0 first-five guardrail avoids more than 2 same-subcategory or obvious
sports-cluster cards when metadata and alternatives allow. P1/P2 balance
applies during selection and ordering: rich pools are distributed across
categories, subcategories, themes, and year bands with pool-proportional
targets, not equal-count balancing; the first 7 active displayed cards avoid
4+ same category/subcategory/theme cards where alternatives exist; exposure
weighting is soft only and cannot make a deck fail by itself; and diagnostics
expose categoryDistribution, subcategoryDistribution, themeDistribution,
decadeDistribution, yearBandDistribution, diversityFairness,
firstSevenCategoryDistribution, and fallbackTier for Health/admin/debug only.
Normal 18-card decks target 13 selected-category cards and 5 global-pool
cards; special 21-card decks target 15 selected-category cards and 6
global-pool cards. The selected-category lane uses difficulty 1 and 2.
Global-pool cards first use difficulty 1 from all active categories. Selected-category
shortage or global difficulty-1 shortage fills from the broader active global
pool before clean failure.

The runtime may pass local recent-history exposure stats into the deck builder
before the attempt starts. This is not a gameplay source of truth and must not
fetch questions or stats mid-attempt. Corrupt or missing local history is
ignored safely, and sparse metadata must not block deck creation by itself.
The runtime may also pass active valid current-user Category preference IDs
before the attempt starts. Category preferences are optional for Solo question
selection: signed-in users with no saved preferences, empty
preferences, or fewer than 3 active valid preferences use all active categories.
Missing authentication uses the explicit capped guest Solo projection and must
not expose raw questions. Missing, corrupt, passive, empty, or unavailable preferences fall
back to global Solo selection and must not become an empty question pool or
offline/no-cache error. Saved preferences only become a soft 70/30 weighting
input when at least 3 active valid preferences exist. Online question selection
is not affected by Solo preferences: startLobbyGame persists a bounded shared
online_question_deck on Lobby from active lobby-selected categories only, uses
difficulty 1/2 only, and Game reads that persisted deck instead of the Solo
getQuestions buffer.
Game.jsx explicitly resolves getValidActiveSelectedCategoryIds(preferences,
activeCategories) in the Solo-only path before passing selected IDs to the deck
builder.
getQuestions derives runtime playable category IDs from active Category rows,
not a stale hardcoded seed-category subset; Category read failure returns an
empty/retryable state instead of fallback IDs and must not permanently exclude
newer active category IDs.
Runtime active-category status aliases include a, active, and aktif, and live
category_id normalization accepts any positive DB category id instead of
clamping to original seed IDs. question-runtime-v10-solo-architecture
invalidates stale local projections and old difficulty-lane buffers after the
server-attempt/readiness change.
Gameplay fetches request the v2 per-category projection and
server_attempt_candidate_buffer_v1 explicitly; getQuestions fetches
numeric/string main_category_id and category_id variants per active Category
before the bounded response cap. getQuestions has an explicit Base44 function
manifest, signed-in gameplay returns a bounded server attempt candidate buffer,
projectionDiagnostics are admin/debug-only, stale Category fallback IDs are
forbidden even when Category read fails, sourcePoolCapRemoved/responseCapApplied describe the new
runtime contract, and Question category fields are not capped to the original
1-6 seed set.
getQuestionsRuntimeMarker / diagnostics runtimeMarker
getQuestions-live-per-category-v8-Codex417 must appear in Solo debug
JSON after deployment; if absent, the deployed callable is stale or different.
Authenticated candidate fetches are bounded to 96 * 3 = 288 rows per active
category/query variant before projection; 5000-row per-category reads are not
part of the current contract.

P2 diagnostics are Health/admin/helper-only. Deck diagnostics include level
number, level type, deck size, correct target, fail threshold, question IDs,
answer years, first 5 years, minimum first-5 gap, visible-spacing conflict
count, category/subcategory/theme/decade/year-band/difficulty distributions,
fallback tier, balance score, and warnings. Question pool health warns about invalid
years, sparse categories/subcategories, missing sub_category/tag/difficulty
metadata, insufficient unique years, and limited 18/21 deck readiness.
Difficulty progression is readiness-oriented only and falls back safely when
difficulty metadata is missing. Replay variety diagnostics and Kart Değiştir
replacement diagnostics are helper-only and must not be exposed to normal UI.

P3 question analytics writes best-effort QuestionAttemptEvent rows for Solo
shown, answered, swapped_out, and replacement_shown events. Analytics writes
must not block drag/drop, scoring, result popups, or deck progression. Manual
admin email reports are question-focused; no scheduled report exists.
P3 Health guardrails detect projection narrowing, repeated-deck low unique
coverage, high/recent exposure reuse, category/subcategory/year-band
concentration, and active-pool versus runtime-projection mismatch. Health and
reporting guardrails compare selected/shown distribution to the eligible pool
proportionally; they must not require equal category, subcategory, or era
counts. Runtime exposure improvement is proven over new gameplay events, so
historical reports can remain concentrated until fresh events accumulate.
Per-player exposure projections are active for Solo freshness. Selection
prefers questions never shown to the same player in the same mode, then lower
per-player shown_count, then older per-player last_shown_at. Global exposure
remains a secondary tie-breaker only. Low-correct/high-latency questions are
still reported for review rather than automatically cooled down. The additive
fallback ladder remains mandatory: per-player recent exclusion may relax
before hard deck rules, but it must never turn a valid all-category pool into
an empty pool.

Fallback may relax recently-seen avoidance, category/subcategory/theme balance,
and era spread. It must not relax required deck size, unique IDs, unique
years, active question/category filtering, visible timeline spacing where a
safe alternative exists, or the first 5 minimum 5-year spacing rule unless no
valid spaced deck exists at all.

Replay creates a new deck. Old completed results are not retroactively
recalculated. New attempts may carry soloRulesVersion: 3.

Mobile browser Solo card dragging uses a gameplay-scoped pull-to-refresh
guard. The lock is active only while the question card is dragged, native
touchmove prevention uses passive:false where needed, timeline scrollLeft
auto-scroll and drop-zone hit-testing remain intact, and Profile/Settings
scrolling must stay normal. iOS Safari, Android Chrome, and PWA standalone
still require real-device proof. If a full browser refresh happens anyway,
current-attempt restore remains separate future work unless proven at runtime.
Used jokers are not refunded if refresh/close happens after the effect is
successfully applied.

Solo jokers are user-owned and Solo-only. Solo joker buttons read
UserJokerInventory and show owned counts for Kronokalkan, Kart Değiştir, and
Zaman Dondur; Profile Joker Çantası also shows the separate İpucu balance from
UserHintInventory.quantity. A player may use multiple jokers across a Solo level when they
own enough balance, but only one joker may be used for the current
question/card decision. Kart Değiştir keeps the same current-card guard for
the replacement card. Successful Solo use writes a JokerTransaction row with
reason solo_use and quantity_delta -1. Used jokers are not refunded on fail,
timeout, or exit. No refund also applies to replay, browser close, or
abandoned attempts. Jokers do not use Diamonds, do not grant Kronox Puan, and
do not affect Online mode.
Missing or partial UserJokerInventory rows self-heal for authenticated users
through ensureUserJokerInventory. Repair preserves existing balances, uses the
same normalized user_email owner convention across Profile/Solo/Market/ledger
paths, and reconstructs missing rows from latest JokerTransaction balance_after
without refunding spent jokers.
used jokers are not refunded on fail, timeout, or exit.

Mağaza Store sells Solo joker packages with Diamonds, may grant Hint balances
through server-owned Hint inventory, and shows real-money Diamond packages only
as no-grant display until approved IAP/payment verification exists. Mağaza
purchase validates price and sufficient Diamonds server-side through
purchaseJokerWithDiamonds, writes Diamond plus matching Joker/Hint ledgers with
market_purchase, and does not change Solo scoring, timer, question selection,
or Online mode. purchaseJokerWithDiamonds explicitly binds UserJokerInventory,
UserHintInventory, DiamondTransaction, JokerTransaction, and HintTransaction
in the deployed runtime path and treats starter self-heal as best-effort.
Purchased jokers appear through the same persistent UserJokerInventory balances
that Solo already reads; using them in Solo still spends through spendUserJoker,
which is Solo-context-only, uses deploy-safe UserJokerInventory/JokerTransaction
entity fallback, and writes JokerTransaction.reason = solo_use.
Solo onboarding levels 1-6 show Joker and Hint controls in training mode. The
training path applies the safe teaching effect but does not call spendUserJoker
or consumeUserHint, does not decrement UserJokerInventory or UserHintInventory,
does not write JokerTransaction.reason = solo_use or HintTransaction.reason =
solo_use, and does not complete Daily Calendar joker/hint task progress. Level
7 and later use normal inventory-consuming Joker/Hint behavior.
Solo Hint / İpucu is separate from Joker: ensureUserHintInventory initializes
exactly 3 starter Hints once for authenticated and token-proven completed
guests, while consumeUserHint spends one Hint with HintTransaction.reason =
solo_use, source = solo_hint, and an idempotency key. The left-card Hint
launcher opens the popup without consuming. The popup has one hammer action,
pauses the effective Solo timer, keeps stage 0 fully covered from first render,
reveals only the active card year in 1/3, 2/3, and full stages after server
confirmation, is overlap-aware when Zaman Dondur is active so the same frozen
seconds are never subtracted twice, can satisfy Daily hint_used, and never
counts as Joker use, changes scoring, grants Kronox Puan, affects leaderboard,
or exposes the full question bank.

First-launch GuestProfile onboarding may still pass onboardingTutorial in route
state, but that flag is only a profile handoff flag. The active level 1 teaching
flow is the real before_after onboarding level with its level-start popup and
training consumables; the old guided hand-demo overlay and forced joker sequence
must not run on top of it.

Kronokalkan protects the next wrong valid placement from consuming a move.
Kart Değiştir replaces the current card from the already prepared Solo deck
or reserve without consuming a move, fetching, or re-randomizing mid-attempt. The swapped-out card
should not reappear while unused deck cards are available. Replacement must
respect visible timeline spacing and prefers a balanced reserve card that does
not worsen category/subcategory/theme repetition; if no safe replacement
exists, the joker is not consumed and the player sees Bu kart şu anda
değiştirilemiyor. Zaman Dondur freezes the Solo timer for 10 seconds and does not consume a move.

## Per-Player Anti-Repeat Selection

Solo freshness is evaluated per player. The same question shown to different
players is acceptable; repeating the same question for the same player too soon
is the problem.

Selection order within the already-selected category/lane:

1. questions never shown to this player in the relevant mode
2. lower per-player shown_count
3. older per-player last_shown_at
4. global shown count / global last shown only as secondary tie-breakers
5. stable randomization

Normal Solo, including the real level-type onboarding levels 1-6, reads and
writes PlayerQuestionExposure with mode=solo. The retired guided tutorial mode
remains legacy only and must not be required by the current first-launch
onboarding path. getQuestions applies exposure-aware ranking before its bounded
server attempt response cap, and buildSoloAttemptDeck receives
playerQuestionExposureStats so final ordering and replacement reserve ordering
keep the same priority.

Exposure is written only after a question becomes visible to the player:
active card shown or Kart Değiştir replacement shown. Server candidate rows,
unused deck reserve cards, and never-shown replacement buffers are not exposure.
Kart Değiştir and Kronokalkan replacement needs must use the existing bounded
deck/reserve or safe server-side replacement path; raw client Question.list
fallback and full question bank exposure remain forbidden.
`;

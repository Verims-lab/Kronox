// Codex167 — Runtime mirror of docs/KRONOX_SOLO_QUESTION_ENGINE.md so the
// Health Center can prove that the engine contract is present in the app
// bundle. Keep this string in sync with the canonical markdown.

export const SOLO_QUESTION_ENGINE_DOC_PATH = 'docs/KRONOX_SOLO_QUESTION_ENGINE.md';

export const SOLO_QUESTION_ENGINE_DOC = `# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

Normal Solo levels end at 7 correct timeline cards, including seed cards
already on the timeline, and use a 16-question deck.
Special Solo levels start at level 10 and repeat every 5 levels: 10, 15,
20, 25, and so on. Special Solo levels end at 10 correct timeline cards,
including seed cards already on the timeline, and use a 19-question deck.

All new Solo attempts use a 180 seconds timer and fail on 10 mistakes; the
10th mistake ends the attempt.

Question loading bootstrap first attempts online getQuestions when the browser
is online or network state is unknown. The default gameplay response is a
public-safe minimal playable projection so guest Solo can load questions without
login; admin/full-bank diagnostics still require AdminUser authorization. Empty
local question cache is not an offline condition. While the first fetch is
pending, the UI shows Sorular hazırlanıyor...; the offline/no-cache screen is
reserved for known offline state plus failed online fetch plus no usable cache.
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
- 16 questions for normal levels.
- 19 questions for special levels.
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
- user Category preferences target 70% selected user categories and 30% full eligible pool when at least 3 active valid UserCategoryPreference rows are available before the attempt starts. The selected-category lane is not difficulty-1 restricted. The global 30% lane prefers difficulty 1 questions from the full eligible pool where possible, with safe broader-pool fallback when difficulty-1 global candidates are insufficient.

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
Normal 16-card decks target 11 selected-category cards and 5 global-pool
cards; special 19-card decks target 13 selected-category cards and 6
global-pool cards. The selected-category lane is not difficulty-1 restricted;
global-pool cards prefer difficulty 1 where possible and then fall back to the
broader eligible global pool if needed. Selected-category shortage fills from
the full eligible pool instead of failing the deck.

The runtime may pass local recent-history exposure stats into the deck builder
before the attempt starts. This is not a gameplay source of truth and must not
fetch questions or stats mid-attempt. Corrupt or missing local history is
ignored safely, and sparse metadata must not block deck creation by itself.
The runtime may also pass active valid current-user Category preference IDs
before the attempt starts. Login and Category preferences are optional for
question selection: guest users, signed-in users with no saved preferences, and
signed-in users with fewer than 3 active valid preferences use all active
categories. Missing, corrupt, passive, empty, or unavailable preferences fall
back to global Solo selection and must not become an empty question pool or
offline/no-cache error. Saved preferences only become a soft 70/30 weighting
input when at least 3 active valid preferences exist. Online question selection
is not affected.
Game.jsx explicitly resolves getValidActiveSelectedCategoryIds(preferences,
activeCategories) in the Solo-only path before passing selected IDs to the deck
builder.

P2 diagnostics are Health/admin/helper-only. Deck diagnostics include level
number, level type, deck size, correct target, fail threshold, question IDs,
answer years, first 5 years, minimum first-5 gap, visible-spacing conflict
count, category/subcategory/theme/decade/year-band/difficulty distributions,
fallback tier, balance score, and warnings. Question pool health warns about invalid
years, sparse categories/subcategories, missing sub_category/tag/difficulty
metadata, insufficient unique years, and limited 16/19 deck readiness.
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

Fallback may relax recently-seen avoidance, category/subcategory/theme balance,
and era spread. It must not relax required deck size, unique IDs, unique
years, active question/category filtering, visible timeline spacing where a
safe alternative exists, or the first 5 minimum 5-year spacing rule unless no
valid spaced deck exists at all.

Replay creates a new deck. Old completed results are not retroactively
recalculated. New attempts may carry soloRulesVersion: 2.

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
Zaman Dondur. A player may use multiple jokers across a Solo level when they
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

Mağaza Phase 1 sells only Solo jokers with Diamonds: Zaman Dondur = 40,
Kart Değiştir = 50, Kronokalkan = 60. Mağaza purchase validates price and
sufficient Diamonds server-side through purchaseJokerWithDiamonds, writes both
Diamond and Joker ledgers with market_purchase, and does not change Solo
scoring, timer, question selection, or Online mode. purchaseJokerWithDiamonds
explicitly binds UserJokerInventory, DiamondTransaction, and JokerTransaction
in the deployed runtime path. Purchased jokers appear
through the same persistent UserJokerInventory balances that Solo already
reads; using them in Solo still spends through spendUserJoker and writes
JokerTransaction.reason = solo_use.

Kronokalkan forgives the next wrong placement without counting a mistake.
Kart Değiştir replaces the current card from the already prepared Solo deck
or reserve without fetching or re-randomizing mid-attempt. The swapped-out card
should not reappear while unused deck cards are available. Replacement must
respect visible timeline spacing and prefers a balanced reserve card that does
not worsen category/subcategory/theme repetition; if no safe replacement
exists, the joker is not consumed and the player sees Bu kart şu anda
değiştirilemiyor. Zaman Dondur freezes the Solo timer for 10 seconds.
`;

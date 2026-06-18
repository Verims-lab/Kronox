# Kronox Technical Flow

Status: Active technical flow contract.

This document describes how the current Kronox product workflow is implemented
across frontend routes, Base44 entities/functions, runtime selection, economy,
analytics, Health, and deployment proof.

Related contracts:

* `KRONOX_CORE_PROMPT.md`
* `KRONOX.md`
* `docs/KRONOX_DB_ARCHITECTURE.md`
* `docs/KRONOX_DATA_MODEL_AUDIT.md`
* `docs/KRONOX_DATA_MODEL_IMPLEMENTATION_PLAN.md`
* `docs/KRONOX_QUESTION_DATA_MODEL.md`
* `docs/KRONOX_SOLO_QUESTION_ENGINE.md`
* `docs/KRONOX_CATEGORY_TAXONOMY.md`
* `docs/KRONOX_SCORING_RULES.md`
* `docs/KRONOX_ECONOMY_RULES.md`
* `docs/KRONOX_PROFILE_FIELDS.md`
* `docs/KRONOX_SECURITY_DEPLOYMENT.md`
* `docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md`
* `docs/KRONOX_RELEASE_PROOF_CHECKLIST.md`

---

# 1. Platform And App Shell

Kronox is a Vite/React app with Tailwind-style UI, Base44 entities/functions,
and mobile/PWA/WebView release constraints.

Runtime route map is owned by `src/App.jsx`.

Important routes:

* `/` - Ana Sayfa
* `/onboarding` - guided guest onboarding shell
* `/game` - Solo / Online game shell
* `/solo` - Solo level path
* `/market` - Mağaza
* `/leaderboard` - Liderlik
* `/profile` - Profil
* `/settings` - Profile settings surface
* `/friends` - Arkadaşlarım
* `/lobby` - Online lobby flow
* `/admin` - Admin Ekranı
* `/test-suite` - Health Center / simulator
* `/privacy` - public privacy page
* `/account-deletion` - public account-deletion page

BottomNav is hidden on onboarding, game, and public standalone pages. Visible
bottom tabs are Ana Sayfa, Liderlik, and Profil.

---

# 2. Identity And Auth Flow

Guest identity is `GuestProfile`, not Firebase anonymous auth and not Base44
anonymous auth.

Core guest fields:

* `guest_id`
* `guest_token_hash`
* `guest_token_hash_algorithm`
* `username`
* `username_normalized`
* mirrored legacy `display_name`
* onboarding status fields
* optional profile fields
* optional `selected_category_ids`

`createGuestProfile` is public by design because unauthenticated users must be
able to start as guests. The function generates `guest_id`, raw guest token,
token hash, and default username server-side. The raw guest token is returned to
the client once and remains client-side; the database stores only the hash.

All guest updates that mutate profile/onboarding/category state require
`guest_id + raw guest token` proof. `guest_id` alone is never an ownership
proof.

Public identity source:

* current: `username`
* legacy mirror/fallback: `display_name`

`display_name` exists for compatibility/projections only. New UI and docs must
not present `Görünen Ad` / `display_name` as the current public editable field.

Authenticated account linking is through `linkGuestAccount` from Profile. It
verifies both guest token proof and `base44.auth.me()`, writes
`AccountLinkTransaction`, marks the guest linked once, and applies
user-beneficial merges without exposing provider IDs publicly.

---

# 3. Onboarding State Machine

`GuestProfile.onboarding_status` is the onboarding source of truth.

Current states:

* `guest_created`
* `tutorial_in_progress`
* `tutorial_completed`
* `profile_setup_pending`
* `category_setup_pending`
* `onboarding_complete`

`src/pages/OnboardingPage.jsx` owns the visible onboarding shell and uses
`ensureGuestProfile`, `getGuestOnboardingStep`, and
`updateGuestProfileOnboarding`.

State progression:

1. guest created or verified
2. start guided tutorial
3. set `tutorial_in_progress`
4. navigate to `/game` with guided Solo config
5. tutorial completion sets profile setup pending
6. profile save writes username/age/gender and advances to category setup
7. category save writes `selected_category_ids`,
   `category_setup_status = completed`, and
   `onboarding_status = onboarding_complete`
8. route to Ana Sayfa

Repair rule: later completed states outrank stale tutorial state. A stale
`tutorial_in_progress` value must not override profile setup, category setup, or
onboarding complete.

---

# 4. Category Metadata And Preferences

Canonical category source:

* live `Category` entity rows
* safe `getCategoryMetadata` callable

Safe metadata scope:

* `category_id`
* `name`
* `description`
* `status`

Forbidden category loading behavior:

* stale hardcoded category arrays
* old deployable seed fallback
* raw `Question.list` for category onboarding
* full question-bank exposure
* treating original seed IDs as a runtime maximum

`seedQuestionCategories` has been removed. Category creation/backfill is a
deliberate admin/content operation against the live `Category` table.

Authenticated preference storage:

* entity: `UserCategoryPreference`
* current UI: Profile / Settings / `İlgi Alanlarım`
* active save minimum: 3 valid active categories
* fewer than 3 active valid preferences means Solo uses all active categories
* at least 3 active valid preferences enables Solo-only soft weighting

Guest onboarding category storage:

* field: `GuestProfile.selected_category_ids`
* token-proven write
* fewer than 3 is advisory, not a hard gameplay block
* empty means all active Solo categories remain eligible

Legacy subcategory rows:

* `SubCategory` is additive/future lookup preparation
* `UserSubCategoryPreference` rows are retained legacy data
* current Settings preference UI does not write SubCategory preferences

---

# 5. Solo Question Runtime

Current Solo frontend entry points:

* `src/pages/Game.jsx`
* `src/lib/soloQuestionEngine.js`
* `src/lib/soloLevels.js`
* `src/lib/soloProgressHelpers.js`
* `src/hooks/useOfflineQuestions.js`

Current constants:

* `SOLO_LEVEL_TIME_SECONDS = 180`
* `SOLO_MAX_MOVES = 10`
* normal target = 7 timeline cards including anchors
* special target = 10 timeline cards including anchors
* normal deck = 18 questions
* special deck = 19 questions
* initial anchors = 2

Deck structure:

* 2 timeline anchors
* 10 playable evaluated moves
* Kart Değiştir replacement buffer
* Kronokalkan / mistake-shield buffer

Runtime consumes `soloAttemptDeck` in order. The first active question shown is
`soloAttemptDeck[0]` unless a deck-safe joker replacement is explicitly used.

Solo selection inputs:

* active category whitelist from current `Category` rows
* authenticated `UserCategoryPreference` soft weighting when valid
* `PlayerQuestionExposure` anti-repeat stats where available
* difficulty/category/subcategory/theme/year balancing
* server attempt candidate buffer from `getQuestions`

Raw client `Question.list` gameplay fallback is forbidden. Guest gameplay uses
the explicit capped guest projection path; signed-in Solo uses authenticated
minimal `getQuestions` projection.

Visible scoring:

* remaining moves are shown as `HAMLE`
* valid evaluated placements consume one move
* touches/drags/cancelled/invalid drops do not consume moves
* result popups use `SÜRE`, `PUAN`, and `HAMLE`
* `HATA` is legacy/internal and not current visible Solo scoring copy

---

# 6. Solo Exposure And Analytics Writes

Per-player anti-repeat memory:

* `PlayerQuestionExposure`
* keyed logically by internal `player_key + question_id + mode`
* private/internal only
* not shown in public reports

Daily exposure summary:

* `PlayerQuestionDailyExposure`
* used for anonymous coverage analytics

Exposure writes:

* best-effort
* actual shown active cards only
* replacement/tutorial cards count when actually shown
* server candidate pools do not count
* unused deck buffers do not count
* guest exposure requires `guest_id + raw guest token`

Question attempt events:

* entity: `QuestionAttemptEvent`
* active raw report history source
* captures shown/answer/replacement/time metadata according to privacy
  boundaries

---

# 7. Joker Technical Flow

Current inventory source:

* `UserJokerInventory`

Ledger:

* `JokerTransaction`

Current joker types:

* `time_freeze` - Zaman Dondur
* `card_swap` - Kart Değiştir
* `mistake_shield` - Kronokalkan

Starter/self-heal grants and normal Solo spends are idempotent. Normal Solo
spends use authenticated user context, positive-balance validation, and
Solo-context validation. Tutorial demo paths must not call the real spend path.

Market purchase flow:

* callable: `purchaseJokerWithDiamonds`
* server owns price table
* validates authenticated user and sufficient Diamonds
* updates Diamond balance
* writes `DiamondTransaction`
* updates `UserJokerInventory`
* writes `JokerTransaction`
* uses idempotency keys for retry/double-tap safety

---

# 8. Online Technical Flow

Online lobby/category flow:

* `OnlineChallengeScreen` loads current category metadata
* host selected categories become `Lobby.selected_category_ids`
* legacy `Lobby.category` is compatibility only
* `startLobbyGame` validates host/players/settings server-side
* `startLobbyGame` builds and persists `online_question_deck`
* Game reads persisted shared deck

Online deck contract:

* 100% from selected active lobby categories
* difficulty 1/2 only
* no Solo category preference weighting
* no guest Solo projection
* no raw client question bank fallback
* no old seed name fallback

Online scoring updates the Online component of unified visible Kronox Puan.
Online result copy uses gained/lost/new Kronox Puan language and must show
persisted result values, not preview-only state.

---

# 9. Economy Technical Flow

Diamond balance source:

* `User.diamonds`
* helpers in `src/lib/diamondEconomy.js` and economy gateways

Diamond ledger:

* `DiamondTransaction`

Daily Wheel:

* entity: `DailyWheelSpin`
* callable path: server-backed claim flow
* grants Diamonds only
* no Kronox Puan
* no leaderboard impact

Daily Quest:

* templates: `DailyQuestDefinition`
* user state: `UserDailyQuestProgress`
* admin create/list through Admin Ekranı
* runtime progress from Solo events
* claim callable: `claimDailyQuestReward`
* reward ledger: `DiamondTransaction.source = daily_quest_reward`
* grants Diamonds only
* no Kronox Puan
* no leaderboard impact

Question analytics reset must not delete economy ledgers or balances.

---

# 10. Leaderboard Technical Flow

Visible leaderboard score is unified Kronox Puan.

Current projection:

* `SoloLeaderboardEntry`
* historical entity name, current public-safe unified projection
* `total_kronox_score` is Solo + Online visible score projection

User projection:

* `User.kronox_puan_total`
* backend/frontend helpers recompute defensively when needed

Public identity:

* username-first safe name
* no raw email/provider IDs
* `display_name` only as legacy/fallback projection

Leaderboard rows must sort and display from the same score source. Profile Puan
and the current-user leaderboard row must match.

---

# 11. Question Analytics Technical Flow

Admin report callable:

* `sendQuestionAnalyticsReportEmail`

Report delivery:

* email body only
* no current PDF attachment flow
* exactly 9 top-level sections
* text fallback
* admin-only trigger

Active report source:

* `QuestionAttemptEvent`

Optional/manual projections:

* `QuestionStatsProjection`
* `CategoryStatsProjection`

Manual reset scope:

* `QuestionAttemptEvent`
* `PlayerQuestionDailyExposure`
* `QuestionStatsProjection`
* `CategoryStatsProjection`

Optional anti-repeat memory reset:

* `PlayerQuestionExposure`

Not reset by question analytics cleanup:

* `Question`
* `Category`
* `User`
* `GuestProfile`
* profile/player identity data
* `UserCategoryPreference`
* `UserJokerInventory`
* `JokerTransaction`
* `DiamondTransaction`
* `DailyWheelSpin`
* `DailyQuestDefinition`
* `UserDailyQuestProgress`
* leaderboard rows
* score/progress/economy rows

Per-player coverage output must be anonymized as `User0001` style labels and
must not include email, provider UID, raw guest ID/token, owner key, internal
player key, or username.

---

# 12. Security And Public Function Boundaries

Public by design:

* `createGuestProfile`
* `getCategoryMetadata`

Both are intentionally narrow.

`createGuestProfile` may create/verify portable guest identity but must not
trust request-body role/identity/economy/progress/admin fields.

`getCategoryMetadata` may return active category metadata only and must not
return questions, answers, years, full-bank data, user data, admin/internal
fields, passive/deleted categories, or stale hardcoded fallback arrays.

Admin functions use private `AdminUser` rows and inline deploy-safe guards where
Base44 function bundling requires it. Request-body role, user-provided admin
email, hardcoded personal allowlists, or UI hiding are not authorization.

VAPID private key values are server-side secret/env values only. Scanner hits
on the env var name are manual deployment-secret verification unless actual key
material is hardcoded, logged, returned, exposed through `VITE_`, or included in
raw errors.

---

# 13. Health Center Technical Flow

Health Center is a static/simulated release-risk system.

Current Health semantics:

* `PASS` means the simulator verified the limited case
* `FAIL` / `ERROR` are release blockers until fixed
* `WARNING` is review risk
* `NOT_AUTOMATABLE` is manual proof required
* manual gates can keep `releaseReady=false` without reducing automated score

Health report actions:

* Copy Blocker JSON
* Copy Warning JSON
* Download JSON
* Copy Summary
* mobile case details/copy buttons
* clipboard fallback textarea

Static Health can prove doc/source alignment for many contracts, but it cannot
prove:

* real device drag/drop
* low-end Android smoothness
* push delivery
* Base44 production deployment
* two-account invite/lobby/scoring
* App Store / Play Console wrapper results
* actual RLS/BOLA behavior

Release proof remains manual for those gates.

---

# 14. Deployment And Validation Flow

Frontend validation:

* `git diff --check`
* `npm run lint`
* `npm run build`

Base44 static function validation:

* `npm run check:base44-functions`

`npm run build` proves the Vite frontend bundle only. It does not prove Base44
function deployment, backend auth behavior, push delivery, native wrapper
quality, or real-device gestures.

Function changes require Base44 Save & Deploy / live marker proof in the actual
executed function path. Editing a helper, stale mirror, or local proof file does
not prove deployed backend behavior.

Full Health should be run when release readiness is being evaluated, but this
documentation refresh does not require a full Health run by itself.

---

# 15. Current Legacy/Forbidden Runtime Contracts

The following are not current technical truth:

* `HATA` as visible Solo scoring/result label
* `display_name` / `Görünen Ad` as separate public editable identity
* old standalone tutorial route as current onboarding
* hardcoded Chronicle / Flashback / Viral / Arena / Level Up fallback arrays
* original seed category IDs as maximum runtime category boundary
* minimum 5 category preference rule
* active SubCategory preference UI
* Google / Apple / Email login on Home
* Firebase anonymous auth
* Base44 anonymous auth as guest identity
* raw client `Question.list` gameplay fallback
* full question-bank exposure to guest/normal clients
* Daily Quest Kronox Puan rewards
* Daily Quest leaderboard impact
* Online reading Solo preferences for question selection
* old fixed 10-card Solo deck without replacement/shield buffer
* public error-count based Solo star rules

